import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listProjects, createProject, searchProjectsByFuzzy } from '@/lib/db/projects';

export async function GET(req: NextRequest) {
  await requireAuth();
  const status = req.nextUrl.searchParams.get('status') ?? undefined;
  const search = req.nextUrl.searchParams.get('search');

  if (search) {
    const results = await searchProjectsByFuzzy(search);
    return NextResponse.json(results);
  }

  const projects = await listProjects(status);
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  await requireAuth();
  const body = await req.json();

  if (!body.codename || !body.display_name) {
    return NextResponse.json({ error: 'codename and display_name required' }, { status: 400 });
  }

  const project = await createProject(body);
  return NextResponse.json(project, { status: 201 });
}
