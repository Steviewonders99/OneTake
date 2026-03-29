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
