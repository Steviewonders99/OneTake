/**
 * Public landing page route — serves generated HTML by campaign slug + persona key.
 *
 * URL format: /lp/{campaign-slug}--{persona_key}
 * Example:    /lp/twins-ai-study--gig_worker_flex
 *
 * No auth required — these are public-facing recruitment landing pages.
 * Fetches the HTML from Vercel Blob and serves with text/html content type.
 */
import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Parse slug: campaign-slug--persona_key
  const separatorIndex = slug.lastIndexOf('--');
  if (separatorIndex === -1) {
    return new Response('Not Found', { status: 404 });
  }

  const campaignSlug = slug.substring(0, separatorIndex);
  const personaKey = slug.substring(separatorIndex + 2);

  if (!campaignSlug || !personaKey) {
    return new Response('Not Found', { status: 404 });
  }

  try {
    const sql = getDb();

    // Find the request by campaign_slug
    const requests = await sql`
      SELECT id FROM intake_requests
      WHERE campaign_slug = ${campaignSlug}
      LIMIT 1
    `;

    if (requests.length === 0) {
      return new Response('Not Found', { status: 404 });
    }

    const requestId = requests[0].id;

    // Find the latest passing landing page asset for this persona
    const assets = await sql`
      SELECT blob_url FROM generated_assets
      WHERE request_id = ${requestId}
        AND asset_type = 'landing_page'
        AND evaluation_passed = true
        AND content->>'persona_key' = ${personaKey}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (assets.length === 0 || !assets[0].blob_url) {
      return new Response('Not Found', { status: 404 });
    }

    // Fetch the HTML from Vercel Blob
    const blobResponse = await fetch(assets[0].blob_url);
    if (!blobResponse.ok) {
      console.error(
        '[lp/[slug]] Blob fetch failed:',
        blobResponse.status,
        assets[0].blob_url,
      );
      return new Response('Landing page unavailable', { status: 502 });
    }

    const html = await blobResponse.text();

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
        'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https:; frame-ancestors 'none';",
      },
    });
  } catch (error) {
    console.error('[lp/[slug]] Failed to serve landing page:', error);
    return new Response('Server Error', { status: 500 });
  }
}
