"""Configuration for the Centric Intake local worker.

All settings come from environment variables with sensible defaults.
Create a .env file in the worker/ directory for local development.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

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
# NVIDIA NIM (FREE Kimi K2.5 + other models)
# ---------------------------------------------------------------------------
NVIDIA_NIM_API_KEY = os.environ.get("NVIDIA_NIM_API_KEY", "")
NVIDIA_NIM_BASE_URL = os.environ.get("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_NIM_MODEL = os.environ.get("NVIDIA_NIM_MODEL", "moonshotai/kimi-k2.5")
NVIDIA_NIM_REASONING_MODEL = os.environ.get("NVIDIA_NIM_REASONING_MODEL", "qwen/qwen3.5-397b-a17b")

# ---------------------------------------------------------------------------
# OpenRouter (Seedream 4.5 image gen + fallback LLM)
# ---------------------------------------------------------------------------
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "bytedance-seed/seedream-4.5")

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
COMPOSE_CONCURRENCY = int(os.environ.get("COMPOSE_CONCURRENCY", "5"))

# ---------------------------------------------------------------------------
# Kling 3.0 (Video Generation)
# ---------------------------------------------------------------------------
KLING_ACCESS_KEY = os.environ.get("KLING_ACCESS_KEY", "")
KLING_SECRET_KEY = os.environ.get("KLING_SECRET_KEY", "")
KLING_MODEL = os.environ.get("KLING_MODEL", "kling-3.0")

# ---------------------------------------------------------------------------
# ElevenLabs TTS (Premium Voice Synthesis)
# ---------------------------------------------------------------------------
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_DEFAULT_VOICE = os.environ.get("ELEVENLABS_DEFAULT_VOICE", "21m00Tcm4TlvDq8ikWAM")  # Rachel
