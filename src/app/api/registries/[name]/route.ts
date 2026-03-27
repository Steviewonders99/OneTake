import { getRegistryOptions } from '@/lib/db/registries';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const options = await getRegistryOptions(name);
    return Response.json(options);
  } catch (error) {
    console.error('[api/registries/[name]] Failed to get registry options:', error);
    return Response.json(
      { error: 'Failed to get registry options' },
      { status: 500 }
    );
  }
}
