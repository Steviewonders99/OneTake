// src/lib/db/projects.ts — Project registry data access
import { getDb } from '@/lib/db';
import type { Project, ProjectAlias, AliasSuggestion } from '@/lib/types/projects';

// ── CRUD ──────────────────────────────────────────────────────────────

export async function listProjects(status?: string): Promise<Project[]> {
  const sql = getDb();
  if (status) {
    const rows = await sql`
      SELECT * FROM projects WHERE status = ${status} ORDER BY codename
    `;
    return rows as Project[];
  }
  const rows = await sql`SELECT * FROM projects ORDER BY codename`;
  return rows as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
  return (rows[0] as Project) ?? null;
}

export async function getProjectByCodename(codename: string): Promise<Project | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM projects WHERE codename = ${codename.toLowerCase().trim()}
  `;
  return (rows[0] as Project) ?? null;
}

export async function createProject(data: {
  codename: string;
  display_name: string;
  wp_job_id?: number;
  wp_slug?: string;
  wp_published_at?: string;
  countries?: string[];
  status?: string;
}): Promise<Project> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO projects (codename, display_name, wp_job_id, wp_slug, wp_published_at, countries, status)
    VALUES (
      ${data.codename.toLowerCase().trim()},
      ${data.display_name},
      ${data.wp_job_id ?? null},
      ${data.wp_slug ?? null},
      ${data.wp_published_at ?? null},
      ${data.countries ?? []},
      ${data.status ?? 'active'}
    )
    RETURNING *
  `;
  return rows[0] as Project;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, 'display_name' | 'status' | 'countries' | 'wp_job_id' | 'wp_slug' | 'intake_id'>>
): Promise<Project | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE projects SET
      display_name = COALESCE(${updates.display_name ?? null}, display_name),
      status       = COALESCE(${updates.status ?? null}, status),
      countries    = COALESCE(${updates.countries ?? null}, countries),
      wp_job_id    = COALESCE(${updates.wp_job_id ?? null}, wp_job_id),
      wp_slug      = COALESCE(${updates.wp_slug ?? null}, wp_slug),
      intake_id    = COALESCE(${updates.intake_id ?? null}, intake_id),
      updated_at   = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as Project) ?? null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`DELETE FROM projects WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

// ── Aliases ───────────────────────────────────────────────────────────

export async function listAliases(projectId: string): Promise<ProjectAlias[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM project_aliases WHERE project_id = ${projectId} ORDER BY confidence DESC
  `;
  return rows as ProjectAlias[];
}

export async function addAlias(
  projectId: string,
  alias: string,
  source: ProjectAlias['source'] = 'manual',
  confidence: number = 1.0
): Promise<ProjectAlias> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO project_aliases (project_id, alias, source, confidence)
    VALUES (${projectId}, ${alias.toLowerCase().trim()}, ${source}, ${confidence})
    ON CONFLICT (alias) DO UPDATE SET
      confidence = GREATEST(project_aliases.confidence, EXCLUDED.confidence)
    RETURNING *
  `;
  return rows[0] as ProjectAlias;
}

export async function deleteAlias(aliasId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`DELETE FROM project_aliases WHERE id = ${aliasId} RETURNING id`;
  return rows.length > 0;
}

// ── Fuzzy Search ──────────────────────────────────────────────────────

export async function searchProjectsByFuzzy(
  query: string,
  minSimilarity = 0.3
): Promise<(Project & { similarity: number })[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT p.*, greatest(
      similarity(${query.toLowerCase()}, p.codename),
      COALESCE((SELECT max(similarity(${query.toLowerCase()}, pa.alias))
                FROM project_aliases pa WHERE pa.project_id = p.id), 0)
    ) AS similarity
    FROM projects p
    WHERE greatest(
      similarity(${query.toLowerCase()}, p.codename),
      COALESCE((SELECT max(similarity(${query.toLowerCase()}, pa.alias))
                FROM project_aliases pa WHERE pa.project_id = p.id), 0)
    ) >= ${minSimilarity}
    ORDER BY similarity DESC
    LIMIT 10
  `;
  return rows as (Project & { similarity: number })[];
}

// ── Seeding ───────────────────────────────────────────────────────────

export async function seedFromWp(data: {
  codename: string;
  display_name: string;
  wp_job_id: number;
  wp_slug: string;
  wp_published_at: string;
  countries?: string[];
}): Promise<string> {
  const sql = getDb();
  const rows = await sql`
    SELECT seed_project_from_wp(
      ${data.codename}, ${data.display_name},
      ${data.wp_job_id}, ${data.wp_slug},
      ${data.wp_published_at}::TIMESTAMPTZ,
      ${data.countries ?? []}::TEXT[]
    ) AS id
  `;
  return rows[0].id as string;
}

export async function linkIntakeToProjects(): Promise<number> {
  const sql = getDb();
  const rows = await sql`SELECT link_intake_to_projects() AS count`;
  return rows[0].count as number;
}

export async function discoverAliases(minSimilarity = 0.35): Promise<AliasSuggestion[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM discover_aliases(${minSimilarity})`;
  return rows as AliasSuggestion[];
}
