import { getAuthContext } from '@/lib/permissions';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return Response.json({ userId: ctx.userId, role: ctx.role });
}
