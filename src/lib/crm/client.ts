/**
 * CRM Datalake Postgres client — env-var gated.
 *
 * Env vars:
 *   CRM_DATABASE_URL    — Postgres connection string (read-only)
 *   CRM_SYNC_ENABLED    — "true" to enable sync (default: false)
 *
 * When CRM_DATABASE_URL is unset, all functions return null/empty gracefully.
 * This is a SEPARATE client from the Neon app DB (getDb()).
 */

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function isCrmConnected(): boolean {
  return !!process.env.CRM_DATABASE_URL;
}

export function isCrmSyncEnabled(): boolean {
  return process.env.CRM_SYNC_ENABLED === 'true' && isCrmConnected();
}

export function getCrmPool(): pg.Pool | null {
  if (!isCrmConnected()) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.CRM_DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      application_name: 'nova-audienceiq-readonly',
    });

    pool.on('error', (err) => {
      console.error('[CRM] Pool error:', err.message);
    });
  }

  return pool;
}

export interface CrmContributor {
  crm_user_id: string;
  email: string;
  country: string | null;
  languages: string[];
  skills: Record<string, unknown>;
  quality_score: number | null;
  activity_status: string;
  signup_date: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

/**
 * Query the CRM datalake directly. Returns null if CRM not connected.
 */
export async function queryCrm<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[] | null> {
  const p = getCrmPool();
  if (!p) return null;

  try {
    const result = await p.query(sql, params);
    return result.rows as T[];
  } catch (err) {
    console.error('[CRM] Query error:', (err as Error).message);
    return null;
  }
}
