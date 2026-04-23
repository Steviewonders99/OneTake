# ──────────────────────────────────────────────────────────────
# onetake-worker — Multi-arch Docker image
# Supports: linux/amd64 (Azure Container Apps) + linux/arm64 (Apple Silicon)
#
# Build:
#   docker build -t onetake-worker ./worker
#
# Build multi-arch:
#   docker buildx build --platform linux/amd64,linux/arm64 -t onetake-worker ./worker
#
# Run:
#   docker run --env-file worker/.env onetake-worker
# ──────────────────────────────────────────────────────────────

FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── System dependencies ──────────────────────────────────────
# Playwright Chromium deps + FFmpeg for video muxing
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Playwright Chromium dependencies
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2t64 \
    libxshmfence1 \
    # FFmpeg for video/audio muxing
    ffmpeg \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies (cached layer) ───────────────────────
COPY requirements-docker.txt .
RUN pip install --no-cache-dir -r requirements-docker.txt

# ── Playwright browser ───────────────────────────────────────
RUN playwright install chromium

# ── Application code ─────────────────────────────────────────
COPY . .

# ── Health check ─────────────────────────────────────────────
# Worker is a DB-polling daemon — healthy = process is alive.
# We check that the Python runtime and core imports load cleanly
# (avoids a live DB connection attempt at health-check time, which
# can cause spurious failures during cold-start on Azure Container Apps).
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import asyncpg, httpx, jinja2; print('ok')" || exit 1

# ── Entrypoint ───────────────────────────────────────────────
CMD ["python", "main.py"]
