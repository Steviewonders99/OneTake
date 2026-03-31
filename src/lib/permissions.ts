import { auth, currentUser } from '@clerk/nextjs/server';
import { getUserRole } from '@/lib/db/user-roles';
import type { UserRole } from '@/lib/types';

export interface AuthContext {
  userId: string;
  role: UserRole;
  email?: string;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  let email: string | undefined;
  try {
    const user = await currentUser();
    email = user?.emailAddresses?.[0]?.emailAddress;
  } catch {
    // currentUser may fail in some contexts
  }

  const userRole = await getUserRole(userId, email);
  const role = (userRole?.role as UserRole) ?? 'viewer';

  return { userId, role, email };
}

export function canAccessRequest(
  authCtx: AuthContext,
  requestCreatedBy: string | null
): boolean {
  if (authCtx.role === 'admin') return true;
  if (authCtx.role === 'recruiter') {
    return requestCreatedBy === authCtx.userId;
  }
  if (authCtx.role === 'viewer') return true;
  return false;
}

export function canEditRequest(
  authCtx: AuthContext,
  requestCreatedBy: string | null,
  requestStatus: string
): boolean {
  if (authCtx.role === 'admin') return true;
  if (authCtx.role === 'recruiter') {
    return requestCreatedBy === authCtx.userId && requestStatus === 'draft';
  }
  return false;
}

export function getNavForRole(role: UserRole): {
  sections: { title: string; links: { href: string; label: string; icon: string }[] }[];
} {
  const base = [
    { href: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  ];

  switch (role) {
    case 'admin':
      return {
        sections: [
          {
            title: 'Pipeline',
            links: [
              ...base,
              { href: '/intake/new', label: 'New Request', icon: 'PlusCircle' },
            ],
          },
          {
            title: 'Admin',
            links: [
              { href: '/admin', label: 'Dashboard', icon: 'Settings' },
              { href: '/admin/users', label: 'Users', icon: 'Users' },
              { href: '/admin/schemas', label: 'Schemas', icon: 'FileCode' },
              { href: '/admin/pipeline', label: 'Workers', icon: 'Activity' },
            ],
          },
        ],
      };
    case 'recruiter':
      return {
        sections: [
          {
            title: 'Pipeline',
            links: [
              ...base,
              { href: '/intake/new', label: 'New Request', icon: 'PlusCircle' },
            ],
          },
        ],
      };
    case 'designer':
      return {
        sections: [
          {
            title: 'Design',
            links: [
              { href: '/designer', label: 'My Campaigns', icon: 'Palette' },
              { href: '/designer/editor', label: 'Seedream Editor', icon: 'Wand2' },
            ],
          },
        ],
      };
    case 'viewer':
    default:
      return {
        sections: [
          { title: 'Pipeline', links: base },
        ],
      };
  }
}
