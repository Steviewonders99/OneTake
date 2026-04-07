import { getAuthContext } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { getIntakeRequest } from '@/lib/db/intake';
import { slugify } from '@/lib/slugify';
import { buildDestinationUrl } from '@/lib/tracked-links/build-url';
import { generateSlug } from '@/lib/tracked-links/slug-generator';
import { isValidSource, isValidContentForSource, UTM_MEDIUM, type UtmSource } from '@/lib/tracked-links/source-options';

const MAX_TERM_LEN = 60;
const MAX_CONTENT_LEN = 60;
const MAX_SLUG_RETRIES = 5;

function getAppOrigin(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  try {
    return new URL(request.url).origin;
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'recruiter' && ctx.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: {
    request_id?: string;
    asset_id?: string | null;
    base_url?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_term?: string;
    utm_content?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.request_id || !body.base_url || !body.utm_source || !body.utm_term || !body.utm_content) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Allowlist validation: utm_source must be one of the 5 categories,
  // utm_content must belong to that source.
  if (!isValidSource(body.utm_source)) {
    return Response.json({ error: 'INVALID_SOURCE', message: 'utm_source must be one of: job_board, social, email, internal, influencer' }, { status: 400 });
  }
  if (!isValidContentForSource(body.utm_source as UtmSource, body.utm_content)) {
    return Response.json({ error: 'INVALID_CONTENT', message: 'utm_content must be a valid platform for the chosen source' }, { status: 400 });
  }

  const intake = await getIntakeRequest(body.request_id);
  if (!intake) {
    return Response.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (intake.status !== 'approved' && intake.status !== 'sent') {
    return Response.json(
      { error: 'Campaign must be approved before tracked links can be created' },
      { status: 403 }
    );
  }
  if (!intake.campaign_slug) {
    return Response.json(
      { error: 'CAMPAIGN_SLUG_NOT_SET', message: 'Campaign tracking code not set — contact admin.' },
      { status: 409 }
    );
  }

  // Readiness gate: at least one landing page URL must be set
  const sql = getDb();
  const lpRows = await sql`
    SELECT job_posting_url, landing_page_url, ada_form_url
      FROM campaign_landing_pages
     WHERE request_id = ${body.request_id}
     LIMIT 1
  ` as unknown as Array<{
    job_posting_url: string | null;
    landing_page_url: string | null;
    ada_form_url: string | null;
  }>;
  const lp = lpRows[0];

  const candidateUrls = [lp?.job_posting_url, lp?.landing_page_url, lp?.ada_form_url].filter(Boolean) as string[];
  if (candidateUrls.length === 0) {
    return Response.json(
      {
        error: 'LANDING_PAGES_NOT_SET',
        message: 'Marketing or designer must add at least one landing page URL before tracked links can be built.',
      },
      { status: 409 }
    );
  }
  if (!candidateUrls.includes(body.base_url)) {
    return Response.json({ error: 'INVALID_BASE_URL' }, { status: 400 });
  }

  // Server-side re-slugify (client state is untrusted)
  const utm_term = slugify(body.utm_term, MAX_TERM_LEN);
  const utm_content = body.utm_content; // already validated against allowlist above
  if (!utm_term) {
    return Response.json(
      { error: 'utm_term must contain at least one alphanumeric character' },
      { status: 400 }
    );
  }

  // utm_medium is locked to "referral" — ignore client input
  const utm_medium = UTM_MEDIUM;

  // Build the destination URL with all UTM params pre-appended
  const destination_url = buildDestinationUrl(body.base_url, {
    utm_campaign: intake.campaign_slug,
    utm_source: body.utm_source,
    utm_medium,
    utm_term,
    utm_content,
  });

  // Mint a unique slug with retry loop for the UNIQUE constraint
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = generateSlug();
    try {
      const rows = await sql`
        INSERT INTO tracked_links (
          slug, request_id, asset_id, recruiter_clerk_id,
          destination_url, base_url,
          utm_campaign, utm_source, utm_medium, utm_term, utm_content
        ) VALUES (
          ${slug}, ${body.request_id}, ${body.asset_id ?? null}, ${ctx.userId},
          ${destination_url}, ${body.base_url},
          ${intake.campaign_slug}, ${body.utm_source}, ${utm_medium}, ${utm_term}, ${utm_content}
        )
        RETURNING *
      `;
      const row = rows[0];
      const appOrigin = getAppOrigin(request);
      return Response.json({
        ...row,
        short_url: `${appOrigin}/r/${slug}`,
      });
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (attempt < MAX_SLUG_RETRIES - 1 && /duplicate|unique/i.test(msg)) {
        continue;
      }
      console.error('[api/tracked-links] POST failed:', e);
      if (/duplicate|unique/i.test(msg)) {
        return Response.json(
          { error: 'SLUG_COLLISION', message: 'Could not mint a unique slug. Try again.' },
          { status: 500 }
        );
      }
      return Response.json({ error: 'Failed to create tracked link' }, { status: 500 });
    }
  }

  return Response.json({ error: 'SLUG_COLLISION' }, { status: 500 });
}

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'recruiter' && ctx.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const request_id = url.searchParams.get('request_id');
  if (!request_id) {
    return Response.json({ error: 'request_id query param required' }, { status: 400 });
  }

  const sql = getDb();

  // Admin sees all links for this campaign; recruiter sees only their own.
  // LEFT JOIN on generated_assets so rows with a NULLed asset_id (from a
  // deleted creative) still appear in the list with null thumbnails.
  const rows = ctx.role === 'admin'
    ? await sql`
        SELECT
          tl.*,
          ga.blob_url AS asset_thumbnail,
          ga.platform AS asset_platform
        FROM tracked_links tl
        LEFT JOIN generated_assets ga ON tl.asset_id = ga.id
        WHERE tl.request_id = ${request_id}
        ORDER BY tl.click_count DESC, tl.created_at DESC
      `
    : await sql`
        SELECT
          tl.*,
          ga.blob_url AS asset_thumbnail,
          ga.platform AS asset_platform
        FROM tracked_links tl
        LEFT JOIN generated_assets ga ON tl.asset_id = ga.id
        WHERE tl.request_id = ${request_id}
          AND tl.recruiter_clerk_id = ${ctx.userId}
        ORDER BY tl.click_count DESC, tl.created_at DESC
      `;

  type Row = {
    id: string;
    slug: string;
    request_id: string;
    asset_id: string | null;
    recruiter_clerk_id: string;
    destination_url: string;
    base_url: string;
    utm_campaign: string;
    utm_source: string;
    utm_medium: string;
    utm_term: string;
    utm_content: string;
    click_count: number;
    last_clicked_at: string | null;
    created_at: string;
    asset_thumbnail: string | null;
    asset_platform: string | null;
  };
  const typedRows = rows as unknown as Row[];

  const appOrigin = getAppOrigin(request);
  const links = typedRows.map((r) => ({ ...r, short_url: `${appOrigin}/r/${r.slug}` }));

  // Compute summary aggregates
  const total_clicks = links.reduce((s, l) => s + l.click_count, 0);
  const total_links = links.length;

  // Best channel: group by utm_source, sum clicks, find max
  const channelTotals = new Map<string, number>();
  for (const l of links) {
    channelTotals.set(l.utm_source, (channelTotals.get(l.utm_source) ?? 0) + l.click_count);
  }
  let best_channel: { name: string; clicks: number; pct: number } | null = null;
  if (channelTotals.size > 0 && total_clicks > 0) {
    const sortedChannels = [...channelTotals.entries()].sort((a, b) => b[1] - a[1]);
    const [name, clicks] = sortedChannels[0];
    best_channel = { name, clicks, pct: Math.round((clicks / total_clicks) * 100) };
  }

  // Top creative: the link with the highest click count (must be > 0)
  let top_creative: { name: string; clicks: number; asset_id: string | null } | null = null;
  const topLink = links[0];
  if (topLink && topLink.click_count > 0) {
    top_creative = {
      name: topLink.utm_content,
      clicks: topLink.click_count,
      asset_id: topLink.asset_id,
    };
  }

  return Response.json({
    links,
    summary: {
      total_clicks,
      total_links,
      best_channel,
      top_creative,
    },
  });
}
