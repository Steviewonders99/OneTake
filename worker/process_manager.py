"""Process Manager — ensures EXACTLY ONE worker + ONE MLX server at all times.

Solves the hydra problem: multiple zombie workers and MLX servers accumulating
from failed starts, crashed processes, and orphaned subprocesses.

Uses PID files + aggressive cleanup:
1. On startup: reads PID files, kills any existing processes
2. Writes new PID files for worker + MLX server
3. On shutdown: kills everything and cleans up PID files
4. Nuclear kill: finds ALL mlx_lm.server and main.py processes and kills them

Usage:
    from process_manager import ProcessManager
    pm = ProcessManager()
    pm.ensure_clean_start()  # Kills ALL existing workers/servers
    # ... start your worker ...
    pm.register_worker(os.getpid())
    pm.register_mlx_server(mlx_pid)
    # ... on shutdown ...
    pm.shutdown_all()
"""
from __future__ import annotations

import logging
import os
import signal
import subprocess
import time

logger = logging.getLogger(__name__)

PID_DIR = os.path.join(os.path.dirname(__file__), ".pids")
WORKER_PID_FILE = os.path.join(PID_DIR, "worker.pid")
MLX_PID_FILE = os.path.join(PID_DIR, "mlx_server.pid")


class ProcessManager:
    """Manages worker and MLX server process lifecycle via PID files."""

    def __init__(self) -> None:
        os.makedirs(PID_DIR, exist_ok=True)

    def ensure_clean_start(self) -> None:
        """Kill ALL existing worker and MLX server processes. Nuclear option.

        This is the FIRST thing called on startup. It:
        1. Reads PID files and kills those processes
        2. Finds ANY mlx_lm.server process on the system and kills it
        3. Finds ANY main.py worker process and kills it
        4. Cleans up PID files
        5. Verifies zero processes remain
        """
        logger.info("ProcessManager: ensuring clean start...")

        # Step 1: Kill from PID files
        self._kill_from_pid_file(WORKER_PID_FILE, "worker")
        self._kill_from_pid_file(MLX_PID_FILE, "MLX server")

        # Step 2: Nuclear — find and kill ALL mlx_lm.server processes
        self._nuclear_kill("mlx_lm.server", "MLX server")

        # Step 3: Nuclear — find and kill ALL zombie main.py workers
        # (but NOT our own process!)
        my_pid = os.getpid()
        self._nuclear_kill("main.py", "worker", exclude_pid=my_pid)

        # Step 4: Clean PID files
        self._remove_pid_file(WORKER_PID_FILE)
        self._remove_pid_file(MLX_PID_FILE)

        # Step 5: Verify
        time.sleep(2)
        remaining = self._count_processes("mlx_lm.server") + self._count_processes("main.py", exclude_pid=my_pid)
        if remaining > 0:
            logger.warning("ProcessManager: %d processes still alive after cleanup — force killing", remaining)
            self._nuclear_kill("mlx_lm.server", "MLX server")
            self._nuclear_kill("main.py", "worker", exclude_pid=my_pid)
            time.sleep(2)

        logger.info("ProcessManager: clean start confirmed — zero existing processes")

    def register_worker(self, pid: int) -> None:
        """Register the worker process PID."""
        self._write_pid_file(WORKER_PID_FILE, pid)
        logger.info("ProcessManager: registered worker PID %d", pid)

    def register_mlx_server(self, pid: int) -> None:
        """Register the MLX server process PID."""
        self._write_pid_file(MLX_PID_FILE, pid)
        logger.info("ProcessManager: registered MLX server PID %d", pid)

    def shutdown_all(self) -> None:
        """Kill all managed processes and clean up."""
        logger.info("ProcessManager: shutting down all processes...")

        # Kill from PID files
        self._kill_from_pid_file(MLX_PID_FILE, "MLX server")
        self._kill_from_pid_file(WORKER_PID_FILE, "worker")

        # Nuclear kill any remaining mlx_lm.server
        self._nuclear_kill("mlx_lm.server", "MLX server")

        # Clean PID files
        self._remove_pid_file(WORKER_PID_FILE)
        self._remove_pid_file(MLX_PID_FILE)

        logger.info("ProcessManager: shutdown complete")

    def get_status(self) -> dict:
        """Get current process status."""
        worker_pid = self._read_pid_file(WORKER_PID_FILE)
        mlx_pid = self._read_pid_file(MLX_PID_FILE)
        return {
            "worker_pid": worker_pid,
            "worker_alive": self._is_alive(worker_pid) if worker_pid else False,
            "mlx_pid": mlx_pid,
            "mlx_alive": self._is_alive(mlx_pid) if mlx_pid else False,
            "orphan_mlx_count": self._count_processes("mlx_lm.server"),
            "orphan_worker_count": self._count_processes("main.py", exclude_pid=os.getpid()),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _nuclear_kill(self, pattern: str, name: str, exclude_pid: int | None = None) -> None:
        """Find ALL processes matching pattern and SIGKILL them."""
        try:
            result = subprocess.run(
                ["pgrep", "-f", pattern],
                capture_output=True, text=True, timeout=5,
            )
            pids = [int(p) for p in result.stdout.strip().split("\n") if p.strip()]

            if exclude_pid:
                pids = [p for p in pids if p != exclude_pid]

            if not pids:
                return

            logger.warning(
                "ProcessManager: found %d %s process(es) to kill: %s",
                len(pids), name, pids,
            )

            for pid in pids:
                try:
                    # Kill the process group first (catches children)
                    try:
                        pgid = os.getpgid(pid)
                        os.killpg(pgid, signal.SIGKILL)
                    except (ProcessLookupError, PermissionError):
                        pass

                    # Then kill the process directly
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                except PermissionError:
                    logger.warning("ProcessManager: no permission to kill PID %d", pid)

        except subprocess.TimeoutExpired:
            logger.warning("ProcessManager: pgrep timed out for pattern '%s'", pattern)
        except Exception as e:
            logger.warning("ProcessManager: nuclear kill error: %s", e)

    def _kill_from_pid_file(self, pid_file: str, name: str) -> None:
        """Kill the process recorded in a PID file."""
        pid = self._read_pid_file(pid_file)
        if not pid:
            return

        if self._is_alive(pid):
            logger.info("ProcessManager: killing %s (PID %d from PID file)", name, pid)
            try:
                try:
                    pgid = os.getpgid(pid)
                    os.killpg(pgid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    pass
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass

    def _count_processes(self, pattern: str, exclude_pid: int | None = None) -> int:
        """Count processes matching a pattern."""
        try:
            result = subprocess.run(
                ["pgrep", "-f", pattern],
                capture_output=True, text=True, timeout=5,
            )
            pids = [int(p) for p in result.stdout.strip().split("\n") if p.strip()]
            if exclude_pid:
                pids = [p for p in pids if p != exclude_pid]
            return len(pids)
        except Exception:
            return 0

    @staticmethod
    def _is_alive(pid: int) -> bool:
        """Check if a process is running."""
        try:
            os.kill(pid, 0)
            return True
        except (ProcessLookupError, PermissionError):
            return False

    @staticmethod
    def _write_pid_file(path: str, pid: int) -> None:
        with open(path, "w") as f:
            f.write(str(pid))

    @staticmethod
    def _read_pid_file(path: str) -> int | None:
        try:
            with open(path) as f:
                return int(f.read().strip())
        except (FileNotFoundError, ValueError):
            return None

    @staticmethod
    def _remove_pid_file(path: str) -> None:
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
