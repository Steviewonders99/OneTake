# Asset Edit Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an inline edit system that lets recruiters batch-edit campaign assets (copy corrections, link/QR updates, new locales via Excel, targeted edits) without re-running the full pipeline.

**Architecture:** New `/api/intake/[id]/edit` route classifies edit instructions into 4 action types (copy_update, link_update, locale_add, targeted_edit), executes them against existing assets using the proven Gemma revision pipeline, and notifies via Teams. Batch rollback via edit_history snapshots. Frontend "Edit Mode" with checkboxes + sticky edit bar in the campaign workspace.

**Tech Stack:** Next.js (TypeScript), Gemma 3 27B via NIM (copy revision), xlsx parsing (Excel uploads), existing QR generator (Python — called via tracked link system), Teams webhooks.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/db/schema.ts` | Add edit_lock column | Modify |
| `src/lib/permissions.ts` | Add canEditCampaign() | Modify |
| `src/lib/edit-classifier.ts` | Classify instruction → action type | Create |
| `src/lib/edit-executor.ts` | Orchestrate per-type edit execution | Create |
| `src/app/api/intake/[id]/edit/route.ts` | Edit API endpoint | Create |
| `src/app/api/intake/[id]/edit/rollback/route.ts` | Batch rollback endpoint | Create |
| `src/components/campaign/EditMode.tsx` | Edit mode wrapper (checkboxes + bar) | Create |
| `src/app/intake/[id]/page.tsx` | Wire edit mode into workspace | Modify |
| `src/lib/notifications/teams.ts` | Add campaign_edit notification | Modify |

---

### Task 1: Schema — Add edit_lock Column

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add edit_lock column to intake_requests**

In `src/lib/db/schema.ts`, find the block that adds `pipeline_mode` (the one we added in the organic pipeline plan). After that block, add:

```typescript
  // Edit lock: prevents concurrent edits on the same campaign
  await sql`
    ALTER TABLE intake_requests
      ADD COLUMN IF NOT EXISTS edit_lock JSONB DEFAULT NULL
  `;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat: add edit_lock column to intake_requests"
```

---

### Task 2: Permissions — canEditCampaign()

**Files:**
- Modify: `src/lib/permissions.ts`

- [ ] **Step 1: Add canEditCampaign function**

After `canRequestPaid()` in `src/lib/permissions.ts`, add:

```typescript
export function canEditCampaign(
  authCtx: AuthContext,
  requestCreatedBy: string | null,
  requestStatus: string
): boolean {
  if (!['review', 'approved', 'sent'].includes(requestStatus)) return false;
  if (authCtx.role === 'admin') return true;
  if (authCtx.role === 'lead_recruiter') return true;
  if (authCtx.role === 'recruiter') {
    return requestCreatedBy === authCtx.userId;
  }
  return false;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat: add canEditCampaign permission check"
```

---

### Task 3: Edit Classifier

**Files:**
- Create: `src/lib/edit-classifier.ts`

- [ ] **Step 1: Create the classifier**

```typescript
/**
 * Classify a recruiter's edit instruction into an action type.
 * Uses keyword/pattern matching — no LLM needed for routing.
 */

export type EditActionType = 'copy_update' | 'link_update' | 'locale_add' | 'targeted_edit';

export interface ClassificationResult {
  action_type: EditActionType;
  detected_url?: string;
  confidence: 'high' | 'medium';
}

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/i;

const LOCALE_KEYWORDS = [
  'new country', 'new countries', 'add country', 'add countries',
  'new locale', 'new locales', 'add locale', 'add locales',
  'new region', 'new regions', 'add region', 'add regions',
];

export function classifyEdit(
  instruction: string,
  assetCount: number,
  hasExcel: boolean,
): ClassificationResult {
  const lower = instruction.toLowerCase();

  // Excel attachment → locale_add (mandatory signal)
  if (hasExcel) {
    return { action_type: 'locale_add', confidence: 'high' };
  }

  // Locale keywords without Excel → still locale_add but will fail validation
  if (LOCALE_KEYWORDS.some(kw => lower.includes(kw))) {
    return { action_type: 'locale_add', confidence: 'high' };
  }

  // URL pattern → link_update
  const urlMatch = instruction.match(URL_PATTERN);
  if (urlMatch) {
    return {
      action_type: 'link_update',
      detected_url: urlMatch[0],
      confidence: 'high',
    };
  }

  // Small selection (1-3 assets) with specific replacement text → targeted_edit
  if (assetCount > 0 && assetCount <= 3) {
    // Check for explicit replacement patterns
    const hasReplacement = /change .+ to |replace .+ with |update .+ to |set .+ to /i.test(instruction);
    if (hasReplacement) {
      return { action_type: 'targeted_edit', confidence: 'high' };
    }
  }

  // Default: copy_update (most common case)
  return { action_type: 'copy_update', confidence: 'medium' };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/edit-classifier.ts
git commit -m "feat: add edit instruction classifier (keyword-based routing)"
```

---

### Task 4: Edit Executor

**Files:**
- Create: `src/lib/edit-executor.ts`

- [ ] **Step 1: Create the executor**

This is the core orchestration file that runs edits per action type.

```typescript
/**
 * Edit executor — applies edits to assets based on classified action type.
 * Handles copy_update, link_update, targeted_edit.
 * locale_add is handled separately (creates worker jobs).
 */

import { getDb } from '@/lib/db';

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || '';
const NVIDIA_NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';

export interface EditResult {
  asset_id: string;
  success: boolean;
  error?: string;
  original_snapshot?: Record<string, unknown>;
}

/**
 * Revise copy on a single asset using Gemma 3 27B.
 * Reuses the proven revision logic from /api/revise.
 */
export async function reviseCopyAsset(
  assetId: string,
  instruction: string,
  batchId: string,
  editedBy: string,
): Promise<EditResult> {
  const sql = getDb();

  try {
    // Fetch the asset
    const rows = await sql`SELECT * FROM generated_assets WHERE id = ${assetId}::uuid`;
    if (!rows.length) return { asset_id: assetId, success: false, error: 'Asset not found' };
    const asset = rows[0];
    const content = (asset.content || {}) as Record<string, unknown>;
    const copyData = (asset.copy_data || {}) as Record<string, unknown>;

    // Snapshot original for rollback
    const originalSnapshot = { content: { ...content }, copy_data: { ...copyData } };

    // Build current copy text for the LLM
    const currentCopy = JSON.stringify({ ...copyData, ...content }, null, 2);

    const systemPrompt = `You are an elite recruitment copywriter for OneForma.
Revise the following content based on the user's instruction.
Preserve the JSON structure exactly. Only change what the instruction asks for.
Return ONLY the revised JSON, nothing else.`;

    const userPrompt = `Current content:\n${currentCopy}\n\nInstruction: ${instruction}\n\nReturn the revised JSON with the same structure.`;

    const nimRes = await fetch(`${NVIDIA_NIM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_NIM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-3-27b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      }),
    });

    if (!nimRes.ok) {
      const err = await nimRes.text();
      return { asset_id: assetId, success: false, error: `Gemma API failed: ${err.slice(0, 200)}` };
    }

    const nimData = await nimRes.json();
    const revisedText = nimData.choices?.[0]?.message?.content?.trim() || '';

    // Parse revised JSON
    let revisedContent: Record<string, unknown>;
    try {
      const cleaned = revisedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      revisedContent = JSON.parse(cleaned);
    } catch {
      return { asset_id: assetId, success: false, error: 'Failed to parse revised content as JSON' };
    }

    // Build edit history entry
    const historyEntry = {
      type: 'recruiter_edit',
      action_type: 'copy_update',
      instruction,
      edited_by: editedBy,
      timestamp: new Date().toISOString(),
      original_value: originalSnapshot,
      batch_id: batchId,
    };

    // Update asset: merge revised content, append history, increment version
    await sql`
      UPDATE generated_assets
      SET content = COALESCE(content, '{}'::jsonb) || ${JSON.stringify(revisedContent)}::jsonb,
          version = COALESCE(version, 1) + 1,
          content = jsonb_set(
            COALESCE(content, '{}'::jsonb) || ${JSON.stringify(revisedContent)}::jsonb,
            '{edit_history}',
            COALESCE(content->'edit_history', '[]'::jsonb) || ${JSON.stringify(historyEntry)}::jsonb
          )
      WHERE id = ${assetId}::uuid
    `;

    return { asset_id: assetId, success: true, original_snapshot: originalSnapshot };
  } catch (e) {
    return { asset_id: assetId, success: false, error: String(e) };
  }
}

/**
 * Update link references across assets for a given locale.
 * Updates form_data on the request + regenerates QR URLs in flyer content.
 */
export async function updateLinksForRequest(
  requestId: string,
  newUrl: string,
  batchId: string,
  editedBy: string,
): Promise<EditResult[]> {
  const sql = getDb();
  const results: EditResult[] = [];

  // Update ada_form_url in form_data
  await sql`
    UPDATE intake_requests
    SET form_data = jsonb_set(COALESCE(form_data, '{}'::jsonb), '{ada_form_url}', ${JSON.stringify(newUrl)}::jsonb)
    WHERE id = ${requestId}::uuid
  `;

  // Find all flyer assets for this request
  const flyers = await sql`
    SELECT id, content FROM generated_assets
    WHERE request_id = ${requestId}::uuid AND asset_type = 'flyer'
  `;

  for (const flyer of flyers) {
    try {
      const content = (flyer.content || {}) as Record<string, unknown>;
      const originalSnapshot = { content: { ...content } };

      // Update QR destination in content metadata
      const historyEntry = {
        type: 'recruiter_edit',
        action_type: 'link_update',
        instruction: `Updated link to: ${newUrl}`,
        edited_by: editedBy,
        timestamp: new Date().toISOString(),
        original_value: originalSnapshot,
        batch_id: batchId,
      };

      await sql`
        UPDATE generated_assets
        SET content = jsonb_set(
              jsonb_set(COALESCE(content, '{}'::jsonb), '{qr_destination}', ${JSON.stringify(newUrl)}::jsonb),
              '{edit_history}',
              COALESCE(content->'edit_history', '[]'::jsonb) || ${JSON.stringify(historyEntry)}::jsonb
            ),
            version = COALESCE(version, 1) + 1
        WHERE id = ${flyer.id}::uuid
      `;

      results.push({ asset_id: flyer.id, success: true, original_snapshot: originalSnapshot });
    } catch (e) {
      results.push({ asset_id: flyer.id, success: false, error: String(e) });
    }
  }

  // Update tracked_links destinations
  await sql`
    UPDATE tracked_links
    SET destination_url = regexp_replace(
      destination_url,
      '^https?://[^?]+',
      ${newUrl}
    )
    WHERE request_id = ${requestId}::uuid
  `;

  return results;
}

/**
 * Rollback all assets in a batch to their pre-edit state.
 */
export async function rollbackBatch(
  requestId: string,
  batchId: string,
): Promise<number> {
  const sql = getDb();

  // Find all assets that have this batch_id in their edit_history
  const assets = await sql`
    SELECT id, content FROM generated_assets
    WHERE request_id = ${requestId}::uuid
      AND content->'edit_history' @> ${JSON.stringify([{ batch_id: batchId }])}::jsonb
  `;

  let reverted = 0;
  for (const asset of assets) {
    const content = (asset.content || {}) as Record<string, unknown>;
    const editHistory = (content.edit_history || []) as Array<Record<string, unknown>>;

    // Find the edit entry for this batch
    const batchEntry = editHistory.find((e) => e.batch_id === batchId);
    if (!batchEntry || !batchEntry.original_value) continue;

    const original = batchEntry.original_value as Record<string, unknown>;

    // Restore original content, remove this edit from history
    const filteredHistory = editHistory.filter((e) => e.batch_id !== batchId);

    await sql`
      UPDATE generated_assets
      SET content = ${JSON.stringify({ ...original.content, edit_history: filteredHistory })}::jsonb,
          copy_data = CASE
            WHEN ${JSON.stringify(original.copy_data || null)}::jsonb IS NOT NULL
            THEN ${JSON.stringify(original.copy_data || {})}::jsonb
            ELSE copy_data
          END,
          version = GREATEST(COALESCE(version, 1) - 1, 1)
      WHERE id = ${asset.id}::uuid
    `;
    reverted++;
  }

  return reverted;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/edit-executor.ts
git commit -m "feat: add edit executor with copy revision, link update, and rollback"
```

---

### Task 5: Edit API Route

**Files:**
- Create: `src/app/api/intake/[id]/edit/route.ts`

- [ ] **Step 1: Create the edit route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, canEditCampaign } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { classifyEdit } from '@/lib/edit-classifier';
import { reviseCopyAsset, updateLinksForRequest, type EditResult } from '@/lib/edit-executor';
import { createComputeJob } from '@/lib/db/compute-jobs';
import { sendTeamsNotification } from '@/lib/notifications/teams';
import { randomUUID } from 'crypto';

const MAX_ASSETS_PER_BATCH = 50;
const MAX_INSTRUCTION_LENGTH = 2000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: requestId } = await params;
  const sql = getDb();

  // Fetch the campaign
  const rows = await sql`
    SELECT id, status, created_by, title, pipeline_mode, edit_lock, form_data, target_regions
    FROM intake_requests WHERE id = ${requestId}
  `;
  const campaign = rows[0];
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Permission check
  if (!canEditCampaign(authCtx, campaign.created_by, campaign.status)) {
    return NextResponse.json({ error: 'Not authorized to edit this campaign' }, { status: 403 });
  }

  // Check edit lock
  if (campaign.edit_lock) {
    const lock = campaign.edit_lock as Record<string, string>;
    const lockAge = Date.now() - new Date(lock.started_at).getTime();
    if (lockAge < 5 * 60 * 1000) { // 5 minute expiry
      return NextResponse.json({
        error: `Campaign is being edited by another user. Try again in a moment.`,
      }, { status: 409 });
    }
  }

  // Parse body (supports multipart for Excel uploads)
  let instruction: string;
  let assetIds: string[];
  let excelBuffer: ArrayBuffer | null = null;

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    instruction = formData.get('instruction') as string || '';
    assetIds = JSON.parse(formData.get('asset_ids') as string || '[]');
    const excelFile = formData.get('excel_file') as File | null;
    if (excelFile) {
      excelBuffer = await excelFile.arrayBuffer();
    }
  } else {
    const body = await request.json();
    instruction = body.instruction || '';
    assetIds = body.asset_ids || [];
  }

  // Validate
  if (!instruction || instruction.length === 0) {
    return NextResponse.json({ error: 'Instruction is required' }, { status: 400 });
  }
  if (instruction.length > MAX_INSTRUCTION_LENGTH) {
    return NextResponse.json({ error: `Instruction too long (max ${MAX_INSTRUCTION_LENGTH} chars)` }, { status: 400 });
  }
  if (assetIds.length > MAX_ASSETS_PER_BATCH) {
    return NextResponse.json({ error: `Too many assets (max ${MAX_ASSETS_PER_BATCH})` }, { status: 400 });
  }

  // Verify selected assets belong to this campaign
  if (assetIds.length > 0) {
    const assetCheck = await sql`
      SELECT id FROM generated_assets
      WHERE id = ANY(${assetIds}::uuid[]) AND request_id = ${requestId}::uuid
    `;
    if (assetCheck.length !== assetIds.length) {
      return NextResponse.json({ error: 'Some assets do not belong to this campaign' }, { status: 400 });
    }
  }

  // Classify
  const classification = classifyEdit(instruction, assetIds.length, !!excelBuffer);

  // Acquire edit lock
  const batchId = randomUUID();
  await sql`
    UPDATE intake_requests
    SET edit_lock = ${JSON.stringify({ user_id: authCtx.userId, batch_id: batchId, started_at: new Date().toISOString() })}::jsonb
    WHERE id = ${requestId}::uuid
  `;

  try {
    let results: EditResult[] = [];
    let jobsCreated = 0;
    let newCountries: string[] = [];

    switch (classification.action_type) {
      case 'copy_update':
      case 'targeted_edit': {
        // Apply Gemma revision to each selected asset
        for (const assetId of assetIds) {
          const result = await reviseCopyAsset(assetId, instruction, batchId, authCtx.userId);
          results.push(result);
        }
        break;
      }

      case 'link_update': {
        const newUrl = classification.detected_url || '';
        if (!newUrl) {
          return NextResponse.json({ error: 'No URL detected in instruction' }, { status: 400 });
        }
        results = await updateLinksForRequest(requestId, newUrl, batchId, authCtx.userId);

        // Also update selected copy assets if any
        for (const assetId of assetIds) {
          const result = await reviseCopyAsset(assetId, instruction, batchId, authCtx.userId);
          results.push(result);
        }
        break;
      }

      case 'locale_add': {
        if (!excelBuffer) {
          return NextResponse.json({ error: 'Excel file required when adding new locales' }, { status: 400 });
        }

        // Parse Excel
        const { parseLocaleExcel } = await import('@/lib/excel-parser');
        const locales = parseLocaleExcel(Buffer.from(excelBuffer));

        if (!locales.length) {
          return NextResponse.json({ error: 'No valid locale rows found in Excel' }, { status: 400 });
        }

        // Check for duplicates
        const existingRegions = (campaign.target_regions || []) as string[];
        const dupes = locales.filter(l => existingRegions.includes(l.country));
        if (dupes.length > 0) {
          return NextResponse.json({
            error: `These countries already exist: ${dupes.map(d => d.country).join(', ')}`,
          }, { status: 400 });
        }

        newCountries = locales.map(l => l.country);

        // Merge into form_data.locale_links + target_regions
        const currentLinks = ((campaign.form_data as Record<string, unknown>)?.locale_links || []) as Array<Record<string, string>>;
        const mergedLinks = [
          ...currentLinks,
          ...locales.map(l => ({ url: l.url, label: l.label || l.country })),
        ];

        await sql`
          UPDATE intake_requests
          SET form_data = jsonb_set(COALESCE(form_data, '{}'::jsonb), '{locale_links}', ${JSON.stringify(mergedLinks)}::jsonb),
              target_regions = array_cat(COALESCE(target_regions, '{}'), ${newCountries}::text[])
          WHERE id = ${requestId}::uuid
        `;

        // Create generate_country jobs for each new country
        for (const locale of locales) {
          await createComputeJob({
            request_id: requestId,
            job_type: 'generate_country',
            feedback_data: {
              country: locale.country,
              persona_count: 2,
              actors_per_persona: 1,
              ada_form_url: locale.url,
            },
          });
          jobsCreated++;
        }

        // Update status to generating for new countries
        await sql`
          UPDATE intake_requests SET status = 'generating' WHERE id = ${requestId}::uuid
        `;
        break;
      }
    }

    // Release edit lock
    await sql`
      UPDATE intake_requests SET edit_lock = NULL WHERE id = ${requestId}::uuid
    `;

    // Count results
    const updated = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const failedAssets = results.filter(r => !r.success).map(r => ({ id: r.asset_id, error: r.error || 'Unknown error' }));

    // Send notification
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onetake.oneforma.com';
    await sendTeamsNotification({
      title: classification.action_type === 'locale_add'
        ? `New Countries Added — ${campaign.title}`
        : `Campaign Edited — ${campaign.title}`,
      subtitle: instruction.slice(0, 200),
      facts: [
        { title: 'Action', value: classification.action_type },
        { title: 'Assets Updated', value: String(updated || jobsCreated) },
        { title: 'Edited By', value: authCtx.email || authCtx.userId },
      ],
      actionUrl: `${appUrl}/intake/${requestId}`,
      actionLabel: 'View Campaign',
    }).catch(() => {}); // Non-fatal

    const statusCode = failed > 0 && updated > 0 ? 207 : failed > 0 ? 500 : 200;

    return NextResponse.json({
      action_type: classification.action_type,
      batch_id: batchId,
      assets_updated: updated,
      assets_failed: failed,
      failed_assets: failedAssets,
      jobs_created: jobsCreated || undefined,
      new_countries: newCountries.length > 0 ? newCountries : undefined,
    }, { status: statusCode });
  } catch (e) {
    // Release lock on error
    await sql`
      UPDATE intake_requests SET edit_lock = NULL WHERE id = ${requestId}::uuid
    `;
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/intake/[id]/edit/route.ts
git commit -m "feat: add campaign edit API route with classification and execution"
```

---

### Task 6: Rollback API Route

**Files:**
- Create: `src/app/api/intake/[id]/edit/rollback/route.ts`

- [ ] **Step 1: Create the rollback route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, canEditCampaign } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { rollbackBatch } from '@/lib/edit-executor';
import { sendTeamsNotification } from '@/lib/notifications/teams';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: requestId } = await params;
  const sql = getDb();

  // Fetch campaign
  const rows = await sql`
    SELECT id, status, created_by, title FROM intake_requests WHERE id = ${requestId}
  `;
  const campaign = rows[0];
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (!canEditCampaign(authCtx, campaign.created_by, campaign.status)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const body = await request.json();
  const { batch_id } = body;

  if (!batch_id) {
    return NextResponse.json({ error: 'batch_id is required' }, { status: 400 });
  }

  const reverted = await rollbackBatch(requestId, batch_id);

  // Notify
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onetake.oneforma.com';
  await sendTeamsNotification({
    title: `Edit Rolled Back — ${campaign.title}`,
    subtitle: `${reverted} assets reverted to previous version`,
    facts: [
      { title: 'Batch ID', value: batch_id.slice(0, 8) },
      { title: 'Assets Reverted', value: String(reverted) },
      { title: 'By', value: authCtx.email || authCtx.userId },
    ],
    actionUrl: `${appUrl}/intake/${requestId}`,
    actionLabel: 'View Campaign',
  }).catch(() => {});

  return NextResponse.json({
    assets_reverted: reverted,
    batch_id,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/intake/[id]/edit/rollback/route.ts
git commit -m "feat: add batch rollback API route"
```

---

### Task 7: Excel Parser for Locale Additions

**Files:**
- Create: `src/lib/excel-parser.ts`

- [ ] **Step 1: Install xlsx dependency**

```bash
npm install xlsx
```

- [ ] **Step 2: Create the Excel parser**

```typescript
/**
 * Parse locale Excel files for the locale_add edit action.
 * Required columns: country, url
 * Optional columns: label
 */

import * as XLSX from 'xlsx';

export interface LocaleRow {
  country: string;  // ISO code (BR, MX, CO)
  url: string;      // Aidaform or job posting URL
  label?: string;   // Display name (defaults to country)
}

export function parseLocaleExcel(buffer: Buffer): LocaleRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const results: LocaleRow[] = [];

  for (const row of rows) {
    // Normalize column names (case-insensitive, trim whitespace)
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.toLowerCase().trim()] = String(value || '').trim();
    }

    const country = normalized.country || normalized.country_code || normalized.locale || '';
    const url = normalized.url || normalized.link || normalized.aidaform || '';

    if (!country || !url) continue;

    // Validate URL
    try {
      new URL(url);
    } catch {
      continue; // Skip invalid URLs
    }

    results.push({
      country: country.toUpperCase().slice(0, 3),
      url,
      label: normalized.label || normalized.name || undefined,
    });
  }

  return results;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/excel-parser.ts package.json package-lock.json
git commit -m "feat: add Excel parser for locale additions"
```

---

### Task 8: Frontend — Edit Mode Component

**Files:**
- Create: `src/components/campaign/EditMode.tsx`

- [ ] **Step 1: Create the EditMode component**

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Pencil, X, Upload, Send, Undo2, CheckSquare, Square, Loader2 } from 'lucide-react';

interface EditModeProps {
  requestId: string;
  campaignTitle: string;
  allAssetIds: string[];
  onEditComplete?: () => void;
}

interface EditState {
  active: boolean;
  selectedIds: Set<string>;
  instruction: string;
  excelFile: File | null;
  submitting: boolean;
  lastBatchId: string | null;
  result: {
    action_type: string;
    assets_updated: number;
    assets_failed: number;
    jobs_created?: number;
    new_countries?: string[];
  } | null;
}

export function EditMode({ requestId, campaignTitle, allAssetIds, onEditComplete }: EditModeProps) {
  const [state, setState] = useState<EditState>({
    active: false,
    selectedIds: new Set(),
    instruction: '',
    excelFile: null,
    submitting: false,
    lastBatchId: null,
    result: null,
  });

  const toggleSelect = useCallback((id: string) => {
    setState(prev => {
      const next = new Set(prev.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, selectedIds: next };
    });
  }, []);

  const selectAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIds: new Set(allAssetIds),
    }));
  }, [allAssetIds]);

  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedIds: new Set() }));
  }, []);

  const handleSubmit = async () => {
    if (!state.instruction.trim() || state.selectedIds.size === 0) return;

    setState(prev => ({ ...prev, submitting: true }));

    try {
      const formData = new FormData();
      formData.append('instruction', state.instruction);
      formData.append('asset_ids', JSON.stringify([...state.selectedIds]));
      if (state.excelFile) {
        formData.append('excel_file', state.excelFile);
      }

      const res = await fetch(`/api/intake/${requestId}/edit`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok || res.status === 207) {
        setState(prev => ({
          ...prev,
          submitting: false,
          result: data,
          lastBatchId: data.batch_id,
          instruction: '',
          selectedIds: new Set(),
          excelFile: null,
        }));
      } else {
        alert(data.error || 'Edit failed');
        setState(prev => ({ ...prev, submitting: false }));
      }
    } catch (e) {
      alert('Network error');
      setState(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleUndo = async () => {
    if (!state.lastBatchId) return;

    const res = await fetch(`/api/intake/${requestId}/edit/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: state.lastBatchId }),
    });

    if (res.ok) {
      setState(prev => ({ ...prev, result: null, lastBatchId: null }));
      onEditComplete?.();
    }
  };

  // Not in edit mode — just show the toggle button
  if (!state.active) {
    return (
      <button
        onClick={() => setState(prev => ({ ...prev, active: true }))}
        className="btn-secondary flex items-center gap-2 cursor-pointer"
      >
        <Pencil size={14} />
        Edit Campaign
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Success banner */}
      {state.result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex justify-between items-center">
          <div>
            <span className="text-sm font-medium text-green-800">
              {state.result.action_type === 'locale_add'
                ? `${state.result.jobs_created} new countries queued`
                : `${state.result.assets_updated} assets updated`}
            </span>
            {state.result.assets_failed > 0 && (
              <span className="text-sm text-red-600 ml-2">
                ({state.result.assets_failed} failed)
              </span>
            )}
          </div>
          <button
            onClick={handleUndo}
            className="btn-secondary text-xs flex items-center gap-1 cursor-pointer"
          >
            <Undo2 size={12} /> Undo
          </button>
        </div>
      )}

      {/* Selection controls */}
      <div className="flex items-center gap-3 text-sm">
        <button onClick={selectAll} className="text-[#0693E3] cursor-pointer hover:underline">
          Select All ({allAssetIds.length})
        </button>
        <button onClick={clearSelection} className="text-[#737373] cursor-pointer hover:underline">
          Clear
        </button>
        <span className="text-[#737373]">{state.selectedIds.size} selected</span>
        <button
          onClick={() => setState(prev => ({ ...prev, active: false, selectedIds: new Set(), instruction: '', excelFile: null, result: null }))}
          className="ml-auto text-[#737373] cursor-pointer hover:text-[#1A1A1A]"
        >
          <X size={16} />
        </button>
      </div>

      {/* Sticky edit bar */}
      <div className="sticky bottom-4 bg-white border border-[#E5E5E5] rounded-xl shadow-lg p-4 space-y-3">
        <textarea
          value={state.instruction}
          onChange={e => setState(prev => ({ ...prev, instruction: e.target.value }))}
          placeholder="Describe the change... (e.g., 'Change compensation from $15/hr to $18/hr')"
          rows={2}
          className="w-full border border-[#E5E5E5] rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-[#0693E3]"
          maxLength={2000}
        />

        <div className="flex items-center gap-3">
          {/* Excel upload */}
          <label className="btn-secondary text-xs flex items-center gap-1 cursor-pointer">
            <Upload size={12} />
            {state.excelFile ? state.excelFile.name : 'Attach Excel'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => setState(prev => ({ ...prev, excelFile: e.target.files?.[0] || null }))}
            />
          </label>

          <span className="text-xs text-[#737373] flex-1">
            {state.instruction.length}/2000
          </span>

          <button
            onClick={handleSubmit}
            disabled={state.submitting || !state.instruction.trim() || state.selectedIds.size === 0}
            className="btn-primary flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {state.submitting ? (
              <><Loader2 size={14} className="animate-spin" /> Applying...</>
            ) : (
              <><Send size={14} /> Apply Edit ({state.selectedIds.size})</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Checkbox component for use inside asset cards when edit mode is active.
 */
export function EditCheckbox({
  assetId,
  selected,
  onToggle,
}: {
  assetId: string;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(assetId); }}
      className="cursor-pointer p-1"
    >
      {selected ? (
        <CheckSquare size={18} className="text-[#0693E3]" />
      ) : (
        <Square size={18} className="text-[#737373]" />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/campaign/EditMode.tsx
git commit -m "feat: add EditMode component with selection, instruction bar, and undo"
```

---

### Task 9: Wire Edit Mode into Campaign Workspace

**Files:**
- Modify: `src/app/intake/[id]/page.tsx`

- [ ] **Step 1: Import EditMode and wire it into the workspace**

In the workspace page, add:

```typescript
import { EditMode } from '@/components/campaign/EditMode';
```

In the header area (near the "Request Paid Media" button), render the EditMode button when the user can edit:

```typescript
{canEdit && (
  <EditMode
    requestId={request.id}
    campaignTitle={request.title}
    allAssetIds={allAssets.map(a => a.id)}
    onEditComplete={() => window.location.reload()}
  />
)}
```

Where `canEdit` is derived from the new permission:

```typescript
import { canEditCampaign } from '@/lib/permissions';
const canEdit = authCtx ? canEditCampaign(authCtx, request.created_by, request.status) : false;
```

Collect all asset IDs from the fetched assets:

```typescript
const allAssets = await sql`
  SELECT id FROM generated_assets WHERE request_id = ${requestId}
`;
const allAssetIds = allAssets.map((a: { id: string }) => a.id);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/intake/[id]/page.tsx
git commit -m "feat: wire EditMode into campaign workspace"
```

---

### Task 10: Integration Test — Copy Update Flow

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test copy_update via API**

```bash
curl -X POST http://localhost:3000/api/intake/TEST_REQUEST_ID/edit \
  -H "Content-Type: application/json" \
  -d '{"instruction": "Change compensation from $15/hr to $18/hr", "asset_ids": ["ASSET_ID_1", "ASSET_ID_2"]}'
```

Verify:
- Returns 200 with `action_type: 'copy_update'`
- `assets_updated` matches count
- `batch_id` is a UUID
- Assets in DB have updated content + `edit_history` entry with `batch_id`
- `version` incremented

- [ ] **Step 3: Test rollback**

```bash
curl -X POST http://localhost:3000/api/intake/TEST_REQUEST_ID/edit/rollback \
  -H "Content-Type: application/json" \
  -d '{"batch_id": "BATCH_ID_FROM_STEP_2"}'
```

Verify:
- Returns 200 with `assets_reverted` count
- Assets restored to pre-edit content
- Edit history entry removed

- [ ] **Step 4: Test link_update**

```bash
curl -X POST http://localhost:3000/api/intake/TEST_REQUEST_ID/edit \
  -H "Content-Type: application/json" \
  -d '{"instruction": "Update Aidaform link to https://new-form.aidaform.com/morocco", "asset_ids": []}'
```

Verify:
- Returns 200 with `action_type: 'link_update'`
- `form_data.ada_form_url` updated on intake_request
- Flyer assets have updated `qr_destination`

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes for edit hub"
```
