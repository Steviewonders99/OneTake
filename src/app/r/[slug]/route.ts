import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Guard against obviously invalid slugs before hitting the DB
  if (!/^[0-9A-Za-z]{6}$/.test(slug)) {
    return notFoundResponse();
  }

  const sql = getDb();
  const rows = await sql`
    UPDATE tracked_links
       SET click_count = click_count + 1,
           last_clicked_at = NOW()
     WHERE slug = ${slug}
     RETURNING destination_url
  ` as unknown as Array<{ destination_url: string }>;

  if (rows.length === 0) {
    return notFoundResponse();
  }

  return Response.redirect(rows[0].destination_url, 301);
}

function notFoundResponse(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Link not found — Nova</title>
  <style>
    :root { --fg: #1A1A1A; --muted: #737373; --border: #E5E5E5; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
      background: #FFFFFF;
      color: var(--fg);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .grad { height: 3px; background: linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224)); position: fixed; top: 0; left: 0; right: 0; }
    .card { max-width: 440px; text-align: center; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: var(--muted); font-size: 15px; line-height: 1.5; margin: 0 0 24px; }
    a { text-decoration: none; font-weight: 600; padding: 10px 24px; border-radius: 9999px; background: #32373C; color: #fff; display: inline-block; }
    a:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="grad"></div>
  <div class="card">
    <h1>This link is no longer active</h1>
    <p>The short link you followed isn't valid. It may have been removed or mistyped.</p>
    <a href="/">Back to Nova</a>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
