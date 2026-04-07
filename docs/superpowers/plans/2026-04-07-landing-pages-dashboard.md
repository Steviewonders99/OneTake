# Landing Pages Dashboard Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared `LandingPagesCard` component to both the marketing manager and designer dashboard preview panels, with 3 URL inputs (Job Posting, Landing Page, ADA Form) that persist to a new Neon table and sync between roles via 5-second polling.

**Architecture:** New relational table `campaign_landing_pages` with UNIQUE FK to `intake_requests`. New GET + PATCH API route. New shared React component mounted in two existing panels. Auto-save on blur, optimistic UI, focus-aware polling. All client-side logic; no worker changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Neon serverless Postgres, Clerk auth, Lucide React icons, `sonner` for toasts. No test framework (this codebase has none) — verification is `npx tsc --noEmit` + `npm run build` + manual dev walkthrough.

**Spec:** `docs/superpowers/specs/2026-04-07-landing-pages-dashboard-design.md`

---

## File Structure

| File | Purpose | Action |
|---|---|---|
| `src/lib/db/schema.ts` | Schema migration for new table | Modify — add `CREATE TABLE IF NOT EXISTS campaign_landing_pages` block |
| `src/lib/types.ts` | TypeScript interface | Modify — add `CampaignLandingPages` export |
| `src/app/api/intake/[id]/landing-pages/route.ts` | GET + PATCH handlers | Create — new file |
| `src/components/LandingPagesCard.tsx` | Shared React component | Create — new file, ~280 lines |
| `src/components/CampaignPreviewPanel.tsx` | Marketing manager panel | Modify — import + mount, add `canEdit` prop |
| `src/components/designer/DesignerPreviewPanel.tsx` | Designer panel | Modify — import + mount, compute `canEdit` |
| `src/app/page.tsx` | Pass `role` down to `CampaignPreviewPanel` | Modify — propagate existing role state |

---

## Task 1: Add `campaign_landing_pages` table to schema

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Read the existing schema file to find the right insertion point**

```bash
cd /Users/stevenjunop/centric-intake
grep -n "CREATE TABLE IF NOT EXISTS" src/lib/db/schema.ts | head
```

Find a logical place to add the new table. It should go AFTER `intake_requests` is created (because of the FK) but can go anywhere in that sequence. A good spot is right before the `notifications` or `notification_deliveries` table near the end, or right after `approvals`. Pick the spot after `approvals` (it's a natural "per-campaign metadata" neighbor).

- [ ] **Step 2: Add the table creation block**

Insert this block after the `approvals` table creation in `src/lib/db/schema.ts`:

```ts
  // campaign_landing_pages — FK to intake_requests, unique per campaign
  await sql`
    CREATE TABLE IF NOT EXISTS campaign_landing_pages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL UNIQUE REFERENCES intake_requests(id) ON DELETE CASCADE,
      job_posting_url TEXT,
      landing_page_url TEXT,
      ada_form_url TEXT,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_campaign_landing_pages_request
    ON campaign_landing_pages(request_id)
  `;
```

- [ ] **Step 3: Verify the file compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Apply the migration to the running database**

The schema file runs on app boot via `init-db` pattern or manually via the init script. Check if there's an existing init script:

```bash
ls scripts/init-db* 2>/dev/null
```

If `scripts/init-db.mjs` exists, run it:
```bash
node scripts/init-db.mjs
```

If it doesn't exist, start the dev server briefly — the schema runs idempotently at boot in most Next.js setups:
```bash
npm run dev &
sleep 8
curl -s http://localhost:3000/api/intake | head -c 100
kill %1
```

**If neither approach creates the table**, write a one-off migration script at `scripts/migrate-landing-pages.mjs`:
```js
import { getDb } from '../src/lib/db/index.js';
const sql = getDb();
await sql`
  CREATE TABLE IF NOT EXISTS campaign_landing_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL UNIQUE REFERENCES intake_requests(id) ON DELETE CASCADE,
    job_posting_url TEXT,
    landing_page_url TEXT,
    ada_form_url TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS idx_campaign_landing_pages_request ON campaign_landing_pages(request_id)`;
console.log('Migration complete');
process.exit(0);
```
Run it: `node scripts/migrate-landing-pages.mjs`. Delete the script file after success — it's a one-shot.

Verify the table exists with a `psql` or Neon query:
```bash
# Via a temporary node script
node -e "
import('./src/lib/db/index.js').then(async ({ getDb }) => {
  const sql = getDb();
  const rows = await sql\`SELECT column_name FROM information_schema.columns WHERE table_name = 'campaign_landing_pages' ORDER BY ordinal_position\`;
  console.log(rows);
  process.exit(0);
});
"
```
Expected: 8 columns listed (id, request_id, job_posting_url, landing_page_url, ada_form_url, updated_by, created_at, updated_at).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(db): add campaign_landing_pages table

One row per campaign (UNIQUE request_id FK), holds the 3 external URLs
(job posting, custom landing page, ADA qualification form). ON DELETE
CASCADE — deleting a campaign removes its landing pages."
```

If you wrote a migration script, delete it before this commit: `rm scripts/migrate-landing-pages.mjs`.

---

## Task 2: Add `CampaignLandingPages` TypeScript interface

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Find the insertion point**

The file has interfaces organized by domain (IntakeRequest, CreativeBrief, GeneratedAsset, Approval, etc.). A good spot is after the `Approval` interface block (around line 195-210) and before the next domain block.

```bash
grep -n "^export interface\|^export type" src/lib/types.ts | head -30
```

- [ ] **Step 2: Add the interface**

Insert after the `Approval` interface:

```ts
// ============================================================
// CAMPAIGN LANDING PAGES
// ============================================================

export interface CampaignLandingPages {
  id: string;
  request_id: string;
  job_posting_url: string | null;
  landing_page_url: string | null;
  ada_form_url: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LandingPageField = 'job_posting_url' | 'landing_page_url' | 'ada_form_url';
```

- [ ] **Step 3: Verify TSC**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add CampaignLandingPages + LandingPageField types"
```

---

## Task 3: Create GET + PATCH API route

**Files:**
- Create: `src/app/api/intake/[id]/landing-pages/route.ts`

- [ ] **Step 1: Create the file**

Create the directory and the route file:

```bash
mkdir -p src/app/api/intake/\[id\]/landing-pages
```

Then write `src/app/api/intake/[id]/landing-pages/route.ts` with this exact content:

```ts
import { getAuthContext, canAccessRequest } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { getIntakeRequest } from '@/lib/db/intake';
import type { LandingPageField } from '@/lib/types';

// Allowlist for dynamic column names — prevents SQL injection in the PATCH handler.
const ALLOWED_FIELDS: readonly LandingPageField[] = [
  'job_posting_url',
  'landing_page_url',
  'ada_form_url',
] as const;

function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const intakeRequest = await getIntakeRequest(id);
    if (!intakeRequest) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    if (!canAccessRequest(ctx, intakeRequest.created_by)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sql = getDb();
    const rows = await sql`
      SELECT id, request_id, job_posting_url, landing_page_url, ada_form_url,
             updated_by, created_at, updated_at
      FROM campaign_landing_pages
      WHERE request_id = ${id}
      LIMIT 1
    `;

    return Response.json(rows[0] ?? null);
  } catch (error) {
    console.error('[api/intake/[id]/landing-pages] GET failed:', error);
    return Response.json({ error: 'Failed to load landing pages' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admin or designer can edit landing pages.
  // Note: the existing canEditRequest helper in src/lib/permissions.ts is too
  // restrictive (admin-only + recruiter-on-own-drafts, no designer case), so
  // we do an inline role check here.
  if (ctx.role !== 'admin' && ctx.role !== 'designer') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const intakeRequest = await getIntakeRequest(id);
    if (!intakeRequest) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const body = (await request.json()) as { field?: unknown; value?: unknown };
    const field = body.field as LandingPageField;
    if (!ALLOWED_FIELDS.includes(field)) {
      return Response.json(
        { error: `Invalid field; must be one of ${ALLOWED_FIELDS.join(', ')}` },
        { status: 400 },
      );
    }

    const normalizedValue = normalizeUrl(body.value);

    const sql = getDb();
    // Upsert: insert if no row exists, otherwise update the single target column.
    // We need three separate branches because we can't parameterize a column name.
    let rows;
    if (field === 'job_posting_url') {
      rows = await sql`
        INSERT INTO campaign_landing_pages (request_id, job_posting_url, updated_by, updated_at)
        VALUES (${id}, ${normalizedValue}, ${ctx.userId}, NOW())
        ON CONFLICT (request_id) DO UPDATE SET
          job_posting_url = EXCLUDED.job_posting_url,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `;
    } else if (field === 'landing_page_url') {
      rows = await sql`
        INSERT INTO campaign_landing_pages (request_id, landing_page_url, updated_by, updated_at)
        VALUES (${id}, ${normalizedValue}, ${ctx.userId}, NOW())
        ON CONFLICT (request_id) DO UPDATE SET
          landing_page_url = EXCLUDED.landing_page_url,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `;
    } else {
      rows = await sql`
        INSERT INTO campaign_landing_pages (request_id, ada_form_url, updated_by, updated_at)
        VALUES (${id}, ${normalizedValue}, ${ctx.userId}, NOW())
        ON CONFLICT (request_id) DO UPDATE SET
          ada_form_url = EXCLUDED.ada_form_url,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `;
    }

    return Response.json(rows[0]);
  } catch (error) {
    console.error('[api/intake/[id]/landing-pages] PATCH failed:', error);
    return Response.json({ error: 'Failed to save landing page' }, { status: 500 });
  }
}
```

**Important:** the three-branch upsert is intentional — Neon's template-tagged sql client can't parameterize column names. Using a dynamic string like `sql\`... SET ${field} = ...\`` would either fail or open SQL injection. The three branches are safe because the `field` variable is already allowlisted against `ALLOWED_FIELDS`.

- [ ] **Step 2: Verify TSC**

```bash
npx tsc --noEmit
```
Expected: zero errors. If `getIntakeRequest` or `getAuthContext` imports fail, run `ls src/lib/db/intake.ts src/lib/permissions.ts` to confirm paths.

- [ ] **Step 3: Smoke-test the endpoint locally**

```bash
npm run dev &
sleep 6
# With no auth cookie, this should return 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/intake/00000000-0000-0000-0000-000000000000/landing-pages
echo ""
kill %1
```
Expected: `401` on the curl line. (403/404 is also acceptable — the point is no 500.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/intake/\[id\]/landing-pages/route.ts
git commit -m "feat(api): add GET + PATCH /api/intake/[id]/landing-pages

GET returns the campaign's landing pages row or null. PATCH upserts a
single field (job_posting_url | landing_page_url | ada_form_url) with
inline role check (admin + designer only) and URL normalization
(auto-prepend https://). Three-branch upsert because the sql template
client can't parameterize column names safely."
```

---

## Task 4: Create `LandingPagesCard` component — types, state, helpers

**Files:**
- Create: `src/components/LandingPagesCard.tsx`

This task creates the file scaffolding: imports, types, helpers, and the default export skeleton. Sub-components come in Task 5. Rendering comes in Task 6.

- [ ] **Step 1: Create the file with scaffolding**

Create `src/components/LandingPagesCard.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, ClipboardList, Globe, FileCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { CampaignLandingPages, LandingPageField } from "@/lib/types";

// ── Props ────────────────────────────────────────────────────────────

interface LandingPagesCardProps {
  requestId: string;
  canEdit: boolean;
}

// ── URL normalization (must match server) ──────────────────────────

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isComplete(pages: CampaignLandingPages | null): boolean {
  if (!pages) return false;
  return Boolean(pages.job_posting_url && pages.landing_page_url && pages.ada_form_url);
}

// ── Row config (single source of truth for label/icon/color) ───────

interface RowConfig {
  field: LandingPageField;
  label: string;
  placeholder: string;
  Icon: typeof ClipboardList;
  accent: string;
}

const ROW_CONFIG: RowConfig[] = [
  {
    field: "job_posting_url",
    label: "Job Posting",
    placeholder: "paste the main OneForma job listing URL…",
    Icon: ClipboardList,
    accent: "rgb(6,147,227)",
  },
  {
    field: "landing_page_url",
    label: "Landing Page",
    placeholder: "paste the campaign landing page URL…",
    Icon: Globe,
    accent: "rgb(155,81,224)",
  },
  {
    field: "ada_form_url",
    label: "ADA Form",
    placeholder: "paste the screener / qualification form URL…",
    Icon: FileCheck,
    accent: "#22c55e",
  },
];

// ── Default export — stub, filled in later tasks ────────────────────

export default function LandingPagesCard({ requestId, canEdit }: LandingPagesCardProps) {
  const [pages, setPages] = useState<CampaignLandingPages | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<LandingPageField | null>(null);
  const focusedFieldRef = useRef<LandingPageField | null>(null);

  // Fetch helper
  const fetchPages = useCallback(
    async (isInitial: boolean) => {
      try {
        const res = await fetch(`/api/intake/${requestId}/landing-pages`);
        if (!res.ok) {
          if (isInitial) setLoading(false);
          return;
        }
        const data = (await res.json()) as CampaignLandingPages | null;
        // Only update state if no field is currently focused — protects in-progress typing.
        if (focusedFieldRef.current === null) {
          setPages(data);
        }
        if (isInitial) setLoading(false);
      } catch (err) {
        console.error("[LandingPagesCard] fetch failed:", err);
        if (isInitial) setLoading(false);
      }
    },
    [requestId],
  );

  // Initial fetch + 5s poll
  useEffect(() => {
    fetchPages(true);
    const interval = setInterval(() => fetchPages(false), 5000);
    return () => clearInterval(interval);
  }, [fetchPages]);

  // Save one field (called from row onBlur)
  const saveField = useCallback(
    async (field: LandingPageField, rawValue: string) => {
      const normalized = normalizeUrl(rawValue);
      // Optimistic update
      const previous = pages;
      setPages((prev) => {
        const base = prev ?? {
          id: "",
          request_id: requestId,
          job_posting_url: null,
          landing_page_url: null,
          ada_form_url: null,
          updated_by: null,
          created_at: "",
          updated_at: "",
        };
        return { ...base, [field]: normalized };
      });
      setSavingField(field);

      try {
        const res = await fetch(`/api/intake/${requestId}/landing-pages`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field, value: normalized }),
        });
        if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
        const updated = (await res.json()) as CampaignLandingPages;
        setPages(updated);
      } catch (err) {
        console.error("[LandingPagesCard] save failed:", err);
        setPages(previous); // rollback
        toast.error("Couldn't save landing page");
      } finally {
        setSavingField(null);
      }
    },
    [pages, requestId],
  );

  if (loading) {
    return (
      <div className="border border-[var(--border)] rounded-[14px] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-[#F5F5F5] rounded w-1/3" />
          <div className="h-12 bg-[#F5F5F5] rounded-lg" />
          <div className="h-12 bg-[#F5F5F5] rounded-lg" />
          <div className="h-12 bg-[#F5F5F5] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[var(--border)] rounded-[14px] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      {/* Sub-components wired in Task 6 */}
      <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#737373]">
        Landing Pages — placeholder (wired in Task 6)
      </div>
      <div suppressHydrationWarning>
        {/* Keep references live so TS doesn't drop them */}
        {pages ? "" : ""}
        {savingField ? "" : ""}
        {canEdit ? "" : ""}
      </div>
    </div>
  );
}
```

**Why the placeholder render:** Tasks 5 and 6 layer on the visual treatment. This task produces a compiling file with all the state management plumbed and the initial fetch working. The placeholder JSX prevents TS from complaining about unused `pages`, `savingField`, `canEdit`, and `saveField`. Without the `saveField` reference the compiler may warn; if it does, add `void saveField;` before the return.

- [ ] **Step 2: Verify TSC**

```bash
npx tsc --noEmit
```
Expected: zero errors. If TSC complains about unused `saveField`, add `void saveField;` immediately before `if (loading)`. If it complains about `focusedFieldRef` being unused (it's set in Task 5, not here), add `void focusedFieldRef;` likewise.

- [ ] **Step 3: Commit**

```bash
git add src/components/LandingPagesCard.tsx
git commit -m "feat(landing-pages): scaffold LandingPagesCard with state + fetch

Initial fetch, 5s polling with focus-aware skip, optimistic saveField
helper with rollback-on-error via sonner toast. Row config exported
as module-level constant. Placeholder render — sub-components wired
in follow-up tasks."
```

---

## Task 5: Add `LandingPageRow` sub-component

**Files:**
- Modify: `src/components/LandingPagesCard.tsx`

Add the row sub-component at module level, ABOVE the `LandingPagesCard` default export. It renders one input with icon, label, save indicator, and action buttons.

- [ ] **Step 1: Insert the sub-component**

In `src/components/LandingPagesCard.tsx`, add this block between the `ROW_CONFIG` constant and `export default function LandingPagesCard`:

```tsx
// ── Sub-component: LandingPageRow ───────────────────────────────────

interface LandingPageRowProps {
  config: RowConfig;
  value: string | null;
  canEdit: boolean;
  isSaving: boolean;
  onFocus: () => void;
  onBlur: (rawValue: string) => void;
}

function LandingPageRow({ config, value, canEdit, isSaving, onFocus, onBlur }: LandingPageRowProps) {
  const { field, label, placeholder, Icon, accent } = config;
  const [localValue, setLocalValue] = useState(value ?? "");
  const [focused, setFocused] = useState(false);

  // If the external value changes while we're NOT focused, sync it in.
  // If focused, leave the user's in-progress typing alone (protected in parent too).
  useEffect(() => {
    if (!focused) {
      setLocalValue(value ?? "");
    }
  }, [value, focused]);

  const hasValue = localValue.trim().length > 0;
  const savedClass = !focused && hasValue
    ? "bg-[rgba(34,197,94,0.04)] border-[rgba(34,197,94,0.25)]"
    : "";
  const focusedClass = focused
    ? "bg-white border-[rgb(6,147,227)] ring-[3px] ring-[rgb(6,147,227)]/10"
    : "";
  const defaultClass = !focused && !hasValue
    ? "bg-[#FAFAFA] border-[var(--border)] hover:bg-white hover:border-[#ccc]"
    : "";

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!value) return;
    navigator.clipboard.writeText(value).catch(() => {});
    toast.success("Copied");
  };

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 border rounded-[10px] mb-2 transition-all ${savedClass} ${focusedClass} ${defaultClass}`}
    >
      {/* Icon panel */}
      <div
        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, rgba(6,147,227,0.1), rgba(155,81,224,0.1))`,
        }}
      >
        <Icon size={14} style={{ color: accent }} strokeWidth={2} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#737373] leading-none">
          {label}
        </div>
        <input
          type="text"
          className="block w-full pt-0.5 bg-transparent border-none outline-none text-[12px] font-medium font-mono text-[var(--foreground)] placeholder:text-[#c0c0c0] placeholder:italic placeholder:font-sans"
          placeholder={placeholder}
          value={localValue}
          readOnly={!canEdit}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => {
            setFocused(true);
            onFocus();
          }}
          onBlur={() => {
            setFocused(false);
            // Only save if the value actually changed.
            if ((value ?? "") !== localValue) {
              onBlur(localValue);
            }
          }}
        />
      </div>

      {/* Right side — saving indicator OR action buttons */}
      {focused ? (
        <div className="flex items-center gap-1 text-[10px] font-bold text-[rgb(6,147,227)] flex-shrink-0">
          <span
            className="w-[5px] h-[5px] rounded-full bg-current"
            style={{ animation: "landingPagePulse 1s ease-in-out infinite" }}
          />
          editing
        </div>
      ) : isSaving ? (
        <div className="flex items-center gap-1 text-[10px] font-bold text-[rgb(6,147,227)] flex-shrink-0">
          <span
            className="w-[5px] h-[5px] rounded-full bg-current"
            style={{ animation: "landingPagePulse 1s ease-in-out infinite" }}
          />
          saving
        </div>
      ) : hasValue && value ? (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="w-[26px] h-[26px] rounded-md border-none bg-transparent flex items-center justify-center cursor-pointer text-[#737373] hover:bg-[#F0F0F0] hover:text-[var(--foreground)] transition-colors"
            title="Copy"
          >
            <Copy size={13} />
          </button>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="w-[26px] h-[26px] rounded-md flex items-center justify-center text-[#737373] hover:bg-[#F0F0F0] hover:text-[var(--foreground)] transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      ) : null}
    </div>
  );
}
```

**About the animation:** the `landingPagePulse` keyframe doesn't exist yet. Add it in Task 6 via a `<style jsx>` block inside the default export (or fall back to Tailwind's `animate-pulse` if the timing doesn't matter). For this task, the class reference is fine — TSC doesn't check CSS animations.

- [ ] **Step 2: Verify TSC**

```bash
npx tsc --noEmit
```
Expected: zero errors. TypeScript doesn't verify CSS animation names, so the missing keyframe won't error here.

- [ ] **Step 3: Commit**

```bash
git add src/components/LandingPagesCard.tsx
git commit -m "feat(landing-pages): add LandingPageRow sub-component

One input row per landing page — icon panel, uppercase label, monospace
input with hover/focus/saved visual states, copy + open-in-new-tab
buttons when filled, editing/saving indicator when focused. Local state
sync with parent on blur, protected from poll overwrites via focused flag."
```

---

## Task 6: Wire the default export — header, rows, render, keyframe

**Files:**
- Modify: `src/components/LandingPagesCard.tsx`

Replace the placeholder render in the `LandingPagesCard` default export with the real layout that uses `LandingPageRow`.

- [ ] **Step 1: Replace the loading block's sibling placeholder with the real render**

Inside `src/components/LandingPagesCard.tsx`, find the block that starts with `return (` after the `if (loading)` check and replace EVERYTHING from that `return (` to its matching `);` with:

```tsx
  const complete = isComplete(pages);

  return (
    <div className="border border-[var(--border)] rounded-[14px] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      {/* Keyframe for the pulse indicator */}
      <style>{`
        @keyframes landingPagePulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#737373] m-0">
          Landing Pages
        </h3>
        {complete ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#22c55e]">
            <CheckCircle2 size={11} strokeWidth={2.5} />
            complete
          </span>
        ) : (
          <span className="text-[10px] italic text-[#737373]">
            applies to all countries
          </span>
        )}
      </div>

      {/* Rows */}
      {ROW_CONFIG.map((config) => {
        const value = pages ? (pages[config.field] as string | null) : null;
        return (
          <LandingPageRow
            key={config.field}
            config={config}
            value={value}
            canEdit={canEdit}
            isSaving={savingField === config.field}
            onFocus={() => {
              focusedFieldRef.current = config.field;
            }}
            onBlur={(rawValue) => {
              focusedFieldRef.current = null;
              void saveField(config.field, rawValue);
            }}
          />
        );
      })}
    </div>
  );
}
```

**Remove** any `void saveField;` / `void focusedFieldRef;` lines from Task 4 — they're not needed now because the real render uses them.

**Remove** the placeholder render block from Task 4 (the `<div suppressHydrationWarning>` and the surrounding "Landing Pages — placeholder" div).

- [ ] **Step 2: Verify TSC**

```bash
npx tsc --noEmit
```
Expected: zero errors. Common issue: `pages[config.field]` typing may need a cast — if so, change it to:
```tsx
const value = pages ? ((pages as unknown as Record<LandingPageField, string | null>)[config.field] ?? null) : null;
```

- [ ] **Step 3: Verify the component builds inside the Next build pipeline**

```bash
npm run build
```
Expected: clean build. If it fails on the `<style>` tag inside a client component, replace it with `<style dangerouslySetInnerHTML={{ __html: "..." }} />` — same content, same effect.

- [ ] **Step 4: Commit**

```bash
git add src/components/LandingPagesCard.tsx
git commit -m "feat(landing-pages): wire LandingPagesCard default export

Header with complete badge, 3 rows from ROW_CONFIG via LandingPageRow,
focusedFieldRef tracking to protect in-progress typing from polling,
inline keyframe for the pulse indicator."
```

---

## Task 7: Mount `LandingPagesCard` in `CampaignPreviewPanel`

**Files:**
- Modify: `src/components/CampaignPreviewPanel.tsx`

- [ ] **Step 1: Add the import**

In `src/components/CampaignPreviewPanel.tsx`, add this import with the other `@/components` imports (near the top of the file):

```tsx
import LandingPagesCard from "@/components/LandingPagesCard";
```

- [ ] **Step 2: Add `canEdit` to the component props**

Find the `CampaignPreviewPanelProps` interface (around line 31):

```tsx
interface CampaignPreviewPanelProps {
  requestId: string;
}
```

Change to:

```tsx
interface CampaignPreviewPanelProps {
  requestId: string;
  canEdit?: boolean;
}
```

And the function signature (around line 35):

```tsx
export default function CampaignPreviewPanel({ requestId }: CampaignPreviewPanelProps) {
```

Change to:

```tsx
export default function CampaignPreviewPanel({ requestId, canEdit = false }: CampaignPreviewPanelProps) {
```

- [ ] **Step 3: Mount the card between Intel strip and Latest Creatives**

Find the Intel strip block (starts with `{hasBrief && (messaging.primary_message || channels.primary?.length > 0) && (` around line 225). It ends with `</div>` followed by `)}`. Immediately after that `)}`, insert:

```tsx
        {/* Landing Pages — shared between marketing + designer views */}
        <LandingPagesCard requestId={request.id} canEdit={canEdit} />
```

- [ ] **Step 4: Verify TSC + build**

```bash
npx tsc --noEmit && npm run build
```
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/CampaignPreviewPanel.tsx
git commit -m "feat(landing-pages): mount LandingPagesCard in CampaignPreviewPanel

Sits between the Intel strip and the Latest Creatives grid. canEdit
prop defaults to false for safety; caller passes true for admin users."
```

---

## Task 8: Pass `canEdit` from `src/app/page.tsx` into `CampaignPreviewPanel`

**Files:**
- Modify: `src/app/page.tsx`

The dashboard page (`src/app/page.tsx`) already fetches the user's role from `/api/auth/me` and stores it in `role` state. We need to pass `canEdit` derived from that role into the preview panel.

- [ ] **Step 1: Find the `<CampaignPreviewPanel>` mount**

```bash
grep -n "CampaignPreviewPanel" src/app/page.tsx
```
Expected: one usage showing `<CampaignPreviewPanel requestId={...} />`.

- [ ] **Step 2: Change the mount to pass `canEdit`**

Change:
```tsx
<CampaignPreviewPanel requestId={...} />
```
to:
```tsx
<CampaignPreviewPanel
  requestId={...}
  canEdit={role === 'admin'}
/>
```

**Note on the role value:** marketing manager === admin in this codebase (`UserRole = 'admin' | 'recruiter' | 'designer' | 'viewer'` per `src/lib/types.ts:364`). The designer view has its own panel (`DesignerPreviewPanel`) handled in Task 9.

- [ ] **Step 3: Verify TSC**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(landing-pages): derive canEdit from role in dashboard

Marketing manager (admin role) can edit; other roles see readonly."
```

---

## Task 9: Mount `LandingPagesCard` in `DesignerPreviewPanel`

**Files:**
- Modify: `src/components/designer/DesignerPreviewPanel.tsx`

- [ ] **Step 1: Add the import**

In `src/components/designer/DesignerPreviewPanel.tsx`, add:

```tsx
import LandingPagesCard from "@/components/LandingPagesCard";
```

- [ ] **Step 2: Mount the card**

Find the render block in the component (around line 288-336). Specifically find the line with `<CampaignContextCard request={request} brief={brief} />`. Immediately after it, insert:

```tsx
      {/* ── Landing Pages — shared with marketing view */}
      <LandingPagesCard requestId={requestId} canEdit={true} />
```

**Note:** `canEdit={true}` is hardcoded because the designer portal is already role-gated upstream (`/designer/page.tsx` redirects non-designers and non-admins to `/`). Anyone reaching `DesignerPreviewPanel` is authorized to edit landing pages.

- [ ] **Step 3: Verify TSC + build**

```bash
npx tsc --noEmit && npm run build
```
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/designer/DesignerPreviewPanel.tsx
git commit -m "feat(landing-pages): mount LandingPagesCard in DesignerPreviewPanel

Hardcoded canEdit=true because the designer portal is already
role-gated upstream in src/app/designer/page.tsx."
```

---

## Task 10: Manual end-to-end verification in dev server

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/stevenjunop/centric-intake && npm run dev
```

- [ ] **Step 2: Sign in as admin + open a campaign**

Open `http://localhost:3000` in your browser. Sign in. Click into any campaign in the list. The preview panel should show the new Landing Pages card between the Intel strip and the Latest Creatives grid.

- [ ] **Step 3: Fill in one URL — verify auto-save**

Click into the Job Posting input. Paste `oneforma.com/jobs/test`. Click anywhere else to blur. The card should:
- Briefly show "saving" indicator (you may need to be quick — it's fast)
- Show the URL as `https://oneforma.com/jobs/test` (auto-prepended)
- Get the saved green tint
- Show copy + open-in-new-tab icons on the right

- [ ] **Step 4: Verify DB persistence**

```bash
node -e "
import('./src/lib/db/index.js').then(async ({ getDb }) => {
  const sql = getDb();
  const rows = await sql\`SELECT * FROM campaign_landing_pages ORDER BY updated_at DESC LIMIT 5\`;
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
});
"
```
Expected: at least one row, with `job_posting_url = 'https://oneforma.com/jobs/test'`.

- [ ] **Step 5: Verify copy button + open button**

Hover over the filled row. Click the copy icon — should see `Copied` toast. Click the external link icon — should open `https://oneforma.com/jobs/test` in a new tab.

- [ ] **Step 6: Fill the other two URLs, verify complete badge**

Paste a URL into Landing Page and ADA Form. After all three are filled, the header "applies to all countries" text should swap to a green `✓ complete` badge.

- [ ] **Step 7: Verify cross-role sync**

Sign out. Sign in as a designer user (or open `/designer` — it auto-redirects if you're admin). Open the SAME campaign. Confirm the 3 URLs appear in the designer view within ~5 seconds (the 5s poll).

Edit one URL from the designer side. Sign back in as admin, open the same campaign in the marketing dashboard. Confirm the designer's edit appears within ~5 seconds.

- [ ] **Step 8: Verify clearing a field**

From either role, select the full URL text in one input and delete it. Blur. The row should return to empty state (placeholder visible, no action buttons). DB row's column is `null`.

- [ ] **Step 9: Verify readonly for non-edit roles**

Sign in as a recruiter or viewer user. Open a campaign. The Landing Pages card still renders, but:
- Inputs have `readonly` attribute
- No save triggers on blur
- Copy + open buttons still work
- Bonus: try to `curl` the PATCH endpoint — should get 403

- [ ] **Step 10: Stop the dev server and check git status**

```bash
kill %1 2>/dev/null
git status
```
Expected: clean working tree (all changes committed in prior tasks).

**If any verification step fails**, commit the fix with a message `fix(landing-pages): <specific issue>`. Don't move on until the step passes.

---

## Task 11: Final branch wrap-up

- [ ] **Step 1: Show the commit log**

```bash
git log --oneline main..HEAD
```
Expected: ~10 commits for tasks 1-9, possibly more if fixes were needed in Task 10.

- [ ] **Step 2: Verify TSC + build one final time**

```bash
npx tsc --noEmit && npm run build
```
Expected: both clean.

- [ ] **Step 3: Hand off to finishing-a-development-branch**

The controller (subagent-driven-development orchestrator) will invoke the `superpowers:finishing-a-development-branch` skill to merge the feature branch into main. This task does not execute the merge — it just confirms the branch is ready.

---

## Final checklist

- [ ] Task 1: New `campaign_landing_pages` table ✓
- [ ] Task 2: `CampaignLandingPages` type ✓
- [ ] Task 3: GET + PATCH route ✓
- [ ] Task 4: `LandingPagesCard` scaffold (state + fetch + save helper) ✓
- [ ] Task 5: `LandingPageRow` sub-component ✓
- [ ] Task 6: Wire default export render ✓
- [ ] Task 7: Mount in `CampaignPreviewPanel` ✓
- [ ] Task 8: Derive `canEdit` in `src/app/page.tsx` ✓
- [ ] Task 9: Mount in `DesignerPreviewPanel` ✓
- [ ] Task 10: Manual dev verification ✓
- [ ] Task 11: Final wrap-up ✓
