import { auth, currentUser } from '@clerk/nextjs/server';
import { getUserRole, isAllowedDomain } from '@/lib/db/user-roles';
import type { UserRole } from '@/lib/types';

export async function requireAuth(): Promise<{ userId: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return { userId };
}

export async function requireRole(
  allowedRoles: UserRole[]
): Promise<{ userId: string; role: UserRole }> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // Get email from Clerk for email-based role lookup
  let email: string | undefined;
  try {
    const user = await currentUser();
    email = user?.emailAddresses?.[0]?.emailAddress;
  } catch {
    // currentUser may fail in some contexts — proceed without email
  }

  // Domain restriction: reject users from non-allowed email domains
  if (email && !isAllowedDomain(email)) {
    throw new Error('Forbidden');
  }

  const userRole = await getUserRole(userId, email);

  // New signups default to recruiter — full analytics access
  const role = (userRole?.role as UserRole) ?? 'recruiter';

  if (!allowedRoles.includes(role)) {
    throw new Error('Forbidden');
  }

  return { userId, role };
}
