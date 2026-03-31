import { getDb } from '@/lib/db';
import { validateMagicLink } from '@/lib/db/magic-links';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return Response.json({ error: 'Magic link token is required' }, { status: 401 });
    }

    const magicLink = await validateMagicLink(token);
    if (!magicLink || magicLink.request_id !== id) {
      return Response.json({ error: 'Invalid or expired magic link' }, { status: 401 });
    }

    const sql = getDb();

    // Check that at least one upload exists
    let uploads: any[] = [];
    try {
      uploads = await sql`SELECT id FROM designer_uploads WHERE request_id = ${id} LIMIT 1`;
    } catch {
      // Table may not exist yet
    }

    if (uploads.length === 0) {
      return Response.json({ error: 'Upload at least one file before submitting finals' }, { status: 400 });
    }

    // Update request status to 'sent'
    await sql`UPDATE intake_requests SET status = 'sent', updated_at = NOW() WHERE id = ${id}`;

    // Get request title for notification
    const [req] = await sql`SELECT title, created_by FROM intake_requests WHERE id = ${id}`;

    // Create notification record
    try {
      await sql`
        INSERT INTO notifications (id, user_id, type, title, message, link, created_at)
        VALUES (
          gen_random_uuid(),
          ${req.created_by},
          'finals_submitted',
          ${'Designer submitted finals'},
          ${'Finals submitted for ' + req.title},
          ${'/intake/' + id},
          NOW()
        )
      `;
    } catch {
      // Notification table schema may differ — non-critical
    }

    // Send Teams webhook if configured
    try {
      const teamsUrl = process.env.TEAMS_WEBHOOK_URL;
      if (teamsUrl) {
        await fetch(teamsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            '@type': 'MessageCard',
            '@context': 'http://schema.org/extensions',
            summary: `Designer submitted finals for ${req.title}`,
            themeColor: '22c55e',
            title: 'Designer Finals Submitted',
            sections: [{
              facts: [
                { name: 'Campaign', value: req.title },
                { name: 'Status', value: 'Finals delivered' },
              ],
            }],
            potentialAction: [{
              '@type': 'OpenUri',
              name: 'Review Campaign',
              targets: [{ os: 'default', uri: `${process.env.NEXT_PUBLIC_APP_URL || 'https://nova-intake.vercel.app'}/intake/${id}` }],
            }],
          }),
        });
      }
    } catch {
      // Teams notification failure is non-critical
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to submit finals' },
      { status: 500 }
    );
  }
}
