# Reply to IT — PG17 Received + Graph API Correction

**Copy below the line and send as reply:**

---

Hi team,

Thank you for provisioning the PostgreSQL server — we've already connected and verified everything is working. Quick update on where things stand and one correction on the Graph API permissions.

---

**1. PostgreSQL 17 — Connected & Verified**

We've connected to `onetake-pg-west01.postgres.database.azure.com` and confirmed:
- PostgreSQL 17.9 — running perfectly
- All features we need are working (JSONB, gen_random_uuid, GIN indexes, FOR UPDATE SKIP LOCKED)
- Added our development IP to the firewall (73.1.31.109)
- We'll run the schema migration and seed data this week

Thank you — this was the main blocker.

---

**2. Container App — We'll Handle Configuration**

Thank you for confirming we can manage the Container App settings ourselves. We'll:
- Set the 8 environment variables (DATABASE_URL + 7 others)
- Swap the image from nginx to `novacert.azurecr.io/onetake-worker:latest`
- Adjust CPU/memory to 2 vCPU / 4 GiB

We'll do this once the schema migration is verified. No action needed from IT.

---

**3. Graph API Permissions — Correction**

You're right that `ChannelMessage.Send` doesn't appear in the standard application permissions list — it's a resource-specific consent (RSC) permission that works differently. **We don't need it.** We're already using Teams incoming webhooks for notifications, which work well and require no Graph API permissions.

**Updated permissions request (4 instead of 5):**

| Permission | Type | Purpose |
|---|---|---|
| `Sites.ReadWrite.All` | Application | Auto-organize campaign assets in SharePoint |
| `Mail.Send` | Application | Send approval notifications via Outlook |
| `User.Read.All` | Application | Look up team members for routing |
| `Group.Read.All` | Application | Look up team groups for access control |

These are all standard application permissions in the Azure AD portal under **API Permissions → Microsoft Graph → Application permissions**. They'll need admin consent after being added.

Can these be added to the existing `azc-sp-onetake-dev-deployment` app registration (client ID: 53dce4f5-8c80-4ed8-be44-625ea0966d22)?

---

**4. Clerk Authentication — OAuth Instead of SAML**

Regarding the Clerk SSO request — we've evaluated the options and can use **Microsoft OAuth** (social login) instead of SAML. This is simpler to set up and doesn't require a SAML Enterprise Application.

What we need on the existing app registration (`azc-sp-onetake-dev-deployment`):
- **Add a redirect URI:** `https://allowing-hedgehog-42.clerk.accounts.dev/v1/oauth_callback`
- **Platform:** Web
- **Supported account types:** Accounts in this organizational directory only (Single tenant — Centific/OneForma)
- **Generate a client secret** (we'll add it to Clerk's dashboard)

This lets the team sign in with their Microsoft credentials through our app. We handle access control at the application level — only users with an assigned role can access features.

If you're able to add the redirect URI and generate a client secret on the app registration, that's all we need. Otherwise, happy to submit a formal request to IThelpdesk.

---

**5. DNS — Unified Frontend Domain**

The OneTake frontend is hosted on Vercel. We'd like `onetake.oneforma.com` to serve the frontend app (the Azure Container App handles backend processing only). This requires two DNS records in Cloudflare:

| Type | Name | Value | Purpose |
|---|---|---|---|
| **TXT** | `_vercel.oneforma.com` | `vc-domain-verify=onetake.oneforma.com,5a5c1fefd9ed1454687b` | Domain ownership verification |
| **CNAME** | `onetake` | `cname.vercel-dns.com` | Point frontend to Vercel |

Once these are added, the app will be accessible at `https://onetake.oneforma.com` with automatic SSL via Vercel.

---

**6. Still Outstanding**

| Item | Status |
|---|---|
| Graph API permissions (4 listed above) | Needs admin consent |
| OAuth redirect URI on app registration | Needs to be added (see #4) |
| DNS records for `onetake.oneforma.com` (see #5) | 1 TXT + 1 CNAME in Cloudflare |
| `go.oneforma.com` CNAME → `cname.vercel-dns.com` | Separate DNS request — still pending |
| Shared mailbox (`noreply@oneforma.com` or similar) | For automated Outlook notifications |
| SharePoint site designation | Which site/library should campaign assets go to? |

---

**Beta Launch Target: Monday May 5**

With the database now live, we're on track. The remaining items (Graph API permissions, OAuth, shared mailbox, DNS) are nice-to-haves for beta — the core pipeline works without them.

Thanks again for the quick turnaround on the database.

Steven Junop
Digital Marketing Manager — OneForma / Centific
