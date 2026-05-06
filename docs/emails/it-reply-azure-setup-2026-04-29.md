# Reply to IT — Azure Resource Group Setup

**Copy below the line and send as reply:**

---

Hi,

Thank you for setting up the resource group, ACR, and Container App — everything looks great.

**Container Image:** We're pushing our worker image to `novacert.azurecr.io/onetake-worker:latest` now. Once it lands, it can replace the nginx test container. GitHub Actions CI/CD is already configured to auto-push on every merge to main.

**Database:** We're currently on PostgreSQL 17 (17.4 on Neon), so we'd prefer **PostgreSQL 17** for version parity — avoids any surprises during migration. Our requirements are simple:

- No extensions needed (we only use built-in features: JSONB, gen_random_uuid, GIN indexes)
- Burstable tier is fine to start
- 32 GB storage
- Enforce SSL (`sslmode=require`)
- Single-node, no HA needed at this stage

Once provisioned, we just need the connection string:
`postgresql://<user>:<password>@<server>.postgres.database.azure.com:5432/<dbname>?sslmode=require`

**Container App config:** The worker is a background polling daemon — no inbound traffic or public endpoint required. It only makes outbound HTTPS calls (to our AI providers and the database). We need:

- **CPU/Memory:** 1 vCPU / 2 GiB minimum (2 vCPU / 4 GiB preferred)
- **Min replicas:** 1 (always-on)
- **Ingress:** Disabled (no HTTP listener)
- **8 environment variables** — we'll provide the secret values once the Container App is ready for config. The list:
  - `DATABASE_URL` (the Postgres connection string you provision)
  - `OPENROUTER_API_KEY` (we provide)
  - `NVIDIA_NIM_API_KEY` (we provide)
  - `BLOB_READ_WRITE_TOKEN` (we provide)
  - `TEAMS_WEBHOOK_URL` (we provide)
  - `APP_URL` = `https://nova.oneforma.com`
  - `WORKER_ID` = `worker-0`
  - `POLL_INTERVAL_SECONDS` = `30`

I've attached a full spec document with networking requirements, optional env vars for future features, and CI/CD details in case that's helpful.

Let me know once the database is provisioned and we'll get the env vars set and verify end-to-end.

Thanks,
Steven
