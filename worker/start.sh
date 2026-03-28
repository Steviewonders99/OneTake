#!/bin/bash
# Centric Intake Local Worker — Start Script
# Runs the compute worker that polls Neon for jobs and processes them locally.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment
if [ -f .env ]; then
    echo "Loading .env..."
    export $(grep -v '^#' .env | xargs)
fi

# Find Python 3.11+ (prefer homebrew, then system)
PYTHON=""
for candidate in python3.13 python3.12 python3.11; do
    if command -v "$candidate" &>/dev/null; then
        PYTHON="$candidate"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    # Check if default python3 is 3.10+
    if python3 -c "import sys; assert sys.version_info >= (3, 10)" 2>/dev/null; then
        PYTHON="python3"
    else
        echo "ERROR: Python 3.11+ required. Install via: brew install python@3.11"
        echo "       System python3 is $(python3 --version 2>&1) — too old."
        exit 1
    fi
fi

echo "Using: $($PYTHON --version)"

# Check dependencies
if ! $PYTHON -c "import asyncpg" 2>/dev/null; then
    echo "Installing Python dependencies..."
    $PYTHON -m pip install -r requirements.txt
fi

# Check Playwright browsers
if ! $PYTHON -c "from playwright.sync_api import sync_playwright" 2>/dev/null; then
    echo "Installing Playwright browsers..."
    $PYTHON -m playwright install chromium
fi

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   OneForma Recruitment Intake — Local Worker ║"
echo "  ║                                              ║"
echo "  ║   MLX models on Apple Silicon                ║"
echo "  ║   Polling Neon every ${POLL_INTERVAL_SECONDS:-30}s              ║"
echo "  ║                                              ║"
echo "  ║   Ctrl+C to stop                             ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

$PYTHON main.py
