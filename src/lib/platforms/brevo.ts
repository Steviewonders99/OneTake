/**
 * Brevo (formerly Sendinblue) email campaign client.
 * Writes to brevo_campaign_metrics (separate from ad normalization).
 *
 * Required env vars:
 *   BREVO_API_KEY
 */

import { getDb } from '@/lib/db';
import type { PlatformSyncResult, PlatformConnectionStatus } from './types';

export function isBrevoConnected(): boolean {
  return !!process.env.BREVO_API_KEY;
}

export async function getBrevoStatus(): Promise<PlatformConnectionStatus> {
  const sql = getDb();
  const connected = isBrevoConnected();
  if (!connected) return { platform: 'brevo', connected: false, has_data: false, last_sync_at: null, row_count: 0 };

  const countRow = await sql`SELECT COUNT(*)::int as count FROM brevo_campaign_metrics`;
  const lastSync = await sql`SELECT MAX(synced_at) as last_sync FROM brevo_campaign_metrics`;

  return {
    platform: 'brevo',
    connected: true,
    has_data: (countRow[0] as { count: number }).count > 0,
    last_sync_at: (lastSync[0] as { last_sync: string | null })?.last_sync ?? null,
    row_count: (countRow[0] as { count: number }).count,
  };
}

export async function syncBrevo(requestId?: string, days: number = 30): Promise<PlatformSyncResult> {
  const start = Date.now();
  if (!isBrevoConnected()) {
    return { platform: 'brevo', success: false, rows_synced: 0, errors: 0, duration_ms: 0, message: 'Brevo not configured.' };
  }

  const sql = getDb();
  const apiKey = process.env.BREVO_API_KEY!;

  try {
    // Fetch email campaigns from Brevo API
    const res = await fetch('https://api.brevo.com/v3/emailCampaigns?limit=50&sort=desc&status=sent', {
      headers: { 'api-key': apiKey, 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const err = await res.text();
      return { platform: 'brevo', success: false, rows_synced: 0, errors: 1, duration_ms: Date.now() - start, message: `Brevo API error: ${err.slice(0, 200)}` };
    }

    const data = await res.json();
    const campaigns = data.campaigns || [];
    let synced = 0;

    for (const campaign of campaigns) {
      const stats = campaign.statistics?.globalStats || {};
      const sentDate = campaign.sentDate ? campaign.sentDate.split('T')[0] : new Date().toISOString().split('T')[0];

      // UTM matching: find linked intake_request
      let linkedRequestId = requestId || null;
      if (!linkedRequestId && campaign.tag) {
        const slugMatch = await sql`
          SELECT id FROM intake_requests WHERE campaign_slug = ${campaign.tag} LIMIT 1
        `;
        if (slugMatch.length > 0) linkedRequestId = slugMatch[0].id as string;
      }

      const delivered = stats.delivered || 0;
      const opens = stats.uniqueOpens || 0;
      const clicks = stats.uniqueClicks || 0;
      const bounces = (stats.hardBounces || 0) + (stats.softBounces || 0);

      await sql`
        INSERT INTO brevo_campaign_metrics (
          request_id, campaign_id, campaign_name, subject, date,
          sends, delivered, opens, unique_opens, clicks, unique_clicks,
          bounces, unsubscribes, spam_reports,
          open_rate, click_rate, bounce_rate, raw_data
        ) VALUES (
          ${linkedRequestId}, ${String(campaign.id)}, ${campaign.name || ''}, ${campaign.subject || ''},
          ${sentDate},
          ${stats.sent || 0}, ${delivered}, ${stats.viewed || 0}, ${opens},
          ${stats.clicked || 0}, ${clicks},
          ${bounces}, ${stats.unsubscribed || 0}, ${stats.spamReports || 0},
          ${delivered > 0 ? opens / delivered : 0},
          ${delivered > 0 ? clicks / delivered : 0},
          ${(stats.sent || 0) > 0 ? bounces / stats.sent : 0},
          ${JSON.stringify(campaign)}::jsonb
        )
        ON CONFLICT (request_id, campaign_id, date)
        DO UPDATE SET
          sends = EXCLUDED.sends, delivered = EXCLUDED.delivered,
          opens = EXCLUDED.opens, unique_opens = EXCLUDED.unique_opens,
          clicks = EXCLUDED.clicks, unique_clicks = EXCLUDED.unique_clicks,
          bounces = EXCLUDED.bounces, unsubscribes = EXCLUDED.unsubscribes,
          open_rate = EXCLUDED.open_rate, click_rate = EXCLUDED.click_rate,
          bounce_rate = EXCLUDED.bounce_rate,
          raw_data = EXCLUDED.raw_data, synced_at = NOW()
      `;
      synced++;
    }

    return { platform: 'brevo', success: true, rows_synced: synced, errors: 0, duration_ms: Date.now() - start, message: `Synced ${synced} email campaigns from Brevo` };
  } catch (e) {
    return { platform: 'brevo', success: false, rows_synced: 0, errors: 1, duration_ms: Date.now() - start, message: String(e) };
  }
}
