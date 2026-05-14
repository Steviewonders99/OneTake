import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

/**
 * Returns a tagged-template SQL function compatible with the Neon API shape.
 * Usage: const sql = getDb(); const rows = await sql`SELECT * FROM table WHERE id = ${id}`;
 */
export function getDb() {
  const p = getPool();

  return async function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<any[]> {
    // Build parameterized query from tagged template
    let query = '';
    for (let i = 0; i < strings.length; i++) {
      query += strings[i];
      if (i < values.length) {
        query += `$${i + 1}`;
      }
    }

    const result = await p.query(query, values);
    return result.rows;
  };
}
