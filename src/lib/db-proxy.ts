/**
 * DB Proxy Client — routes queries through Azure Container App proxy
 * when direct PG access is blocked by IP whitelist.
 *
 * The proxy runs inside the Azure Container App (same network as Azure PG)
 * and exposes JSON endpoints that mirror the /api/projects/* routes.
 *
 * Usage:
 *   Set DB_PROXY_URL and DB_PROXY_SECRET in environment to enable.
 *   When set, project API routes use this instead of direct DB queries.
 *   When NOT set, falls back to direct Neon queries (dev mode).
 */

const PROXY_URL = process.env.DB_PROXY_URL || '';
const PROXY_SECRET = process.env.DB_PROXY_SECRET || '';

export function isProxyEnabled(): boolean {
  return !!PROXY_URL;
}

async function proxyFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${PROXY_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(PROXY_SECRET ? { Authorization: `Bearer ${PROXY_SECRET}` } : {}),
      ...options?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Proxy ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ── Project queries via proxy ────────────────────────────────────

export async function proxyListProjects(status = 'active') {
  return proxyFetch(`/projects?status=${status}`);
}

export async function proxyGetProject(id: string) {
  return proxyFetch(`/projects/${id}`);
}

export async function proxyGetFunnel(id: string, view = 'weekly') {
  return proxyFetch(`/projects/${id}/funnel?view=${view}`);
}

export async function proxyGetChannels(id: string) {
  return proxyFetch(`/projects/${id}/channels`);
}

export async function proxyGetUnclassified() {
  return proxyFetch('/projects/unclassified');
}

export async function proxyTriggerSync() {
  return proxyFetch('/projects/sync', { method: 'POST' });
}

export async function proxyRefreshView() {
  return proxyFetch('/refresh', { method: 'POST' });
}
