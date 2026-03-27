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

    if (!token) {
      return Response.json(
        { error: 'Magic link token is required' },
        { status: 401 }
      );
    }

    // Validate magic link
    const magicLink = await validateMagicLink(token);

    if (!magicLink) {
      return Response.json(
        { error: 'Invalid or expired magic link' },
        { status: 401 }
      );
    }

    // Ensure the magic link matches this request
    if (magicLink.request_id !== id) {
      return Response.json(
        { error: 'Token does not match this request' },
        { status: 401 }
      );
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
