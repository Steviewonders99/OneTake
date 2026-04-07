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
    // We need three separate branches because we can't parameterize a column name
    // in the template-tagged sql client — substituting ${field} would escape it
    // as a value, not an identifier.
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
