import { auth, currentUser } from '@clerk/nextjs/server';
import { getUserRole } from '@/lib/db/user-roles';
import type { UserRole } from '@/lib/types';

function computeInitials(firstName: string | null, lastName: string | null): string {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f) return f[0].toUpperCase();
  if (l) return l[0].toUpperCase();
  return '??';
}

/** Split a full name into [firstName, lastName] using whitespace. Single-token → both equal. */
function splitName(full: string): [string, string] {
  const tokens = full.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return ['', ''];
  if (tokens.length === 1) return [tokens[0], tokens[0]];
  return [tokens[0], tokens[tokens.length - 1]];
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let email: string | undefined;
  let firstName: string | null = null;
  let lastName: string | null = null;

  try {
    const user = await currentUser();
    email = user?.emailAddresses?.[0]?.emailAddress;
    firstName = user?.firstName ?? null;
    lastName = user?.lastName ?? null;
  } catch {
    // currentUser may fail in some contexts
  }

  const userRole = await getUserRole(userId, email);
  const role = (userRole?.role as UserRole) ?? 'viewer';

  // Fallback: split user_roles.name if Clerk didn't give us first/last
  if ((!firstName || !lastName) && userRole?.name) {
    const [f, l] = splitName(userRole.name);
    firstName = firstName ?? f;
    lastName = lastName ?? l;
  }

  const initials = computeInitials(firstName, lastName);

  return Response.json({
    userId,
    role,
    email,
    firstName,
    lastName,
    initials,
  });
}
