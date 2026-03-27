import { put } from '@vercel/blob';

export async function uploadToBlob(file: File, folder: string): Promise<string> {
  const blob = await put(`${folder}/${file.name}`, file, { access: 'public' });
  return blob.url;
}

export async function uploadBufferToBlob(buffer: Buffer, filename: string, folder: string): Promise<string> {
  const blob = await put(`${folder}/${filename}`, buffer, { access: 'public' });
  return blob.url;
}
