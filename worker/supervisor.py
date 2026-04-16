"""Supervisor — spawns and manages parallel worker subprocesses.

Reactive scaling: spawns workers based on pending job count.
- 0-1 pending jobs: 1 worker
- 2+ pending jobs: min(pending, max_workers) workers

Each worker gets its own NIM API key via .env.workerN file.
Workers claim jobs atomically (FOR UPDATE SKIP LOCKED).
Supervisor monitors health, restarts crashes, handles shutdown.

Usage:
    cd worker/
    python3.13 supervisor.py
"""
from __future__ import annotations

import asyncio
import json
import logging
import multiprocessing
import os
import signal
import sys
import time
from datetime import datetime
from typing import Any

# Setup supervisor logging BEFORE importing worker modules
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [supervisor] [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("logs/supervisor.log", mode="a"),
        logging.StreamHandler(sys.stdout),
    ],
    force=True,
)
logger = logging.getLogger("supervisor")

# Load base config for DB access
from dotenv import load_dotenv

load_dotenv()


class WorkerState:
    """Tracks the state of a single worker subprocess."""

    def __init__(self, worker_id: str, env_file: str):
        self.worker_id = worker_id
        self.env_file = env_file
        self.process: multiprocessing.Process | None = None
        self.started_at: datetime | None = None
        self.restart_count: int = 0

    @property
    def is_alive(self) -> bool:
        return self.process is not None and self.process.is_alive()

    def spawn(self):
        """Spawn (or respawn) this worker as a subprocess."""
        from main import run_worker_subprocess

        self.process = multiprocessing.Process(
            target=run_worker_subprocess,
            args=(self.worker_id, self.env_file),
            name=self.worker_id,
            daemon=False,
        )
        self.process.start()
        self.started_at = datetime.now()
        logger.info(
            "Spawned %s (PID=%d, env=%s, restarts=%d)",
            self.worker_id, self.process.pid, self.env_file, self.restart_count,
        )

    def terminate(self, timeout: float = 10.0):
        """Gracefully terminate this worker."""
        if self.process and self.process.is_alive():
            logger.info("Terminating %s (PID=%d)", self.worker_id, self.process.pid)
            self.process.terminate()
            self.process.join(timeout=timeout)
            if self.process.is_alive():
                logger.warning("Force-killing %s (PID=%d)", self.worker_id, self.process.pid)
                self.process.kill()
                self.process.join(timeout=5)
        self.process = None
        self.started_at = None


class Supervisor:
    """Manages a pool of worker subprocesses with reactive scaling."""

    def __init__(self, config_path: str = "worker_config.json"):
        with open(config_path) as f:
            self.config = json.load(f)

        self.max_workers: int = self.config["max_workers"]
        self.poll_interval: float = self.config["poll_interval_s"]
        self.health_interval: float = self.config["health_check_interval_s"]
        self.max_restarts: int = self.config["max_restarts_per_worker"]
        self.drain_timeout: float = self.config["drain_timeout_s"]
        self.stale_threshold: int = self.config["stale_job_threshold_minutes"]

        # Build worker pool from config
        self.workers: dict[str, WorkerState] = {}
        for w in self.config["workers"]:
            self.workers[w["id"]] = WorkerState(w["id"], w["env_file"])

        self._shutdown_event = asyncio.Event()
        self._last_health_check = 0.0

    async def start(self):
        """Main supervisor loop."""
        logger.info(
            "Supervisor starting: max_workers=%d, poll=%ds, health=%ds",
            self.max_workers, self.poll_interval, self.health_interval,
        )

        # Setup signal handlers
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda s=sig: asyncio.create_task(self._shutdown(s)))

        # Startup: clean stale jobs
        await self._cleanup_stale_jobs()

        # Main loop
        while not self._shutdown_event.is_set():
            try:
                await self._scaling_cycle()
                await self._health_check_cycle()
            except Exception as e:
                logger.error("Supervisor cycle error: %s", e, exc_info=True)

            try:
                await asyncio.wait_for(
                    self._shutdown_event.wait(),
                    timeout=self.poll_interval,
                )
                break  # Shutdown signal received
            except TimeoutError:
                pass  # Normal — just loop again

        await self._drain_all()
        logger.info("Supervisor stopped.")

    async def _scaling_cycle(self):
        """Count pending jobs and adjust worker count."""
        from neon_client import count_pending_jobs

        pending = await count_pending_jobs()
        alive_count = sum(1 for w in self.workers.values() if w.is_alive)

        if pending == 0 or pending == 1:
            target = 1
        else:
            target = min(pending, self.max_workers)

        if target > alive_count:
            to_spawn = target - alive_count
            available = [
                w for w in self.workers.values()
                if not w.is_alive and w.restart_count < self.max_restarts
            ]
            for w in available[:to_spawn]:
                w.spawn()
                logger.info(
                    "Scaled up: pending=%d, alive=%d->%d",
                    pending, alive_count, alive_count + 1,
                )
                alive_count += 1

        if alive_count > 0 or pending > 0:
            logger.info(
                "Status: pending=%d, alive=%d/%d, target=%d",
                pending, alive_count, self.max_workers, target,
            )

    async def _health_check_cycle(self):
        """Check worker health, restart crashed workers."""
        now = time.time()
        if now - self._last_health_check < self.health_interval:
            return
        self._last_health_check = now


        for wid, state in self.workers.items():
            if state.process is not None and not state.is_alive:
                exit_code = state.process.exitcode
                logger.warning(
                    "Worker %s died (exit_code=%s, restarts=%d/%d)",
                    wid, exit_code, state.restart_count, self.max_restarts,
                )

                # Reset orphaned job to pending for retry (not failed)
                # Add retry_count to prevent infinite crash loops on poison jobs
                try:
                    from neon_client import _get_pool
                    pool = await _get_pool()
                    async with pool.acquire() as conn:
                        row = await conn.fetchrow(
                            """
                            UPDATE compute_jobs
                            SET status = CASE
                                WHEN COALESCE((feedback_data->>'crash_retry_count')::int, 0) >= 2
                                THEN 'failed'
                                ELSE 'pending'
                            END,
                            started_at = CASE
                                WHEN COALESCE((feedback_data->>'crash_retry_count')::int, 0) >= 2
                                THEN started_at
                                ELSE NULL
                            END,
                            worker_id = NULL,
                            error_message = CASE
                                WHEN COALESCE((feedback_data->>'crash_retry_count')::int, 0) >= 2
                                THEN $2
                                ELSE NULL
                            END,
                            completed_at = CASE
                                WHEN COALESCE((feedback_data->>'crash_retry_count')::int, 0) >= 2
                                THEN NOW()
                                ELSE NULL
                            END,
                            feedback_data = jsonb_set(
                                COALESCE(feedback_data, '{}'::jsonb),
                                '{crash_retry_count}',
                                (COALESCE((feedback_data->>'crash_retry_count')::int, 0) + 1)::text::jsonb
                            )
                            WHERE worker_id = $1 AND status = 'processing'
                            RETURNING id::text, status
                            """,
                            wid,
                            f"Worker {wid} crashed 3 times — poison job",
                        )
                        if row:
                            new_status = row["status"]
                            if new_status == "pending":
                                logger.info("Reset orphaned job %s to pending (will be retried)", row["id"])
                            else:
                                logger.error("Marked orphaned job %s as failed (exceeded crash retries)", row["id"])
                except Exception as e:
                    logger.error("Failed to handle orphaned job: %s", e)

                state.process = None
                if state.restart_count < self.max_restarts:
                    state.restart_count += 1
                    logger.info("Worker %s eligible for restart (count=%d)", wid, state.restart_count)
                else:
                    logger.error("Worker %s exceeded max restarts (%d) — not restarting", wid, self.max_restarts)

        # Periodic stale job cleanup (not just on startup)
        from neon_client import reset_stale_jobs
        stale_count = await reset_stale_jobs(self.stale_threshold)
        if stale_count > 0:
            logger.warning("Reset %d stale jobs back to pending (stuck >%dm)", stale_count, self.stale_threshold)

    async def _cleanup_stale_jobs(self):
        """Reset jobs stuck in processing (from previous crashed runs)."""
        from neon_client import reset_stale_jobs

        count = await reset_stale_jobs(self.stale_threshold)
        if count > 0:
            logger.info("Reset %d stale jobs back to pending", count)

    async def _shutdown(self, sig):
        """Handle shutdown signal — drain workers gracefully."""
        logger.info("Received signal %s — initiating graceful shutdown", sig)
        self._shutdown_event.set()

    async def _drain_all(self):
        """Terminate all workers with grace period."""
        alive = [w for w in self.workers.values() if w.is_alive]
        if not alive:
            return

        logger.info("Draining %d workers (timeout=%ds)...", len(alive), self.drain_timeout)

        for w in alive:
            if w.process and w.process.is_alive():
                w.process.terminate()

        deadline = time.time() + self.drain_timeout
        while time.time() < deadline:
            still_alive = [w for w in alive if w.is_alive]
            if not still_alive:
                logger.info("All workers drained cleanly.")
                return
            await asyncio.sleep(1)

        for w in alive:
            if w.is_alive:
                logger.warning("Force-killing %s", w.worker_id)
                w.terminate(timeout=5)

    def get_status(self) -> dict[str, Any]:
        """Return current supervisor state for monitoring."""
        return {
            "max_workers": self.max_workers,
            "workers": {
                wid: {
                    "alive": state.is_alive,
                    "pid": state.process.pid if state.process else None,
                    "started_at": state.started_at.isoformat() if state.started_at else None,
                    "restart_count": state.restart_count,
                }
                for wid, state in self.workers.items()
            },
            "alive_count": sum(1 for w in self.workers.values() if w.is_alive),
        }


async def run_supervisor():
    supervisor = Supervisor()
    await supervisor.start()


if __name__ == "__main__":
    sys.stdout.reconfigure(line_buffering=True)
    asyncio.run(run_supervisor())
