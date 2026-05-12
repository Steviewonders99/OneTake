"""Configuration for the Centric Intake local worker.

All settings come from environment variables with sensible defaults.
In multi-worker mode, each worker loads its own .env.workerN file
with a unique NIM API key (rate limits are per-key).
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

# Worker identity — set by supervisor or defaults to "worker-0" (dev mode)
WORKER_ID = os.environ.get("WORKER_ID", "worker-0")

# Load worker-specific env file if specified, otherwise default .env
_env_file = os.environ.get("ENV_FILE", ".env")
if os.path.exists(_env_file):
    load_dotenv(_env_file, override=True)
else:
    load_dotenv()  # fall back to default .env

# ---------------------------------------------------------------------------
# Neon Postgres
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# ---------------------------------------------------------------------------
# Vercel Blob
# ---------------------------------------------------------------------------
VERCEL_BLOB_TOKEN = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
VERCEL_BLOB_STORE_ID = os.environ.get("BLOB_STORE_ID", "")

# ---------------------------------------------------------------------------
# WordPress (MCP auto-publish)
# ---------------------------------------------------------------------------
WP_SITE_URL = os.environ.get("WP_SITE_URL", "")
WP_USERNAME = os.environ.get("WP_USERNAME", "")
WP_APP_PASSWORD = os.environ.get("WP_APP_PASSWORD", "")
WP_PUBLISH_STATUS = os.environ.get("WP_PUBLISH_STATUS", "draft")  # "draft" for testing, "publish" for production

# ---------------------------------------------------------------------------
# NVIDIA NIM (FREE Kimi K2.5 + other models)
# ---------------------------------------------------------------------------
NVIDIA_NIM_API_KEY = os.environ.get("NVIDIA_NIM_API_KEY", "")
NVIDIA_NIM_BASE_URL = os.environ.get("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_NIM_MODEL = os.environ.get("NVIDIA_NIM_MODEL", "moonshotai/kimi-k2.5")
NVIDIA_NIM_REASONING_MODEL = os.environ.get("NVIDIA_NIM_REASONING_MODEL", "qwen/qwen3.5-397b-a17b")
NVIDIA_NIM_CREATIVE_MODEL = os.environ.get("NVIDIA_NIM_CREATIVE_MODEL", "google/gemma-3-27b-it")
NVIDIA_NIM_DESIGN_MODEL = os.environ.get("NVIDIA_NIM_DESIGN_MODEL", "z-ai/glm5")

# ---------------------------------------------------------------------------
# Image Generation — OpenAI direct (primary) or OpenRouter (fallback)
# ---------------------------------------------------------------------------
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "gpt-image-2")
IMAGE_QUALITY = os.environ.get("IMAGE_QUALITY", "low")  # low, medium, high
IMAGE_CONCURRENCY = int(os.environ.get("IMAGE_CONCURRENCY", "15"))

# ---------------------------------------------------------------------------
# Teams Webhook
# ---------------------------------------------------------------------------
TEAMS_WEBHOOK_URL = os.environ.get("TEAMS_WEBHOOK_URL", "")

# ---------------------------------------------------------------------------
# App URL (for notification links)
# ---------------------------------------------------------------------------
APP_URL = os.environ.get("APP_URL", "http://localhost:3000")

# ---------------------------------------------------------------------------
# Polling
# ---------------------------------------------------------------------------
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "30"))

# ---------------------------------------------------------------------------
# MLX Models (Apple Silicon local inference)
# ---------------------------------------------------------------------------
LLM_MODEL = os.environ.get("LLM_MODEL", "mlx-community/Qwen3.5-9B-MLX-4bit")
COPY_MODEL = os.environ.get("COPY_MODEL", "mlx-community/Gemma-3-12B-it-4bit")
VLM_MODEL = os.environ.get("VLM_MODEL", "mlx-community/Qwen3-VL-8B-Instruct-4bit")

# ---------------------------------------------------------------------------
# MLX Server Manager
# ---------------------------------------------------------------------------
MLX_SERVER_HOST = os.environ.get("MLX_SERVER_HOST", "127.0.0.1")
MLX_SERVER_PORT = int(os.environ.get("MLX_SERVER_PORT", "8080"))
MLX_SERVER_IDLE_TIMEOUT_S = int(os.environ.get("MLX_SERVER_IDLE_TIMEOUT_S", "600"))
MLX_SERVER_STARTUP_TIMEOUT_S = int(os.environ.get("MLX_SERVER_STARTUP_TIMEOUT_S", "90"))
MLX_SERVER_HEALTH_POLL_S = float(os.environ.get("MLX_SERVER_HEALTH_POLL_S", "2.0"))

# ---------------------------------------------------------------------------
# Stage 4 Composition
# ---------------------------------------------------------------------------
COMPOSE_CONCURRENCY = int(os.environ.get("COMPOSE_CONCURRENCY", "15"))  # Paid OpenRouter — no rate limit

# ---------------------------------------------------------------------------
# Stage 4 Graphic Design Agent
# ---------------------------------------------------------------------------
# Supported: "design_agent", "reference_layout_agent", or legacy compose_v3 fallback.
STAGE4_ENGINE = os.environ.get("STAGE4_ENGINE", "design_agent")
CREATIVE_DIRECTOR_MODEL = os.environ.get("CREATIVE_DIRECTOR_MODEL", "qwen/qwen3.5-397b-a17b")
CREATIVE_DIRECTOR_FALLBACK = os.environ.get("CREATIVE_DIRECTOR_FALLBACK", "google/gemma-3-27b-it")
BATCH_VQA_MODEL = os.environ.get("BATCH_VQA_MODEL", "google/gemma-4-31b-it")

# ---------------------------------------------------------------------------
# Kling 3.0 (Video Generation)
# ---------------------------------------------------------------------------
KLING_ACCESS_KEY = os.environ.get("KLING_ACCESS_KEY", "")
KLING_SECRET_KEY = os.environ.get("KLING_SECRET_KEY", "")
KLING_MODEL = os.environ.get("KLING_MODEL", "kling-v3-omni")

# ---------------------------------------------------------------------------
# ElevenLabs TTS (Premium Voice Synthesis)
# ---------------------------------------------------------------------------
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_DEFAULT_VOICE = os.environ.get("ELEVENLABS_DEFAULT_VOICE", "21m00Tcm4TlvDq8ikWAM")  # Rachel

# Gemma 4 VQA (Creative evaluation)
NVIDIA_NIM_VQA_KEY = os.environ.get("NVIDIA_NIM_VQA_KEY", os.environ.get("NVIDIA_NIM_API_KEY", ""))
NVIDIA_NIM_VQA_MODEL = os.environ.get("NVIDIA_NIM_VQA_MODEL", "google/gemma-4-31b-it")

# ---------------------------------------------------------------------------
# Organic Social Metrics Sync
# ---------------------------------------------------------------------------
META_PAGE_ACCESS_TOKEN = os.environ.get("META_PAGE_ACCESS_TOKEN", "")
META_PAGE_ID = os.environ.get("META_PAGE_ID", "")
META_IG_BUSINESS_ID = os.environ.get("META_IG_BUSINESS_ID", "")

LINKEDIN_ORG_ACCESS_TOKEN = os.environ.get("LINKEDIN_ORG_ACCESS_TOKEN", "")
LINKEDIN_ORG_ID = os.environ.get("LINKEDIN_ORG_ID", "")

REDDIT_CLIENT_ID = os.environ.get("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.environ.get("REDDIT_CLIENT_SECRET", "")
REDDIT_USERNAME = os.environ.get("REDDIT_USERNAME", "")
REDDIT_PASSWORD = os.environ.get("REDDIT_PASSWORD", "")

GSC_SERVICE_ACCOUNT_JSON = os.environ.get("GSC_SERVICE_ACCOUNT_JSON", "")
GSC_PROPERTY_URL = os.environ.get("GSC_PROPERTY_URL", "")

ORGANIC_SYNC_DAYS = int(os.environ.get("ORGANIC_SYNC_DAYS", "7"))
