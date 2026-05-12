import { getDb } from '../db';

const ALLOWED_EMAIL_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || 'centific.com,oneforma.com').split(',');

export function isAllowedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

export interface UserRoleRecord {
  id: string;
  clerk_id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUserRole(clerkId: string, email?: string): Promise<UserRoleRecord | null> {
  const sql = getDb();

  // Try by clerk_id first (exact match)
  const rows = await sql`
    SELECT * FROM user_roles WHERE clerk_id = ${clerkId} AND is_active = TRUE LIMIT 1
  `;
  if (rows[0]) {
    return rows[0] as UserRoleRecord;
  }

  // Fallback: try by email (handles first login before clerk_id is linked)
  if (email) {
    const emailRows = await sql`
      SELECT * FROM user_roles WHERE email = ${email} AND is_active = TRUE LIMIT 1
    `;
    if (emailRows[0]) {
      // Auto-link this clerk_id to the email-matched role
      await sql`
        UPDATE user_roles SET clerk_id = ${clerkId}, updated_at = NOW()
        WHERE id = ${(emailRows[0] as UserRoleRecord).id}
      `;
      return emailRows[0] as UserRoleRecord;
    }
  }

  // Auto-provision: new users get 'recruiter' role — only for allowed domains
  if (email && isAllowedDomain(email)) {
    const newRows = await sql`
      INSERT INTO user_roles (clerk_id, email, role)
      VALUES (${clerkId}, ${email}, 'recruiter')
      ON CONFLICT (clerk_id) DO NOTHING
      RETURNING *
    `;
    if (newRows[0]) {
      return newRows[0] as UserRoleRecord;
    }
  }

  return null;
}

export async function listUsers(): Promise<UserRoleRecord[]> {
  const sql = getDb();
  return await sql`
    SELECT * FROM user_roles WHERE is_active = TRUE ORDER BY created_at DESC
  ` as UserRoleRecord[];
}

export async function createUserRole(data: {
  clerk_id: string;
  email: string;
  name?: string | null;
  role: string;
  invited_by?: string | null;
}): Promise<UserRoleRecord> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO user_roles (clerk_id, email, name, role, invited_by)
    VALUES (${data.clerk_id}, ${data.email}, ${data.name ?? null}, ${data.role}, ${data.invited_by ?? null})
    RETURNING *
  `;
  return rows[0] as UserRoleRecord;
}

export async function updateUserRole(
  clerkId: string,
  data: { role?: string; name?: string | null; email?: string }
): Promise<UserRoleRecord | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE user_roles
    SET
      role = COALESCE(${data.role ?? null}, role),
      name = COALESCE(${data.name ?? null}, name),
      email = COALESCE(${data.email ?? null}, email),
      updated_at = NOW()
    WHERE clerk_id = ${clerkId}
    RETURNING *
  `;
  return (rows[0] as UserRoleRecord) ?? null;
}

export async function deactivateUser(clerkId: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE user_roles SET is_active = FALSE, updated_at = NOW() WHERE clerk_id = ${clerkId}
  `;
}
