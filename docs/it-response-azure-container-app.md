# Azure Container App Setup — OneTake Worker

**Date:** 2026-04-29
**From:** Steven Junop, Pengfei, Michael
**Re:** Resource group provisioning follow-up

---

## Summary

Thank you for provisioning the resource group, ACR, and Container App. Here is what we need to go live.

---

## 1. Container Image (Ready)

We are pushing to ACR now:

```
Registry:   novacert.azurecr.io
Image:      novacert.azurecr.io/onetake-worker:latest
Platform:   linux/amd64
```

The current nginx test container can be replaced with this image once the push completes. CI/CD (GitHub Actions) will auto-push new builds on every merge to `main`.

---

## 2. PostgreSQL Server Requirements

**PostgreSQL 17 please — we're running 17.4 on Neon today and want version parity.**

| Requirement | Value |
|---|---|
| **Version** | 17 |
| **Extensions** | None — we use only built-in features |
| **Tier** | Burstable (B-series) is fine to start |
| **Storage** | 32 GB |
| **SSL** | Enforce `sslmode=require` |
| **High Availability** | Not required (single-node) |
| **Backup** | Default retention (7 days) is fine |

**Features we use (all standard, no extensions):**
- `gen_random_uuid()` (built-in PG13+)
- `JSONB` columns with operators
- `FOR UPDATE SKIP LOCKED` (job queue pattern)
- `GIN` index (one, on array column)
- `ON CONFLICT` (upsert)
- `TEXT[]` array types

**What we need back:** Connection string in this format:
```
postgresql://<user>:<password>@<server>.postgres.database.azure.com:5432/<dbname>?sslmode=require
```

---

## 3. Container App Environment Variables

### Required (Day 1 — must be set for the worker to run)

| Variable | Type | Description |
|---|---|---|
| `DATABASE_URL` | Secret | PostgreSQL connection string (see above) |
| `OPENROUTER_API_KEY` | Secret | AI model API key (we provide the value) |
| `NVIDIA_NIM_API_KEY` | Secret | NVIDIA inference API key (we provide the value) |
| `BLOB_READ_WRITE_TOKEN` | Secret | File storage token (we provide the value) |
| `TEAMS_WEBHOOK_URL` | Secret | MS Teams notification webhook (we provide the value) |
| `APP_URL` | Plain | App base URL, e.g. `https://nova.oneforma.com` |
| `WORKER_ID` | Plain | `worker-0` |
| `POLL_INTERVAL_SECONDS` | Plain | `30` |

### Optional (can add later — features degrade gracefully without these)

| Variable | Feature it enables |
|---|---|
| `NVIDIA_NIM_VQA_KEY` | Creative quality evaluation (separate NIM key for rate limits) |
| `NIM_EXTRA_KEYS` | Throughput scaling (comma-separated NIM key pool) |
| `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` | Video generation |
| `ELEVENLABS_API_KEY` | Voice synthesis |
| `WP_SITE_URL` + `WP_USERNAME` + `WP_APP_PASSWORD` | WordPress auto-publish |
| `GEMINI_API_KEY` | Image artifact cleanup fallback |

> **We will provide all secret values** — IT just needs to wire the Container App to read them (environment variables or Key Vault references).

---

## 4. Container App Configuration

| Setting | Value |
|---|---|
| **Image** | `novacert.azurecr.io/onetake-worker:latest` |
| **CPU / Memory** | 1 vCPU / 2 GiB (minimum) — 2 vCPU / 4 GiB recommended |
| **Min replicas** | 1 (always-on polling worker) |
| **Max replicas** | 1 (scale manually if needed) |
| **Ingress** | Not required — worker is a background poller, no HTTP endpoint |
| **Health check** | Built into the image (`HEALTHCHECK` in Dockerfile) |
| **Restart policy** | Always |

---

## 5. Networking

The worker makes **outbound** connections only:

| Destination | Port | Purpose |
|---|---|---|
| Azure PostgreSQL (same RG) | 5432 | Job polling + result writes |
| `integrate.api.nvidia.com` | 443 | AI model inference (NVIDIA NIM) |
| `openrouter.ai` | 443 | Image generation + LLM fallback |
| `*.public.blob.vercel-storage.com` | 443 | Asset uploads (Vercel Blob — will migrate to Azure Blob later) |
| MS Teams webhooks | 443 | Pipeline notifications |

**No inbound traffic required.** No public endpoint needed.

---

## 6. CI/CD (Already Configured)

GitHub Actions workflow pushes to ACR automatically:

- **On PR to main:** Docker build only (validates image)
- **On push to main:** Build + push to `novacert.azurecr.io/onetake-worker:latest` + git SHA tag
- **Secrets already set:** `ACR_USERNAME`, `ACR_PASSWORD` in GitHub repo

The Container App can pull the latest image on each push via ACR webhook or manual restart.

---

## Next Steps

1. **IT provisions PostgreSQL 16** → sends us the connection string
2. **IT sets the 8 required env vars** on the Container App (we provide secret values)
3. **We replace nginx with the real image** → `novacert.azurecr.io/onetake-worker:latest`
4. **Verify end-to-end** — trigger a test job, confirm worker picks it up
