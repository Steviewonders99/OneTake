'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { UserRole } from '@/lib/types';

interface UserRecord {
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

const VALID_ROLES: UserRole[] = ['admin', 'recruiter', 'designer', 'viewer'];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
  const [inviting, setInviting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have admin access.');
        throw new Error('Failed to load users');
      }
      setUsers(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, name: inviteName || null, role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to invite user');
      }
      setInviteEmail('');
      setInviteName('');
      setInviteRole('viewer');
      setShowInvite(false);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(clerkId: string, newRole: string) {
    try {
      const res = await fetch(`/api/admin/users/${clerkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      await fetchUsers();
    } catch {
      toast.error('Failed to update user role');
    }
  }

  async function handleDeactivate(clerkId: string, name: string | null) {
    if (!confirm(`Deactivate user ${name ?? clerkId}? They will lose access.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${clerkId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to deactivate');
      await fetchUsers();
    } catch {
      toast.error('Failed to deactivate user');
    }
  }

  return (
    <div className="px-6 md:px-10 lg:px-12 xl:px-16 py-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">User Management</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Manage team roles and access permissions
          </p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary cursor-pointer">
          Invite User
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">Invite New User</h2>
          <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@centific.com"
                required
                className="input-base"
              />
            </div>
            <div className="min-w-[160px]">
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Name</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Full name"
                className="input-base"
              />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="input-base"
              >
                {VALID_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={inviting} className="btn-primary cursor-pointer">
                {inviting ? 'Inviting...' : 'Send Invite'}
              </button>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="btn-secondary cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card p-5 mb-6 border-[var(--oneforma-error)]">
          <p className="text-sm text-[var(--oneforma-error)]">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="flex gap-4">
                <div className="skeleton w-32 h-5" />
                <div className="skeleton flex-1 h-5" />
                <div className="skeleton w-24 h-5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users table */}
      {!loading && !error && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Joined</th>
                  <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--muted-foreground)]">
                      No users found. Click &quot;Invite User&quot; to add team members.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 px-4 font-medium text-[var(--foreground)]">
                        {user.name ?? '--'}
                      </td>
                      <td className="py-3 px-4 text-[var(--muted-foreground)]">{user.email}</td>
                      <td className="py-3 px-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.clerk_id, e.target.value)}
                          className="input-base !py-1 !px-2 !text-xs w-28"
                        >
                          {VALID_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${user.is_active ? 'badge-approved' : 'badge-draft'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--muted-foreground)]">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {user.is_active && (
                          <button
                            onClick={() => handleDeactivate(user.clerk_id, user.name)}
                            className="text-xs text-[var(--oneforma-error)] hover:underline cursor-pointer"
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
