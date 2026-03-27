import { auth } from '@clerk/nextjs/server';
import { uploadToBlob } from '@/lib/blob';

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json(
        { error: 'No file provided. Send a file in the "file" form field.' },
        { status: 400 }
      );
    }

    const url = await uploadToBlob(file, 'attachments');

    return Response.json({
      url,
      filename: file.name,
    });
  } catch (error) {
    console.error('[api/extract/upload] Upload failed:', error);
    return Response.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
