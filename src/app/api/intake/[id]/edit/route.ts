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
    if (lockAge < 5 * 60 * 1000) {
      return NextResponse.json({
        error: 'Campaign is being edited by another user. Try again in a moment.',
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
        for (const assetId of assetIds) {
          const result = await reviseCopyAsset(assetId, instruction, batchId, authCtx.userId);
          results.push(result);
        }
        break;
      }

      case 'link_update': {
        const newUrl = classification.detected_url || '';
        if (!newUrl) {
          await sql`UPDATE intake_requests SET edit_lock = NULL WHERE id = ${requestId}::uuid`;
          return NextResponse.json({ error: 'No URL detected in instruction' }, { status: 400 });
        }
        results = await updateLinksForRequest(requestId, newUrl, batchId, authCtx.userId);

        for (const assetId of assetIds) {
          const result = await reviseCopyAsset(assetId, instruction, batchId, authCtx.userId);
          results.push(result);
        }
        break;
      }

      case 'locale_add': {
        if (!excelBuffer) {
          await sql`UPDATE intake_requests SET edit_lock = NULL WHERE id = ${requestId}::uuid`;
          return NextResponse.json({ error: 'Excel file required when adding new locales' }, { status: 400 });
        }

        const { parseLocaleExcel } = await import('@/lib/excel-parser');
        const locales = parseLocaleExcel(Buffer.from(excelBuffer));

        if (!locales.length) {
          await sql`UPDATE intake_requests SET edit_lock = NULL WHERE id = ${requestId}::uuid`;
          return NextResponse.json({ error: 'No valid locale rows found in Excel' }, { status: 400 });
        }

        const existingRegions = (campaign.target_regions || []) as string[];
        const dupes = locales.filter(l => existingRegions.includes(l.country));
        if (dupes.length > 0) {
          await sql`UPDATE intake_requests SET edit_lock = NULL WHERE id = ${requestId}::uuid`;
          return NextResponse.json({
            error: `These countries already exist: ${dupes.map(d => d.country).join(', ')}`,
          }, { status: 400 });
        }

        newCountries = locales.map(l => l.country);

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

    const updated = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const failedAssets = results.filter(r => !r.success).map(r => ({ id: r.asset_id, error: r.error || 'Unknown error' }));

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
    }).catch(() => {});

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
    await sql`
      UPDATE intake_requests SET edit_lock = NULL WHERE id = ${requestId}::uuid
    `;
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
