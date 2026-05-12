# Centric Intake — Local Compute Worker

A Python worker that runs on Apple Silicon. It polls Neon Postgres for pending `compute_jobs`, runs the full Creative OS pipeline using local MLX models, and writes results back to Neon.

## Prerequisites

- macOS with Apple Silicon (M1/M2/M3/M4)
- Python 3.11+
- Playwright browsers installed
- Access to Neon Postgres (DATABASE_URL)
- Vercel Blob token (BLOB_READ_WRITE_TOKEN)
- Seedream API key (SEEDREAM_API_KEY)

## Quick Start

```bash
cd worker/

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers (first time only)
playwright install chromium

# Create .env file
cp .env.example .env
# Edit .env with your actual values

# Start the worker
python main.py
```

## Environment Variables

Create a `.env` file in the `worker/` directory:

```env
# Neon Postgres
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
BLOB_STORE_ID=store_...

# Seedream 4.5 (Volcengine)
SEEDREAM_API_KEY=your-api-key
SEEDREAM_API_ENDPOINT=https://operator.las.cn-beijing.volces.com/api/v1
SEEDREAM_MODEL=doubao-seedream-4-5

# Teams Webhook (optional)
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...

# App URL (for notification links)
APP_URL=https://your-app.vercel.app

# Polling interval
POLL_INTERVAL_SECONDS=30

# MLX Models (defaults are fine for most setups)
LLM_MODEL=mlx-community/Qwen3.5-9B-MLX-4bit
COPY_MODEL=mlx-community/Gemma-3-12B-it-4bit
VLM_MODEL=mlx-community/Qwen3-VL-8B-Instruct-4bit
```

## Architecture

```
Neon Postgres (compute_jobs table)
    │
    ▼  poll every 30s
┌─────────────────────────┐
│    main.py (poll loop)  │
│         │               │
│    orchestrator.py      │
│    ┌────┴────┐          │
│    │ Stage 1 │ Brief generation (Qwen3.5-9B)
│    │ Stage 2 │ Actor images (Seedream 4.5 + Qwen3-VL QA)
│    │ Stage 3 │ Ad copy (Gemma 3 12B, multilingual)
│    │ Stage 4 │ Composition (Playwright → PNG)
│    └────┬────┘          │
│         │               │
│    Vercel Blob upload   │
│    Neon write-back      │
│    Teams notification   │
└─────────────────────────┘
```

## Pipeline Stages

### Stage 1: Strategic Intelligence
- Generates a creative brief from the intake request
- Self-evaluates with a quality gate (threshold 0.85, max 3 retries)
- Produces design direction (templates, color, photography style)

### Stage 2: Character-Driven Image Generation
- Creates culturally authentic actor personas per target region
- Generates hero images via Seedream 4.5 with 10 realism anchors
- Visual QA via Qwen3-VL (threshold 0.85, max 3 retries per image)
- Uploads approved images to Vercel Blob

### Stage 3: Copy Generation
- Generates platform-adapted copy in each target language via Gemma 3 12B
- Evaluates copy quality (threshold 0.70, max 3 retries)
- Stores copy as generated_assets in Neon

### Stage 4: Layout Composition
- Selects template per platform via Qwen3.5-9B
- Builds HTML/CSS overlays on hero images
- Renders to PNG via Playwright
- 7-dimension creative evaluation (threshold 0.70, max 3 retries)
- Uploads final creatives to Vercel Blob

### Stage 4: Reference Layout Agent
- Optional engine: `STAGE4_ENGINE=reference_layout_agent`
- Uses a typed layer manifest instead of model-written HTML/CSS
- Preserves premium reference structure: exact frame, text, overlays, texture, logo, and z-order
- Swaps only the base photo layer from Stage 2 actor images
- Renders editable HTML + PNG via Playwright

Local visual smoke test:

```bash
cd worker
python3 sandbox_reference_layout.py --image /path/to/base-image.png
```

## Models

| Model | Purpose | Size |
|-------|---------|------|
| Qwen3.5-9B-MLX-4bit | Brief, actors, template selection | ~5GB |
| Gemma-3-12B-it-4bit | Multilingual ad copy | ~7GB |
| Qwen3-VL-8B-Instruct-4bit | Visual QA, cultural check | ~5GB |

Models are downloaded automatically on first use and cached by MLX.

## Verification

To verify the worker connects to Neon:

```bash
python -c "
import asyncio
from neon_client import fetch_pending_jobs
async def check():
    jobs = await fetch_pending_jobs()
    print(f'Found {len(jobs)} pending jobs')
asyncio.run(check())
"
```
