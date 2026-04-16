import { getDb } from '@/lib/db';
import { validateMagicLink } from '@/lib/db/magic-links';
import { uploadToBlob } from '@/lib/blob';

interface DesignerUpload {
  id: string;
  request_id: string;
  original_asset_id: string | null;
  file_name: string;
  blob_url: string;
  uploaded_by: string;
  created_at: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const formData = await request.formData();
    const token = formData.get('token') as string | null;
    const file = formData.get('file') as File | null;
    const originalAssetId = formData.get('original_asset_id') as string | null;

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

    if (!file) {
      return Response.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const blobUrl = await uploadToBlob(file, 'designer-uploads');

    // Create designer_uploads record
    const sql = getDb();
    const rows = await sql`
      INSERT INTO designer_uploads (request_id, original_asset_id, file_name, blob_url, uploaded_by)
      VALUES (
        ${id},
        ${originalAssetId},
        ${file.name},
        ${blobUrl},
        ${'designer'}
      )
      RETURNING *
    `;

    return Response.json(rows[0] as DesignerUpload, { status: 201 });
  } catch (error) {
    console.error('[api/designer/[id]/upload] Failed to upload:', error);
    return Response.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
