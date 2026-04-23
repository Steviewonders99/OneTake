/**
 * Identity Stitching — links anonymous visitors to CRM contributor profiles.
 */

import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { upsertIdentity } from '@/lib/db/audienceiq';

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

export async function stitchSignup(params: {
  email: string;
  crm_user_id: string;
  utm_slug?: string;
  visitor_id?: string;
  ga4_client_id?: string;
}): Promise<void> {
  const emailHash = hashEmail(params.email);

  await upsertIdentity({
    email: params.email,
    email_hash: emailHash,
    crm_user_id: params.crm_user_id,
    visitor_id: params.visitor_id ?? null,
    ga4_client_id: params.ga4_client_id ?? null,
    utm_slug: params.utm_slug ?? null,
  });
}

export async function autoMatchContributors(): Promise<number> {
  const sql = getDb();

  const unmatched = await sql`
    SELECT c.crm_user_id, c.email, c.utm_campaign
    FROM crm_sync_cache c
    WHERE c.email IS NOT NULL
      AND c.utm_campaign IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM visitor_identities v WHERE v.crm_user_id = c.crm_user_id
      )
  `;

  let matched = 0;

  for (const row of unmatched) {
    const contributor = row as { crm_user_id: string; email: string; utm_campaign: string };

    const links = await sql`
      SELECT slug FROM tracked_links WHERE utm_campaign = ${contributor.utm_campaign} LIMIT 1
    `;

    const emailHash = hashEmail(contributor.email);

    await upsertIdentity({
      email: contributor.email,
      email_hash: emailHash,
      crm_user_id: contributor.crm_user_id,
      utm_slug: (links[0] as { slug: string } | undefined)?.slug ?? null,
    });

    matched++;
  }

  return matched;
}
