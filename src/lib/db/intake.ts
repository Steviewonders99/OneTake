import { getDb } from '../db';
import type { IntakeRequest, Status, Urgency } from '@/lib/types';

export async function createIntakeRequest(data: {
  title: string;
  task_type: string;
  urgency: Urgency;
  target_languages: string[];
  target_regions: string[];
  volume_needed?: number | null;
  created_by: string;
  form_data: Record<string, unknown>;
  schema_version: number;
  campaign_slug?: string | null;
  qualifications_required?: string | null;
  qualifications_preferred?: string | null;
  location_scope?: string | null;
  language_requirements?: string | null;
  engagement_model?: string | null;
  technical_requirements?: string | null;
  context_notes?: string | null;
}): Promise<IntakeRequest> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO intake_requests (
      title, task_type, urgency, target_languages, target_regions,
      volume_needed, created_by, form_data, schema_version, campaign_slug,
      qualifications_required, qualifications_preferred, location_scope,
      language_requirements, engagement_model, technical_requirements, context_notes
    )
    VALUES (
      ${data.title},
      ${data.task_type},
      ${data.urgency},
      ${data.target_languages},
      ${data.target_regions},
      ${data.volume_needed ?? null},
      ${data.created_by},
      ${JSON.stringify(data.form_data)},
      ${data.schema_version},
      ${data.campaign_slug ?? null},
      ${data.qualifications_required ?? null},
      ${data.qualifications_preferred ?? null},
      ${data.location_scope ?? null},
      ${data.language_requirements ?? null},
      ${data.engagement_model ?? null},
      ${data.technical_requirements ?? null},
      ${data.context_notes ?? null}
    )
    RETURNING *
  `;
  return rows[0] as IntakeRequest;
}

export async function listIntakeRequests(filters?: {
  status?: Status;
  task_type?: string;
  created_by?: string;
}): Promise<IntakeRequest[]> {
  const sql = getDb();

  // Build conditions array to compose WHERE clause dynamically
  const hasStatus = !!filters?.status;
  const hasTaskType = !!filters?.task_type;
  const hasCreatedBy = !!filters?.created_by;

  if (hasStatus && hasTaskType && hasCreatedBy) {
    const rows = await sql`
      SELECT * FROM intake_requests
      WHERE status = ${filters!.status!}
        AND task_type = ${filters!.task_type!}
        AND created_by = ${filters!.created_by!}
      ORDER BY created_at DESC
    `;
    return rows as IntakeRequest[];
  }

  if (hasStatus && hasTaskType) {
    const rows = await sql`
      SELECT * FROM intake_requests
      WHERE status = ${filters!.status!} AND task_type = ${filters!.task_type!}
      ORDER BY created_at DESC
    `;
    return rows as IntakeRequest[];
  }

  if (hasStatus && hasCreatedBy) {
    const rows = await sql`
      SELECT * FROM intake_requests
      WHERE status = ${filters!.status!} AND created_by = ${filters!.created_by!}
      ORDER BY created_at DESC
    `;
    return rows as IntakeRequest[];
  }

  if (hasTaskType && hasCreatedBy) {
    const rows = await sql`
      SELECT * FROM intake_requests
      WHERE task_type = ${filters!.task_type!} AND created_by = ${filters!.created_by!}
      ORDER BY created_at DESC
    `;
    return rows as IntakeRequest[];
  }

  if (hasStatus) {
    const rows = await sql`
      SELECT * FROM intake_requests
      WHERE status = ${filters!.status!}
      ORDER BY created_at DESC
    `;
    return rows as IntakeRequest[];
  }

  if (hasTaskType) {
    const rows = await sql`
      SELECT * FROM intake_requests
      WHERE task_type = ${filters!.task_type!}
      ORDER BY created_at DESC
    `;
    return rows as IntakeRequest[];
  }

  if (hasCreatedBy) {
    const rows = await sql`
      SELECT * FROM intake_requests
      WHERE created_by = ${filters!.created_by!}
      ORDER BY created_at DESC
    `;
    return rows as IntakeRequest[];
  }

  const rows = await sql`
    SELECT * FROM intake_requests
    ORDER BY created_at DESC
  `;
  return rows as IntakeRequest[];
}

export async function getIntakeRequest(id: string): Promise<IntakeRequest | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM intake_requests WHERE id = ${id}
  `;
  return (rows[0] as IntakeRequest) ?? null;
}

export async function updateIntakeRequest(
  id: string,
  data: Partial<{
    title: string;
    task_type: string;
    urgency: Urgency;
    target_languages: string[];
    target_regions: string[];
    volume_needed: number | null;
    status: Status;
    form_data: Record<string, unknown>;
    schema_version: number;
  }>
): Promise<IntakeRequest> {
  const sql = getDb();

  // Build SET clauses dynamically based on provided fields
  // We handle each possible field to keep the tagged template safe
  const rows = await sql`
    UPDATE intake_requests
    SET
      title = COALESCE(${data.title ?? null}, title),
      task_type = COALESCE(${data.task_type ?? null}, task_type),
      urgency = COALESCE(${data.urgency ?? null}, urgency),
      target_languages = COALESCE(${data.target_languages ?? null}, target_languages),
      target_regions = COALESCE(${data.target_regions ?? null}, target_regions),
      volume_needed = ${data.volume_needed !== undefined ? data.volume_needed : null},
      status = COALESCE(${data.status ?? null}, status),
      form_data = COALESCE(${data.form_data ? JSON.stringify(data.form_data) : null}, form_data),
      schema_version = COALESCE(${data.schema_version ?? null}, schema_version),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  if (rows.length === 0) {
    throw new Error(`Intake request not found: ${id}`);
  }
  return rows[0] as IntakeRequest;
}

export async function deleteIntakeRequest(id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM intake_requests WHERE id = ${id}`;
}
