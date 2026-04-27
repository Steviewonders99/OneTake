# CI Pipeline + Worker Dockerfile Design

**Goal:** Add GitHub Actions CI pipeline (5 required checks) and a multi-arch Worker Dockerfile for Azure VM deployment + local Mac development.

## GitHub Actions CI Pipeline

**File:** `.github/workflows/ci.yml`

**Triggers:** Push to `main`, all pull requests.

**Jobs (parallel):**

| Job | Runs on | Command | Blocks PR |
|-----|---------|---------|:---------:|
| `build` | ubuntu-latest | `pnpm build` | Yes |
| `lint` | ubuntu-latest | `pnpm lint` | Yes |
| `test` | ubuntu-latest | `pnpm test` | Yes |
| `python-lint` | ubuntu-latest | `ruff check worker/` | Yes |
| `docker-build` | ubuntu-latest | `docker buildx build worker/` (no push) | Yes |

**Details:**
- Node 20, Python 3.11, pnpm 9
- pnpm cache via `actions/setup-node` with pnpm cache support
- `build`, `lint`, `test` are separate jobs for clear failure signals
- Docker build verifies the image builds on `linux/amd64` only in CI
- No deployment step — deployment stays manual via `vercel --prod`
- ruff is the Python linter (fast, modern, replaces flake8+isort+pyflakes)

## Worker Dockerfile

**File:** `worker/Dockerfile`

**Base:** `python:3.11-slim`

**Multi-arch:** `linux/amd64` (Azure VM, CI) + `linux/arm64` (Apple Silicon Mac).

**Layers (cache-optimized):**
1. System deps: Chromium deps for Playwright, FFmpeg
2. Python deps: `requirements.txt`
3. Playwright browsers: `playwright install chromium`
4. App code: `COPY . .`
5. Entrypoint: `python main.py`

**Excluded via `.dockerignore`:**
- `.venv/`, `__pycache__/`, `.env*`, `.keys.json`, `*.pyc`
- MLX models (mount as volume or use cloud inference)

**MLX note:** Docker image does NOT include MLX (requires Apple Metal GPU). In Docker, worker uses cloud inference only (OpenRouter/NIM). For local MLX, run `python main.py` directly outside Docker.

## docker-compose.yml

**File:** `docker-compose.yml` (project root)

```yaml
services:
  worker:
    build: ./worker
    env_file: ./worker/.env
    restart: unless-stopped
```

For local dev with live reload, mount the worker directory as a volume.

## README Updates

Add Docker and CI sections to README.md:
- Docker section: build, run, multi-arch, MLX caveat
- CI section: what checks run, how to read failures
