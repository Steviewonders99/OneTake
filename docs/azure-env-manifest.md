# OneTake Platform — Azure Deployment Environment Variable Manifest

**Generated:** 2026-04-22  
**Prepared for:** Michael's engineering team  
**Source scanned:** `src/` (Next.js), `worker/` (Python), `worker/config.py`, `.env.example`, `worker/.env.example`

---

## Deployment Topology

| Component | Current Host | Azure Target |
|---|---|---|
| Next.js frontend | Vercel | Azure Static Web Apps or Azure App Service |
| Python worker | Local (Apple Silicon) | Azure Container Apps |
| Database | Neon (serverless Postgres) | Azure Database for PostgreSQL Flexible Server |
| File storage | Vercel Blob | Azure Blob Storage |

> **Key Vault:** Variables marked `Key Vault` below should be stored as Azure Key Vault secrets and injected via Managed Identity or Key Vault references in App Service / Container Apps settings.

---

## Part 1 — Frontend (Next.js)

These variables must be set in the Vercel project settings **or** in the Azure App Service / Static Web App configuration if re-hosted on Azure.

| Variable | Required | Secret / Key Vault | Current Provider | Azure Equivalent | Description |
|---|---|---|---|---|---|
| `DATABASE_URL` | Yes | Key Vault | Neon (serverless Postgres) | Azure Database for PostgreSQL — connection string with `sslmode=require` | Primary Postgres connection used by all API routes via `@neondatabase/serverless` |
| `CLERK_SECRET_KEY` | Yes | Key Vault | Clerk.com | No change — Clerk is provider-agnostic | Backend Clerk secret; used in middleware and API route auth checks |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | No (public) | Clerk.com | No change — same key | Public Clerk key injected into browser bundle |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | No | N/A (path) | No change — `/sign-in` | Clerk sign-in redirect path |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | No | N/A (path) | No change — `/sign-up` | Clerk sign-up redirect path |
| `OPENROUTER_API_KEY` | Yes | Key Vault | OpenRouter.ai | No change — external SaaS | Used in `src/lib/openrouter.ts` and `src/app/api/revise/` for LLM calls (Kimi K2.5, etc.) |
| `NVIDIA_NIM_API_KEY` | Yes | Key Vault | NVIDIA NIM | No change — external SaaS | Used in `src/lib/nim.ts` and `src/app/api/revise/` and `src/app/api/extract/rfp/` |
| `NVIDIA_NIM_BASE_URL` | No | No | NVIDIA NIM | No change — `https://integrate.api.nvidia.com/v1` | NIM endpoint base; only override if using a private NIM deployment |
| `BLOB_READ_WRITE_TOKEN` | Yes | Key Vault | Vercel Blob | Azure Blob Storage SAS token or connection string — update client code (see note) | Uploaded image/asset storage token |
| `TEAMS_WEBHOOK_URL` | Yes | Key Vault | MS Teams Incoming Webhook | No change — same MS Teams tenant | Webhook URL for designer and approval notifications |
| `SLACK_WEBHOOK_URL` | No | Key Vault | Slack | No change — external SaaS | Backup notification channel; optional |
| `NEXT_PUBLIC_APP_URL` | Yes | No | Vercel | Change to Azure / custom domain — e.g. `https://go.oneforma.com` | Used for magic links, tracked-link redirects, and notification deep-links |
| `ATLASCLOUD_API_KEY` | No | Key Vault | AtlasCloud / OpenRouter fallback | No change — external SaaS | Used in `src/app/api/revise/` for Sedeo 2.0 (video); falls back to `OPENROUTER_API_KEY` if unset |
| `CRM_DATABASE_URL` | No | Key Vault | Separate read-only CRM Postgres | Azure Database for PostgreSQL (read replica or separate instance) | Optional — AudienceIQ CRM sync; app gracefully degrades if unset |
| `CRM_SYNC_ENABLED` | No | No | N/A | No change — `"true"` or `"false"` | Feature flag that gates CRM sync; requires `CRM_DATABASE_URL` |
| `TIKTOK_ADS_ACCESS_TOKEN` | No | Key Vault | TikTok Marketing API | No change — external SaaS | Platform analytics integration; app is gated — omit to disable |
| `TIKTOK_ADS_ADVERTISER_ID` | No | No | TikTok | No change | TikTok advertiser account ID |
| `META_ADS_ACCESS_TOKEN` | No | Key Vault | Meta Marketing API | No change — external SaaS | Platform analytics integration; omit to disable |
| `META_ADS_AD_ACCOUNT_ID` | No | No | Meta | No change | Meta ad account ID |
| `GOOGLE_ADS_CLIENT_ID` | No | Key Vault | Google Ads API OAuth | No change — external SaaS | Google Ads OAuth2 client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | No | Key Vault | Google Ads API OAuth | No change — external SaaS | Google Ads OAuth2 client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | No | Key Vault | Google Ads API OAuth | No change — external SaaS | Long-lived OAuth2 refresh token |
| `GOOGLE_ADS_CUSTOMER_ID` | No | No | Google Ads | No change | Google Ads customer/account ID |
| `LINKEDIN_ADS_ACCESS_TOKEN` | No | Key Vault | LinkedIn Marketing API | No change — external SaaS | Platform analytics integration; omit to disable |
| `LINKEDIN_ADS_AD_ACCOUNT_ID` | No | No | LinkedIn | No change | LinkedIn ad account ID |

> **Vercel Blob migration note:** `BLOB_READ_WRITE_TOKEN` is a Vercel-specific token format. If the frontend stays on Vercel this key is unchanged. If the frontend moves to Azure, the blob client code in `src/` will need to be updated to use the `@azure/storage-blob` SDK, and this variable should be replaced by `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER_NAME`.

---

## Part 2 — Python Worker (Azure Container Apps)

The worker reads `worker/config.py` on startup. All variables below map directly to `os.environ.get()` calls in that file.

### 2a — Core (Required on Day 1)

| Variable | Required | Secret / Key Vault | Current Provider | Azure Equivalent | Description |
|---|---|---|---|---|---|
| `DATABASE_URL` | Yes | Key Vault | Neon (serverless Postgres) | Azure Database for PostgreSQL — `postgresql://user:pass@host/db?sslmode=require` | Same connection string as the frontend — worker polls `compute_jobs` table |
| `BLOB_READ_WRITE_TOKEN` | Yes | Key Vault | Vercel Blob | Azure Blob Storage SAS token (update `worker/ai/` blob upload code) | Worker uploads generated images here |
| `BLOB_STORE_ID` | No | No | Vercel Blob | Azure Storage account name or container name | Identifies the Vercel Blob store; replace with container reference on Azure |
| `OPENROUTER_API_KEY` | Yes | Key Vault | OpenRouter.ai | No change — external SaaS | Used for Seedream 4.5 image gen and LLM fallbacks |
| `NVIDIA_NIM_API_KEY` | Yes | Key Vault | NVIDIA NIM | No change — external SaaS | Primary NIM key for Stage 1–4 LLM calls |
| `NVIDIA_NIM_VQA_KEY` | No | Key Vault | NVIDIA NIM (separate account) | No change — external SaaS | Separate key for Gemma 4 VQA calls; falls back to `NVIDIA_NIM_API_KEY` |
| `NIM_EXTRA_KEYS` | No | Key Vault | NVIDIA NIM | No change — external SaaS | Comma-separated pool of additional NIM keys for rate-limit scaling |
| `NIM_KEY_1` … `NIM_KEY_20` | No | Key Vault | NVIDIA NIM | No change — external SaaS | Individually numbered pool keys (up to 20); enables N×40 RPM throughput |
| `TEAMS_WEBHOOK_URL` | Yes | Key Vault | MS Teams Incoming Webhook | No change — same MS Teams tenant | Worker sends pipeline-complete notifications to Teams |
| `APP_URL` | Yes | No | Vercel | Change to Azure / custom domain | Deep-link base for notification cards |

### 2b — NVIDIA NIM Model Selection (Optional — defaults are fine)

| Variable | Required | Secret / Key Vault | Default | Description |
|---|---|---|---|---|
| `NVIDIA_NIM_BASE_URL` | No | No | `https://integrate.api.nvidia.com/v1` | Override only for private NIM endpoints |
| `NVIDIA_NIM_MODEL` | No | No | `moonshotai/kimi-k2.5` | Stage 1 intelligence model |
| `NVIDIA_NIM_REASONING_MODEL` | No | No | `qwen/qwen3.5-397b-a17b` | Reasoning-heavy tasks |
| `NVIDIA_NIM_CREATIVE_MODEL` | No | No | `google/gemma-3-27b-it` | Stage 3 copy generation |
| `NVIDIA_NIM_DESIGN_MODEL` | No | No | `z-ai/glm5` | Stage 4 HTML layout design |
| `NVIDIA_NIM_VQA_MODEL` | No | No | `google/gemma-4-31b-it` | VQA creative evaluation |

### 2c — Image Generation (Required for Stage 2)

| Variable | Required | Secret / Key Vault | Current Provider | Azure Equivalent | Description |
|---|---|---|---|---|---|
| `IMAGE_MODEL` | No | No | `bytedance-seed/seedream-4.5` | No change | OpenRouter model slug for Seedream image generation |
| `ATLASCLOUD_API_KEY` | No | Key Vault | AtlasCloud / OpenRouter | No change — external SaaS | Used in Sedeo 2.0 video and Seedream edit calls; falls back to `OPENROUTER_API_KEY` |
| `FLUX_OPENROUTER_KEY` | No | Key Vault | OpenRouter.ai | No change — external SaaS | Dedicated key for Flux edit calls in `worker/ai/flux_edit.py`; falls back to `OPENROUTER_API_KEY` |
| `GEMINI_API_KEY` | No | Key Vault | Google AI Studio | No change — external SaaS | Used in `worker/ai/gemini_edit.py` for VQA-retry artifact cleanup |

### 2d — Video Pipeline (Optional — Kling 3.0)

| Variable | Required | Secret / Key Vault | Current Provider | Azure Equivalent | Description |
|---|---|---|---|---|---|
| `KLING_ACCESS_KEY` | No | Key Vault | Kling AI | No change — external SaaS | Kling 3.0 video generation access key |
| `KLING_SECRET_KEY` | No | Key Vault | Kling AI | No change — external SaaS | Kling 3.0 video generation secret key |
| `KLING_MODEL` | No | No | `kling-v3-omni` | No change | Model version slug |

### 2e — Voice / Audio (Optional — ElevenLabs TTS)

| Variable | Required | Secret / Key Vault | Current Provider | Azure Equivalent | Description |
|---|---|---|---|---|---|
| `ELEVENLABS_API_KEY` | No | Key Vault | ElevenLabs | No change — external SaaS | Premium TTS for UGC video voice synthesis |
| `ELEVENLABS_DEFAULT_VOICE` | No | No | `21m00Tcm4TlvDq8ikWAM` (Rachel) | No change | Voice ID to use when no campaign-specific voice is set |

### 2f — WordPress Auto-Publish (Optional)

| Variable | Required | Secret / Key Vault | Current Provider | Azure Equivalent | Description |
|---|---|---|---|---|---|
| `WP_SITE_URL` | No | No | — | No change | WordPress site root URL for auto-publishing landing pages |
| `WP_USERNAME` | No | No | — | No change | WordPress username for REST API auth |
| `WP_APP_PASSWORD` | No | Key Vault | WordPress | No change | WordPress application password |
| `WP_PUBLISH_STATUS` | No | No | `draft` | No change | Set to `publish` for live auto-publish; `draft` for review |

### 2g — MLX Local Inference (Apple Silicon ONLY — Not applicable to Azure)

> These variables control the local MLX inference server that runs on the MacBook Air. **They do not apply to Azure Container Apps.** On Azure the worker uses NVIDIA NIM for all LLM inference. If the Azure worker image does not include MLX, remove or leave these unset.

| Variable | Default | Notes |
|---|---|---|
| `LLM_MODEL` | `mlx-community/Qwen3.5-9B-MLX-4bit` | Local model path — Azure: leave unset |
| `COPY_MODEL` | `mlx-community/Gemma-3-12B-it-4bit` | Local model path — Azure: leave unset |
| `VLM_MODEL` | `mlx-community/Qwen3-VL-8B-Instruct-4bit` | Local model path — Azure: leave unset |
| `MLX_SERVER_HOST` | `127.0.0.1` | Azure: leave unset |
| `MLX_SERVER_PORT` | `8080` | Azure: leave unset |
| `MLX_SERVER_IDLE_TIMEOUT_S` | `600` | Azure: leave unset |
| `MLX_SERVER_STARTUP_TIMEOUT_S` | `90` | Azure: leave unset |
| `MLX_SERVER_HEALTH_POLL_S` | `2.0` | Azure: leave unset |

### 2h — Lip Sync / Wav2Lip (Optional — local video pipeline)

> These path variables only matter if Wav2Lip is installed in the container image.

| Variable | Default | Description |
|---|---|---|
| `WAV2LIP_CHECKPOINT` | `~/.cache/wav2lip/wav2lip_gan.pth` | Path to Wav2Lip GAN model checkpoint |
| `WAV2LIP_DIR` | `~/.cache/wav2lip` | Directory where Wav2Lip weights are cached |

### 2i — Worker Identity and Polling

| Variable | Required | Default | Description |
|---|---|---|---|
| `WORKER_ID` | No | `worker-0` | Identity label for this container instance; set to `worker-1`, `worker-2`, etc. for parallel scaling |
| `ENV_FILE` | No | `.env` | Path to the env file to load; set per container for multi-worker deployments |
| `POLL_INTERVAL_SECONDS` | No | `30` | How often the worker polls Neon for pending `compute_jobs` |
| `COMPOSE_CONCURRENCY` | No | `15` | Max concurrent Stage 4 HTML composition tasks per worker |
| `STAGE1_PERSONA_MAX_RETRIES` | No | `2` | Max LLM retries for persona generation in Stage 1 |

---

## Part 3 — Variables That Must Change for Azure

These are the variables that contain provider-specific values and **must** be updated when moving off Vercel / Neon.

| Variable | Change Required | From | To |
|---|---|---|---|
| `DATABASE_URL` | Yes — if migrating off Neon | `ep-*.neon.tech` Neon connection string | Azure Database for PostgreSQL Flexible Server connection string |
| `BLOB_READ_WRITE_TOKEN` | Yes — if migrating off Vercel Blob | `vercel_blob_rw_*` token | Azure Blob SAS token (or replace with `AZURE_STORAGE_CONNECTION_STRING` + code change) |
| `BLOB_STORE_ID` | Yes — if migrating off Vercel Blob | Vercel store ID | Azure Storage account/container name |
| `NEXT_PUBLIC_APP_URL` / `APP_URL` | Yes | `https://nova-intake.vercel.app` | Azure / custom domain URL |

> **Recommendation:** Keep Neon for now. Neon is already hosted on Azure (eastus2 region) — the connection string stays the same. This avoids a DB migration and keeps the setup simple for the initial Azure Container Apps deployment of the worker.

---

## Part 4 — Minimum Viable Set (Day 1 Azure Deployment)

The following is the smallest set of variables required to run the full pipeline end-to-end. Platform ad integrations, video pipeline, and optional AI services can be added incrementally.

### Frontend (Vercel or Azure App Service)
```
DATABASE_URL
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
OPENROUTER_API_KEY
NVIDIA_NIM_API_KEY
BLOB_READ_WRITE_TOKEN
TEAMS_WEBHOOK_URL
NEXT_PUBLIC_APP_URL
```

### Worker (Azure Container Apps)
```
DATABASE_URL
OPENROUTER_API_KEY
BLOB_READ_WRITE_TOKEN
NVIDIA_NIM_API_KEY
TEAMS_WEBHOOK_URL
APP_URL
WORKER_ID
POLL_INTERVAL_SECONDS=30
```
