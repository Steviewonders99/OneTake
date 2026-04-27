# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 19 security vulnerabilities identified in the audit — auth bypass, IDOR, XSS, exposed secrets, and hardening issues.

**Architecture:** Three phases. Phase 1 fixes critical auth/authorization gaps using existing `requireRole()` and `canEditRequest()` helpers. Phase 2 installs `isomorphic-dompurify` and sanitizes all `dangerouslySetInnerHTML` usage. Phase 3 hardens the worker, postMessage, redirect validation, and removes hardcoded credentials from scripts.

**Tech Stack:** Next.js 16 (TypeScript), Python 3 (asyncpg), Clerk auth, isomorphic-dompurify (new dependency)

---

## Phase 1: Critical Auth & Authorization (Tasks 1-7)

### Task 1: Add role + ownership checks to approval endpoint

**Files:**
- Modify: `src/app/api/approve/[id]/route.ts:25-32`

The approval endpoint only checks `auth()` for a userId but never verifies the user's role. Any authenticated user can approve any request through all 3 stages. Fix: use `getAuthContext()` and add role checks per approval type.

- [ ] **Step 1: Add role-based authorization to the approval endpoint**

Replace lines 1-32 of `src/app/api/approve/[id]/route.ts`:

```typescript
import { getAuthContext, canAccessRequest } from '@/lib/permissions';
import { getIntakeRequest, updateIntakeRequest } from '@/lib/db/intake';
import { createApproval } from '@/lib/db/approvals';
import { createMagicLink } from '@/lib/db/magic-links';
import { notifyDesignerAssigned } from '@/lib/notifications/teams';
import { getDb } from '@/lib/db';

/**
 * 3-Stage Approval Flow:
 *
 * Stage 1: Marketing approves (status: generating -> review)
 *   -> role: admin only
 *   -> Notifies designer (Miguel) via Teams
 *   -> Designer magic link generated
 *
 * Stage 2: Designer approves (status: review -> approved)
 *   -> role: admin or designer
 *   -> Notifies marketing manager (Steven) via Teams
 *
 * Stage 3: Final approval (status: approved -> sent)
 *   -> role: admin only
 *   -> Agency magic link generated
 *   -> Recruiters can now see the creatives
 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const intakeRequest = await getIntakeRequest(id);

    if (!intakeRequest) {
      return Response.json({ error: 'Intake request not found' }, { status: 404 });
    }

    // Verify the user can at least access this request
    if (!canAccessRequest(ctx, intakeRequest.created_by)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const approvalType: string = body.approval_type || 'marketing';

    // Role gates per approval stage
    const ALLOWED_ROLES: Record<string, string[]> = {
      marketing: ['admin'],
      designer: ['admin', 'designer'],
      final: ['admin'],
    };

    const allowed = ALLOWED_ROLES[approvalType];
    if (!allowed) {
      return Response.json({ error: 'Invalid approval_type' }, { status: 400 });
    }
    if (!allowed.includes(ctx.role)) {
      return Response.json({ error: 'Forbidden: insufficient role for this approval stage' }, { status: 403 });
    }

    const sql = getDb();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
```

The rest of the file (from `// -- Stage 1: Marketing Approval --` onward) stays unchanged, except replace `userId` with `ctx.userId` in the two `createApproval` calls inside Stage 1, 2, and 3 blocks.

- [ ] **Step 2: Replace userId references with ctx.userId in the approval blocks**

In the same file, find all 3 occurrences of `approved_by: userId` and replace with `approved_by: ctx.userId`. There are exactly 3: lines 55, 95, and 147.

- [ ] **Step 3: Verify the app compiles**

Run: `cd /Users/stevenjunop/centric-intake && npx next build 2>&1 | tail -20`
Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/approve/[id]/route.ts
git commit -m "fix(security): add role-based authorization to approval endpoint"
```

---

### Task 2: Add ownership checks to intake PATCH/DELETE

**Files:**
- Modify: `src/app/api/intake/[id]/route.ts:44-122`

The GET handler properly uses `getAuthContext()` + `canAccessRequest()`, but PATCH and DELETE use raw `auth()` with no ownership check. Fix: mirror the GET pattern and add `canEditRequest()` for PATCH.

- [ ] **Step 1: Replace PATCH handler with ownership-checked version**

Replace lines 44-88 of `src/app/api/intake/[id]/route.ts`:

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await getIntakeRequest(id);
    if (!existing) {
      return Response.json(
        { error: 'Intake request not found' },
        { status: 404 }
      );
    }

    if (!canEditRequest(ctx, existing.created_by, existing.status)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const updated = await updateIntakeRequest(id, {
      title: body.title,
      task_type: body.task_type,
      urgency: body.urgency,
      target_languages: body.target_languages,
      target_regions: body.target_regions,
      volume_needed: body.volume_needed,
      status: body.status,
      form_data: body.form_data,
      schema_version: body.schema_version,
    });

    return Response.json(updated);
  } catch (error) {
    console.error('[api/intake/[id]] Failed to update intake request:', error);
    return Response.json(
      { error: 'Failed to update intake request' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Replace DELETE handler with ownership-checked version**

Replace lines 90-122:

```typescript
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await getIntakeRequest(id);
    if (!existing) {
      return Response.json(
        { error: 'Intake request not found' },
        { status: 404 }
      );
    }

    // Only admin can delete, or recruiter who owns it and it's still draft
    if (!canEditRequest(ctx, existing.created_by, existing.status)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteIntakeRequest(id);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[api/intake/[id]] Failed to delete intake request:', error);
    return Response.json(
      { error: 'Failed to delete intake request' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Update imports**

Replace line 1-2 imports:

```typescript
import { getAuthContext, canAccessRequest, canEditRequest } from '@/lib/permissions';
import {
  getIntakeRequest,
  updateIntakeRequest,
  deleteIntakeRequest,
} from '@/lib/db/intake';
```

Remove the `import { auth } from '@clerk/nextjs/server';` line — no longer needed.

- [ ] **Step 4: Verify build**

Run: `cd /Users/stevenjunop/centric-intake && npx next build 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/intake/[id]/route.ts
git commit -m "fix(security): add ownership checks to intake PATCH/DELETE endpoints"
```

---

### Task 3: Add ownership check to Figma connect endpoint

**Files:**
- Modify: `src/app/api/figma/connect/route.ts:14-18`

Any authenticated user can save a Figma token to any request_id. Fix: verify the user can access the request before updating.

- [ ] **Step 1: Add auth context and ownership check**

Replace lines 1-18 of `src/app/api/figma/connect/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { getAuthContext, canEditRequest } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { getIntakeRequest } from "@/lib/db/intake";
import { createFigmaClient, extractFileKey } from "@/lib/figma-client";

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
```

- [ ] **Step 2: Add ownership check after request_id validation**

After the `if (!figma_url ...)` block (around line 38), insert:

```typescript
  // Verify user can edit this request
  const intakeRequest = await getIntakeRequest(request_id);
  if (!intakeRequest) {
    return Response.json({ error: "Intake request not found" }, { status: 404 });
  }
  if (!canEditRequest(ctx, intakeRequest.created_by, intakeRequest.status)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/stevenjunop/centric-intake && npx next build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/figma/connect/route.ts
git commit -m "fix(security): add ownership check to Figma connect endpoint"
```

---

### Task 4: Fix designer upload/notes IDOR — require token match OR ownership

**Files:**
- Modify: `src/app/api/designer/[id]/upload/route.ts:37-43`
- Modify: `src/app/api/designer/[id]/notes/route.ts:31-37,98-104`

These endpoints fall through to `if (userId) authorized = true` — any logged-in user can upload/note on any request. Fix: when using Clerk auth (no magic link), verify the user can access the request.

- [ ] **Step 1: Fix designer upload auth fallback**

In `src/app/api/designer/[id]/upload/route.ts`, replace lines 37-43:

```typescript
    if (!authorized) {
      try {
        const { auth } = await import('@clerk/nextjs/server');
        const { userId } = await auth();
        if (userId) {
          // Clerk user must have access to this request
          const { getAuthContext, canAccessRequest } = await import('@/lib/permissions');
          const { getIntakeRequest } = await import('@/lib/db/intake');
          const ctx = await getAuthContext();
          const intake = await getIntakeRequest(id);
          if (ctx && intake && canAccessRequest(ctx, intake.created_by)) {
            authorized = true;
          }
        }
      } catch {}
    }
```

- [ ] **Step 2: Fix designer notes POST auth fallback**

In `src/app/api/designer/[id]/notes/route.ts`, replace lines 31-37 (the POST handler's fallback):

```typescript
    if (!authorized) {
      try {
        const { auth } = await import('@clerk/nextjs/server');
        const { userId } = await auth();
        if (userId) {
          const { getAuthContext, canAccessRequest } = await import('@/lib/permissions');
          const { getIntakeRequest } = await import('@/lib/db/intake');
          const ctx = await getAuthContext();
          const intake = await getIntakeRequest(id);
          if (ctx && intake && canAccessRequest(ctx, intake.created_by)) {
            authorized = true;
          }
        }
      } catch {}
    }
```

- [ ] **Step 3: Fix designer notes GET auth fallback**

In the same file, replace lines 98-104 (the GET handler's fallback) with the same pattern as Step 2.

- [ ] **Step 4: Verify build**

Run: `cd /Users/stevenjunop/centric-intake && npx next build 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/designer/[id]/upload/route.ts src/app/api/designer/[id]/notes/route.ts
git commit -m "fix(security): require ownership check on designer upload/notes Clerk fallback"
```

---

### Task 5: Invalidate magic links after first use

**Files:**
- Modify: `src/lib/db/magic-links.ts:22-29`

`validateMagicLink()` checks expiry but never marks tokens as used. `deleteMagicLink()` exists but is never called. Fix: delete the token after successful validation so it's single-use.

- [ ] **Step 1: Make validateMagicLink consume the token**

Replace `validateMagicLink` in `src/lib/db/magic-links.ts`:

```typescript
export async function validateMagicLink(token: string): Promise<MagicLink | null> {
  const sql = getDb();
  // Atomically fetch and delete — single-use token
  const rows = await sql`
    DELETE FROM magic_links
    WHERE token = ${token} AND expires_at > NOW()
    RETURNING *
  `;
  return (rows[0] as MagicLink) ?? null;
}
```

This atomic DELETE...RETURNING ensures the token can only be used once — concurrent requests race on the same row and only one wins.

- [ ] **Step 2: Update designer endpoints to cache the validated token for the session**

The designer portal makes multiple API calls with the same token. Since we now consume it on first use, the designer endpoints need to work differently. The simplest fix: the designer frontend already receives the token once and passes it on each request. Instead of consuming on every API call, we should only consume on the **submit-finals** endpoint (the terminal action). Revert `validateMagicLink` to non-destructive and add a new `consumeMagicLink`:

```typescript
export async function validateMagicLink(token: string): Promise<MagicLink | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM magic_links
    WHERE token = ${token} AND expires_at > NOW() AND used_at IS NULL
  `;
  return (rows[0] as MagicLink) ?? null;
}

export async function consumeMagicLink(token: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE magic_links SET used_at = NOW() WHERE token = ${token}
  `;
}
```

- [ ] **Step 3: Add used_at column to magic_links table**

Create a migration by adding to `src/lib/db/magic-links.ts` at the top, after imports:

Actually — add this as a one-time migration. Create the file `scripts/add-magic-link-used-at.mjs`:

```javascript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ DEFAULT NULL`;

console.log('Added used_at column to magic_links');
```

- [ ] **Step 4: Call consumeMagicLink in submit-finals**

In `src/app/api/designer/[id]/submit-finals/route.ts`, after the successful `validateMagicLink` check (line 18), add:

```typescript
    import { consumeMagicLink } from '@/lib/db/magic-links';
    // ... after validation succeeds:
    await consumeMagicLink(token);
```

Add the import at the top of the file alongside the existing `validateMagicLink` import:

```typescript
import { validateMagicLink, consumeMagicLink } from '@/lib/db/magic-links';
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/stevenjunop/centric-intake && npx next build 2>&1 | tail -20`

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/magic-links.ts src/app/api/designer/[id]/submit-finals/route.ts scripts/add-magic-link-used-at.mjs
git commit -m "fix(security): add single-use magic link validation with used_at tracking"
```

---

### Task 6: Remove hardcoded database credentials from scripts

**Files:**
- Modify: `scripts/init-db.mjs:3`
- Modify: `scripts/seed-design-artifacts.mjs:28-29`
- Modify: `scripts/verify-composition-engine.mjs` (find the hardcoded line)

These scripts have the Neon connection string hardcoded in committed source. Fix: read from `process.env.DATABASE_URL` with dotenv.

- [ ] **Step 1: Fix init-db.mjs**

Replace line 3 of `scripts/init-db.mjs`:

```javascript
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);
```

If `dotenv` is not available, use:

```javascript
const sql = neon(process.env.DATABASE_URL || (() => { throw new Error('DATABASE_URL env var required'); })());
```

- [ ] **Step 2: Fix seed-design-artifacts.mjs**

Find the hardcoded connection string (around line 28-29) and replace:

```javascript
const sql = neon(process.env.DATABASE_URL || (() => { throw new Error('DATABASE_URL env var required'); })());
```

- [ ] **Step 3: Fix verify-composition-engine.mjs**

Same pattern — find the hardcoded connection string and replace with `process.env.DATABASE_URL`.

- [ ] **Step 4: Commit**

```bash
git add scripts/init-db.mjs scripts/seed-design-artifacts.mjs scripts/verify-composition-engine.mjs
git commit -m "fix(security): remove hardcoded database credentials from scripts"
```

---

### Task 7: Tighten middleware public routes

**Files:**
- Modify: `src/middleware.ts`

The `/r(.*)` pattern is overly broad — it matches `/recruiter`, `/review`, etc. The landing page route `/lp/(.*)` is missing (already public by design but should be explicit). Fix: make patterns more specific.

- [ ] **Step 1: Update public route patterns**

Replace the `isPublicRoute` matcher in `src/middleware.ts`:

```typescript
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/schemas(.*)",
  "/api/registries(.*)",
  "/api/designer(.*)",
  "/designer(.*)",
  "/r/[a-zA-Z0-9]{6}",
  "/lp(.*)",
]);
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/stevenjunop/centric-intake && npx next build 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "fix(security): tighten middleware public route patterns"
```

---

## Phase 2: XSS Fixes (Tasks 8-11)

### Task 8: Install isomorphic-dompurify

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install the dependency**

Run: `cd /Users/stevenjunop/centric-intake && npm install isomorphic-dompurify`

- [ ] **Step 2: Create a sanitize utility**

Create `src/lib/sanitize.ts`:

```typescript
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML — strips scripts, event handlers, and dangerous tags.
 * Safe for use with dangerouslySetInnerHTML.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'blockquote',
      'pre', 'code', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'style', 'width', 'height'],
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/lib/sanitize.ts
git commit -m "feat(security): add isomorphic-dompurify HTML sanitization utility"
```

---

### Task 9: Sanitize EditableField dangerouslySetInnerHTML

**Files:**
- Modify: `src/components/EditableField.tsx:119-121`

The `value` prop is rendered raw via `dangerouslySetInnerHTML`. Fix: sanitize before rendering.

- [ ] **Step 1: Add import and sanitize the value**

Add import at top of `src/components/EditableField.tsx`:

```typescript
import { sanitizeHtml } from '@/lib/sanitize';
```

Replace lines 119-121:

```typescript
          dangerouslySetInnerHTML={{
            __html: value ? sanitizeHtml(value) : `<span class="text-[var(--muted-foreground)] italic">${placeholder}</span>`,
          }}
```

The `placeholder` is a developer-supplied string prop, not user input — safe to use directly.

- [ ] **Step 2: Verify build**

Run: `cd /Users/stevenjunop/centric-intake && npx next build 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/EditableField.tsx
git commit -m "fix(security): sanitize EditableField HTML output with DOMPurify"
```

---

### Task 10: Sanitize ArtifactPreview usage_snippet

**Files:**
- Modify: `src/app/admin/artifacts/page.tsx:84`

`artifact.usage_snippet` from the database is rendered via `dangerouslySetInnerHTML`. Fix: sanitize it.

- [ ] **Step 1: Add import and sanitize**

Add import to `src/app/admin/artifacts/page.tsx`:

```typescript
import { sanitizeHtml } from '@/lib/sanitize';
```

Replace line 84:

```typescript
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(artifact.usage_snippet) }}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/stevenjunop/centric-intake && npx next build 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/artifacts/page.tsx
git commit -m "fix(security): sanitize artifact usage_snippet HTML rendering"
```

---

### Task 11: Fix CreativeHtmlEditor innerHTML injection

**Files:**
- Modify: `src/components/CreativeHtmlEditor.tsx:126-128`

The `msg.text` from postMessage is assigned directly to `el.innerHTML`. Fix: use `textContent` instead (the text is always plain text from the textarea control, not HTML).

- [ ] **Step 1: Replace innerHTML with textContent**

In `src/components/CreativeHtmlEditor.tsx`, find the iframe injection script (around line 120-128). This is inside a template string that creates the iframe's JavaScript. Replace:

```javascript
        el.textContent = msg.text;
        // Also update innerHTML if it had spans
        if (msg.text && el.children.length > 0) {
          el.innerHTML = msg.text;
        }
```

With:

```javascript
        el.textContent = msg.text;
```

Remove the innerHTML branch entirely — `textContent` is always safe and is the correct behavior for updating text from the editor textarea.

- [ ] **Step 2: Fix postMessage wildcard origins**

In the same file, find all `postMessage({...}, "*")` calls (the ones in React components, not the iframe script). Replace `"*"` with `window.location.origin`:

Find:
```typescript
iframeRef.current?.contentWindow?.postMessage(
  { type: "update-text", role, text },
  "*"
);
```

Replace with:
```typescript
iframeRef.current?.contentWindow?.postMessage(
  { type: "update-text", role, text },
  window.location.origin
);
```

Do the same for all other `postMessage({...}, "*")` calls in the React component code (not the iframe script — the iframe must use `"*"` to talk to parent since it's a srcdoc iframe).

- [ ] **Step 3: Verify build**

Run: `cd /Users/stevenjunop/centric-intake && npx next build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/components/CreativeHtmlEditor.tsx
git commit -m "fix(security): remove innerHTML injection + tighten postMessage origins"
```

---

## Phase 3: Hardening (Tasks 12-16)

### Task 12: Remove SQL f-string interpolation in Python worker

**Files:**
- Modify: `worker/neon_client.py:542-573`

The `upsert_campaign_landing_page` function uses f-string to inject a column name into SQL. While protected by an allowlist, it's fragile. Fix: use static SQL per field.

- [ ] **Step 1: Replace with static SQL mapping**

Replace lines 542-573 of `worker/neon_client.py`:

```python
async def upsert_campaign_landing_page(
    request_id: str,
    field: str,
    value: str,
) -> None:
    """Upsert a single field in campaign_landing_pages."""
    QUERIES = {
        "job_posting_url": """
            INSERT INTO campaign_landing_pages (id, request_id, job_posting_url, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
            ON CONFLICT (request_id) DO UPDATE SET job_posting_url = $2, updated_at = NOW()
        """,
        "landing_page_url": """
            INSERT INTO campaign_landing_pages (id, request_id, landing_page_url, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
            ON CONFLICT (request_id) DO UPDATE SET landing_page_url = $2, updated_at = NOW()
        """,
        "ada_form_url": """
            INSERT INTO campaign_landing_pages (id, request_id, ada_form_url, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
            ON CONFLICT (request_id) DO UPDATE SET ada_form_url = $2, updated_at = NOW()
        """,
    }
    query = QUERIES.get(field)
    if not query:
        raise ValueError(f"Invalid field: {field}. Must be one of {set(QUERIES)}")

    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(query, request_id, value)
    logger.info("Upserted campaign_landing_pages.%s for %s", field, request_id[:8])
```

- [ ] **Step 2: Commit**

```bash
git add worker/neon_client.py
git commit -m "fix(security): replace SQL f-string interpolation with static query mapping"
```

---

### Task 13: Replace os.system with subprocess in sandbox_compositor

**Files:**
- Modify: `worker/sandbox_compositor.py:275`

`os.system(f"open {r['file']}")` is a shell injection vector. Fix: use `subprocess.run`.

- [ ] **Step 1: Replace os.system call**

In `worker/sandbox_compositor.py`, replace line 275:

```python
            subprocess.run(["open", r["file"]], check=False)
```

Also add `import subprocess` at the top of the file if not already present.

- [ ] **Step 2: Commit**

```bash
git add worker/sandbox_compositor.py
git commit -m "fix(security): replace os.system with subprocess.run in sandbox compositor"
```

---

### Task 14: Add URL validation to redirect endpoint

**Files:**
- Modify: `src/app/r/[slug]/route.ts:27`

`destination_url` from the database is used directly in `Response.redirect()`. Fix: validate it's an HTTP(S) URL.

- [ ] **Step 1: Add URL validation before redirect**

In `src/app/r/[slug]/route.ts`, replace line 27:

```typescript
  const destinationUrl = rows[0].destination_url;

  // Validate the URL is HTTP(S) to prevent protocol injection
  try {
    const parsed = new URL(destinationUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return notFoundResponse();
    }
  } catch {
    return notFoundResponse();
  }

  return Response.redirect(destinationUrl, 301);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/r/[slug]/route.ts
git commit -m "fix(security): validate redirect URL protocol in tracked links"
```

---

### Task 15: Add CSP header to landing page route

**Files:**
- Modify: `src/app/lp/[slug]/route.ts:75-81`

Landing page HTML from Blob is served without CSP headers. Fix: add a restrictive Content-Security-Policy.

- [ ] **Step 1: Add CSP header**

In `src/app/lp/[slug]/route.ts`, replace lines 75-81:

```typescript
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
        'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https:; frame-ancestors 'none';",
      },
    });
```

This blocks all JavaScript execution on the landing page while allowing styles and images.

- [ ] **Step 2: Commit**

```bash
git add src/app/lp/[slug]/route.ts
git commit -m "fix(security): add CSP header to landing page route to prevent XSS"
```

---

### Task 16: Wrap unsafe JSON.parse in try-catch in progress route

**Files:**
- Modify: `src/app/api/intake/[id]/progress/route.ts:57,63`

JSON.parse on database values without try-catch can crash the route. Fix: wrap in safe parser.

- [ ] **Step 1: Add safe JSON parse helper and fix the parse calls**

In `src/app/api/intake/[id]/progress/route.ts`, add a helper near the top of the file (inside the handler or before it):

```typescript
function safeJsonParse(val: unknown): unknown {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val ?? null;
}
```

Then replace lines 56-64:

```typescript
    const briefData = safeJsonParse(brief?.brief_data);
    const personas = (briefData as Record<string, unknown>)?.personas || [];
    const culturalResearch = (briefData as Record<string, unknown>)?.cultural_research || brief?.cultural_research || null;
    const designDirection = safeJsonParse(brief?.design_direction);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/intake/[id]/progress/route.ts
git commit -m "fix(security): wrap JSON.parse in try-catch for progress route"
```

---

### Task 17: Remove verbose error response in RFP extraction

**Files:**
- Modify: `src/app/api/extract/rfp/route.ts` (find `raw_response` in error JSON)

- [ ] **Step 1: Find and remove raw_response from error response**

Search for `raw_response` in the file and remove it from the JSON error response. Keep logging it server-side:

```typescript
    console.error('[extract/rfp] Failed to parse AI response:', rawResponse?.substring(0, 200));
    return Response.json({ error: 'Failed to parse extraction result from AI' }, { status: 500 });
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/extract/rfp/route.ts
git commit -m "fix(security): remove raw AI response from client-facing error"
```

---

### Task 18: Final build verification

- [ ] **Step 1: Full build check**

Run: `cd /Users/stevenjunop/centric-intake && npx next build 2>&1 | tail -30`
Expected: Build succeeds with 0 TypeScript errors.

- [ ] **Step 2: Run the migration for magic link used_at column**

Run: `cd /Users/stevenjunop/centric-intake && DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d'"' -f2) node scripts/add-magic-link-used-at.mjs`
Expected: "Added used_at column to magic_links"
