#!/bin/bash
# Centric Intake Local Worker — STOP Script
# Nuclear kill: finds and kills ALL worker + MLX server processes.
# Uses PID files + pgrep to ensure nothing survives.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Stopping all worker processes..."

# Kill from PID files
if [ -f .pids/worker.pid ]; then
    PID=$(cat .pids/worker.pid)
    kill -9 $PID 2>/dev/null && echo "  Killed worker PID $PID" || echo "  Worker PID $PID already dead"
    rm -f .pids/worker.pid
fi

if [ -f .pids/mlx_server.pid ]; then
    PID=$(cat .pids/mlx_server.pid)
    kill -9 $PID 2>/dev/null && echo "  Killed MLX server PID $PID" || echo "  MLX server PID $PID already dead"
    rm -f .pids/mlx_server.pid
fi

# Nuclear: kill ALL mlx_lm.server processes
MLX_PIDS=$(pgrep -f "mlx_lm.server" 2>/dev/null || true)
if [ -n "$MLX_PIDS" ]; then
    echo "  Killing $(echo "$MLX_PIDS" | wc -l | tr -d ' ') MLX server(s): $MLX_PIDS"
    echo "$MLX_PIDS" | xargs kill -9 2>/dev/null || true
fi

# Nuclear: kill ALL main.py worker processes (python3.13)
WORKER_PIDS=$(pgrep -f "python3.13.*main.py" 2>/dev/null || true)
if [ -n "$WORKER_PIDS" ]; then
    echo "  Killing $(echo "$WORKER_PIDS" | wc -l | tr -d ' ') zombie worker(s): $WORKER_PIDS"
    echo "$WORKER_PIDS" | xargs kill -9 2>/dev/null || true
fi

sleep 2

# Verify
REMAINING=$(pgrep -f "mlx_lm.server|python3.13.*main.py" 2>/dev/null | wc -l | tr -d ' ')
if [ "$REMAINING" -gt "0" ]; then
    echo "⚠️  $REMAINING processes still alive — force killing..."
    pgrep -f "mlx_lm.server|python3.13.*main.py" 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 2
fi

echo ""
echo "  ✅ All worker processes stopped."
echo ""
