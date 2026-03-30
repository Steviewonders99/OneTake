"""Local compute worker for Centric Intake App.

Polls Neon for pending compute_jobs, runs Creative OS pipeline locally,
posts results back to Neon. All AI inference runs on Apple Silicon via MLX.

Uses ProcessManager to ensure EXACTLY ONE worker + ONE MLX server exists.
No more zombie processes. No more hydra spawning.

Usage:
    cd worker/
    python main.py
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys

from config import POLL_INTERVAL_SECONDS
from neon_client import (
    fetch_pending_jobs,
    mark_job_complete,
    mark_job_failed,
    mark_job_processing,
)
from pipeline.orchestrator import run_pipeline
from process_manager import ProcessManager

logger = logging.getLogger(__name__)

# Global process manager
pm = ProcessManager()


async def worker_main(worker_id: str, env_file: str):
    """Entry point for a supervised worker subprocess.

    Called by supervisor.py via multiprocessing. Each worker:
    1. Loads its own env file (unique NIM API key)
    2. Claims jobs atomically (FOR UPDATE SKIP LOCKED)
    3. Runs pipeline, then tries to claim another job
    4. Exits cleanly when no more pending jobs (supervisor decides respawn)
    """
    import importlib

    os.environ["WORKER_ID"] = worker_id
    os.environ["ENV_FILE"] = env_file

    # Reload config module with worker-specific env
    import config as _config
    importlib.reload(_config)

    # Setup per-worker logging
    os.makedirs("logs", exist_ok=True)
    log_file = f"logs/{worker_id}.log"
    logging.basicConfig(
        level=logging.INFO,
        format=f"%(asctime)s [{worker_id}] [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(log_file, mode="a"),
            logging.StreamHandler(sys.stdout),
        ],
        force=True,
    )

    logger.info("Worker %s started (PID=%d, env=%s)", worker_id, os.getpid(), env_file)

    from neon_client import claim_next_job, mark_job_complete, mark_job_failed

    jobs_processed = 0

    try:
        while True:
            job = await claim_next_job(worker_id)

            if job is None:
                logger.info("No pending jobs — worker %s exiting cleanly (%d jobs processed)", worker_id, jobs_processed)
                break

            logger.info(
                "Claimed job %s (type=%s, request=%s)",
                job["id"], job["job_type"], job["request_id"],
            )

            try:
                await run_pipeline(job)
                await mark_job_complete(job["id"])
                jobs_processed += 1
                logger.info("Job %s complete. Total processed: %d", job["id"], jobs_processed)
            except Exception as exc:
                logger.error("Job %s failed: %s", job["id"], exc, exc_info=True)
                await mark_job_failed(job["id"], str(exc))

    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Worker %s received shutdown signal", worker_id)
    except Exception as exc:
        logger.error("Worker %s crashed: %s", worker_id, exc, exc_info=True)
        raise


def run_worker_subprocess(worker_id: str, env_file: str):
    """Multiprocessing target — runs the async worker_main in a new event loop.

    This is what supervisor.py calls via multiprocessing.Process(target=...).
    """
    asyncio.run(worker_main(worker_id, env_file))


async def main():
    """Run the polling loop forever."""

    # ======================================================================
    # STEP 0: CLEAN START — kill ALL existing workers and MLX servers
    # This is the hydra killer. No exceptions. No survivors.
    # ======================================================================
    pm.ensure_clean_start()
    pm.register_worker(os.getpid())

    status = pm.get_status()
    logger.info(
        "Process manager: worker=%d, orphan_mlx=%d, orphan_workers=%d",
        status["worker_pid"] or 0,
        status["orphan_mlx_count"],
        status["orphan_worker_count"],
    )

    logger.info(
        "Centric local worker started (PID=%d). Polling every %ds.",
        os.getpid(),
        POLL_INTERVAL_SECONDS,
    )
    logger.info("MLX server will auto-start on first generation request.")

    from mlx_server_manager import mlx_server

    try:
        while True:
            try:
                jobs = await fetch_pending_jobs()

                for job in jobs:
                    logger.info(
                        "Processing job %s (type=%s, request=%s)",
                        job["id"],
                        job["job_type"],
                        job["request_id"],
                    )
                    await mark_job_processing(job["id"])

                    try:
                        await run_pipeline(job)
                        await mark_job_complete(job["id"])
                        logger.info("Job %s complete.", job["id"])
                    except Exception as exc:
                        logger.error("Job %s failed: %s", job["id"], exc, exc_info=True)
                        await mark_job_failed(job["id"], str(exc))

            except Exception as exc:
                logger.error("Poll cycle error: %s", exc, exc_info=True)

            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Shutting down...")
    finally:
        # Clean shutdown — kill MLX server and clean PID files
        await mlx_server.shutdown()
        pm.shutdown_all()
        logger.info("Worker stopped. All processes cleaned up.")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
        force=True,
    )

    # Flush output immediately (no buffering)
    sys.stdout.reconfigure(line_buffering=True)

    asyncio.run(main())
