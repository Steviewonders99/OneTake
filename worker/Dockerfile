# ──────────────────────────────────────────────────────────────
# Nova Worker — Multi-arch Docker image
# Supports: linux/amd64 (Azure VM, CI) + linux/arm64 (Apple Silicon)
#
# Build:
#   docker build -t nova-worker ./worker
#
# Build multi-arch:
#   docker buildx build --platform linux/amd64,linux/arm64 -t nova-worker ./worker
#
# Run:
#   docker run --env-file worker/.env nova-worker
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
    libasound2 \
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
# Worker polls DB — if process is alive, it's healthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import asyncio; asyncio.run(__import__('neon_client')._get_pool())" || exit 1

# ── Entrypoint ───────────────────────────────────────────────
CMD ["python", "main.py"]
