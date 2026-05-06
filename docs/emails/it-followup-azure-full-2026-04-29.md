# Follow-Up Email to IT — Full Azure Setup + Microsoft Integrations

**Copy below the line and send as reply:**

---

Hi team,

Thank you for provisioning the resource group — everything looks great. We've already verified access and confirmed the Container App, ACR, and networking are all working. Quick update on where we are and a few questions.

---

**1. Container Image — Pushed**

Our worker image is now live in the registry:

- `novacert.azurecr.io/onetake-worker:latest`
- `novacert.azurecr.io/onetake-worker:1b0c28d`

GitHub Actions CI/CD is configured to automatically build and push on every merge to main, so the ACR will always have the latest image. The nginx test container can be swapped for `onetake-worker:latest` whenever you're ready.

---

**2. Database — PostgreSQL 17**

We're currently running **PostgreSQL 17.8** on Neon, so we'd like **PostgreSQL 17** on Azure Flexible Server to maintain version parity. Requirements are minimal:

- No extensions needed (built-in features only: JSONB, gen_random_uuid, GIN indexes, FOR UPDATE SKIP LOCKED)
- Burstable tier is fine to start
- 32 GB storage
- Enforce SSL (`sslmode=require`)
- Single-node, no HA needed at this stage

Once provisioned, we just need the connection string:
`postgresql://<user>:<password>@<server>.postgres.database.azure.com:5432/<dbname>?sslmode=require`

---

**3. Container App Configuration**

The worker is a background polling daemon (no HTTP listener). It polls the database for jobs, processes them using external AI APIs, and writes results back. Configuration needs:

- **Image:** `novacert.azurecr.io/onetake-worker:latest`
- **CPU / Memory:** 2 vCPU / 4 GiB (preferred) — currently set to 0.5 / 1 GiB
- **Min replicas:** 1 (always-on)
- **Ingress:** Can be disabled — the worker has no HTTP endpoint
- **Environment variables:** 8 required (listed below). We'll provide all secret values — just need to know where to set them (Container App env vars or Key Vault references).

| Variable | Type | Description |
|---|---|---|
| `DATABASE_URL` | Secret | PostgreSQL connection string (from #2 above) |
| `OPENROUTER_API_KEY` | Secret | AI model API key (we provide) |
| `NVIDIA_NIM_API_KEY` | Secret | NVIDIA inference API key (we provide) |
| `BLOB_READ_WRITE_TOKEN` | Secret | File storage token (we provide) |
| `TEAMS_WEBHOOK_URL` | Secret | MS Teams webhook (we provide) |
| `APP_URL` | Plain | `https://onetake.oneforma.com` |
| `WORKER_ID` | Plain | `worker-0` |
| `POLL_INTERVAL_SECONDS` | Plain | `30` |

---

**4. Clerk SSO — Azure AD / Entra ID Integration**

Our frontend uses [Clerk](https://clerk.com) for authentication. We need to connect Clerk to Centific's Azure AD (Entra ID) so the team can sign in with their Microsoft accounts via SAML SSO. This requires:

- **An Enterprise Application** in Azure AD configured as a SAML identity provider for Clerk
- Clerk provides the **ACS URL** and **Entity ID** — we just need someone with Azure AD admin access to create the Enterprise App and paste in those values
- Once connected, any `@centific.com` / `@oneforma.com` user can sign into OneTake with their existing Microsoft credentials

**Question:** Can you help us set up the SAML Enterprise Application, or should we coordinate directly with whoever manages Azure AD / Entra ID? Happy to provide the Clerk SAML configuration values.

---

**5. Active Directory / Microsoft Graph API Access**

The app registration (`azc-sp-onetake-dev-deployment`) currently has the default `User.Read` permission. For the features on our roadmap, we'll need additional Microsoft Graph API permissions:

**SharePoint (campaign asset organization):**
- When a campaign is approved, the app auto-creates a folder structure in SharePoint and uploads the approved creatives, briefs, and tracking documents
- Permissions needed: `Sites.ReadWrite.All` or `Files.ReadWrite.All` (application-level)
- Target: A designated SharePoint site/document library (e.g., "OneForma Marketing / Campaigns")

**Teams Notifications (richer than webhooks):**
- Currently using incoming webhooks, but Graph API enables adaptive cards, channel posting, and activity feed notifications
- Permissions needed: `ChannelMessage.Send`, `Team.ReadBasic.All`

**Outlook (automated email delivery):**
- Send approval notifications, designer briefs, and agency packages via Outlook
- Permissions needed: `Mail.Send` (application-level, scoped to a service account / shared mailbox)

**Active Directory (user/group lookup):**
- Look up team members, roles, and org structure for routing and access control
- Permissions needed: `User.Read.All`, `Group.Read.All` (application-level)

**Questions:**
1. Can we get these Graph API permissions added to the `azc-sp-onetake-dev-deployment` app registration? They'll need admin consent.
2. Do we have a designated SharePoint site we should use, or should we request one?
3. For Outlook, is there a shared mailbox we can send from (e.g., `marketing@oneforma.com` or `noreply@oneforma.com`)?

---

**Summary — What We Need From IT**

| Item | Status | Action |
|---|---|---|
| Resource group + ACR + Container App | Done | Thank you |
| Worker image in ACR | Done | Pushed today |
| PostgreSQL 17 Flexible Server | Requested | Please provision |
| Container App env vars | Ready to set | We provide values once DB is up |
| Swap nginx for worker image | Ready | Can do once env vars are set |
| Clerk SAML Enterprise App | Requested | Need Azure AD admin |
| Graph API permissions (SharePoint, Teams, Outlook, AD) | Requested | Need admin consent |
| SharePoint site designation | Question | Where should campaign assets go? |
| Shared mailbox for Outlook | Question | For automated email delivery |

I've attached a full technical spec document with networking requirements, optional environment variables, and CI/CD details for reference.

Happy to jump on a call to walk through any of this.

Thanks,
Steven Junop
Digital Marketing Manager — OneForma / Centific
