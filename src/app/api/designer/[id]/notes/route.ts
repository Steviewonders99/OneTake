import { getDb } from '@/lib/db';
import { validateMagicLink } from '@/lib/db/magic-links';

interface DesignerNote {
  id: string;
  request_id: string;
  asset_id: string;
  note_text: string;
  created_at: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { asset_id, note_text, token } = body;

    // Auth: accept either magic link token OR Clerk session
    let authorized = false;

    if (token) {
      const magicLink = await validateMagicLink(token);
      if (magicLink && magicLink.request_id === id) {
        authorized = true;
      }
    }

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

    if (!authorized) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!asset_id || !note_text) {
      return Response.json(
        { error: 'asset_id and note_text are required' },
        { status: 400 }
      );
    }

    const sql = getDb();

    // Ensure the designer_notes table exists
    await sql`
      CREATE TABLE IF NOT EXISTS designer_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
        asset_id UUID NOT NULL REFERENCES generated_assets(id) ON DELETE CASCADE,
        note_text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const rows = await sql`
      INSERT INTO designer_notes (request_id, asset_id, note_text)
      VALUES (${id}, ${asset_id}, ${note_text})
      RETURNING *
    `;

    return Response.json(rows[0] as DesignerNote, { status: 201 });
  } catch (error) {
    console.error('[api/designer/[id]/notes] Failed to save note:', error);
    return Response.json(
      { error: 'Failed to save note' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    // Auth: accept either magic link token OR Clerk session
    let authorized = false;

    if (token) {
      const magicLink = await validateMagicLink(token);
      if (magicLink && magicLink.request_id === id) {
        authorized = true;
      }
    }

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

    if (!authorized) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sql = getDb();

    // Ensure the designer_notes table exists
    await sql`
      CREATE TABLE IF NOT EXISTS designer_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
        asset_id UUID NOT NULL REFERENCES generated_assets(id) ON DELETE CASCADE,
        note_text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const rows = await sql`
      SELECT * FROM designer_notes
      WHERE request_id = ${id}
      ORDER BY created_at ASC
    `;

    return Response.json(rows as DesignerNote[]);
  } catch (error) {
    console.error('[api/designer/[id]/notes] Failed to get notes:', error);
    return Response.json(
      { error: 'Failed to get notes' },
      { status: 500 }
    );
  }
}
