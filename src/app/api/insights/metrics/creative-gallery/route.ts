import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

/**
 * Creative Gallery API — ad creatives with images + performance metrics from Meta.
 *
 * 1. Checks ad_creatives_cache (fast path, 6-hour TTL)
 * 2. Falls back to live Meta Marketing API pull
 * 3. Caches fresh data back to DB (fire and forget)
 *
 * Query params:
 *   ?days=30          — lookback window (default 30)
 *   ?campaign=humus   — filter to specific campaign (exact match, case-insensitive)
 *   ?sort=conversions — sort key: conversions | ctr | clicks | spend
 *   ?limit=20         — max results (capped at 50)
 */
export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();

  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30') || 30);
  const campaign = req.nextUrl.searchParams.get('campaign') || '';
  const sort = req.nextUrl.searchParams.get('sort') || 'conversions';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20') || 20, 50);

  const validSorts = ['conversions', 'ctr', 'clicks', 'spend'] as const;
  const sortKey = validSorts.includes(sort as (typeof validSorts)[number])
    ? (sort as (typeof validSorts)[number])
    : 'conversions';

  let creatives: Record<string, unknown>[] = [];

  // ── 1. Try cache ────────────────────────────────────────────────────────
  try {
    const cached = campaign
      ? await sql`
          SELECT * FROM ad_creatives_cache
          WHERE last_synced_at > NOW() - INTERVAL '6 hours'
            AND LOWER(campaign_name) = ${campaign.toLowerCase()}
          ORDER BY conversions DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM ad_creatives_cache
          WHERE last_synced_at > NOW() - INTERVAL '6 hours'
          ORDER BY conversions DESC
          LIMIT ${limit}
        `;

    if (cached.length > 0) {
      // Sort in JS to respect arbitrary sort key from query param
      creatives = [...cached].sort(
        (a, b) => ((b[sortKey] as number) || 0) - ((a[sortKey] as number) || 0),
      );
    }
  } catch {
    // Table may not exist in local dev — fall through to live pull
  }

  // ── 2. Live pull from Meta if cache miss ────────────────────────────────
  if (creatives.length === 0) {
    const metaToken = process.env.META_ADS_ACCESS_TOKEN;
    const adAccountId = process.env.META_ADS_AD_ACCOUNT_ID;

    if (metaToken && adAccountId) {
      try {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceStr = since.toISOString().split('T')[0];
        const untilStr = new Date().toISOString().split('T')[0];

        const url =
          `https://graph.facebook.com/v21.0/act_${adAccountId}/ads?` +
          `fields=id,name,status,campaign_id,campaign{name},adset_id,adset{name},` +
          `creative.fields(id,name,thumbnail_url,image_url,image_hash,video_id),` +
          `insights.time_range({"since":"${sinceStr}","until":"${untilStr}"}).fields(impressions,clicks,spend,actions,ctr,cpc)` +
          `&limit=50&access_token=${metaToken}`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const ads: Record<string, unknown>[] = data.data || [];

          const mapped = ads.map((ad) => {
            const creative = (ad.creative as Record<string, unknown>) || {};
            const insightsData = (ad.insights as Record<string, unknown[]> | undefined)?.data ?? [];
            const insights = (insightsData[0] as Record<string, unknown>) || {};
            const actions = (insights.actions as { action_type: string; value: string }[]) || [];

            const conversions = actions
              .filter((a) =>
                ['offsite_conversion', 'lead', 'purchase', 'complete_registration'].includes(
                  a.action_type,
                ),
              )
              .reduce((sum, a) => sum + parseInt(a.value || '0'), 0);

            const spend = parseFloat((insights.spend as string) || '0');
            const campaign_obj = (ad.campaign as Record<string, unknown>) || {};
            const adset_obj = (ad.adset as Record<string, unknown>) || {};

            return {
              platform: 'meta_ads',
              ad_id: ad.id,
              ad_name: ad.name || '',
              creative_id: creative.id || '',
              creative_name: creative.name || '',
              campaign_id: ad.campaign_id || '',
              campaign_name: (campaign_obj.name as string) || '',
              adset_id: ad.adset_id || '',
              adset_name: (adset_obj.name as string) || '',
              status: ad.status || '',
              image_url: (creative.image_url as string) || '',
              thumbnail_url: (creative.thumbnail_url as string) || '',
              image_hash: (creative.image_hash as string) || '',
              video_id: (creative.video_id as string) || null,
              impressions: parseInt((insights.impressions as string) || '0'),
              clicks: parseInt((insights.clicks as string) || '0'),
              spend,
              conversions,
              ctr: parseFloat((insights.ctr as string) || '0'),
              cpc: parseFloat((insights.cpc as string) || '0'),
              cpa: conversions > 0 ? spend / conversions : 0,
            };
          });

          // Filter by campaign
          const filtered = campaign
            ? mapped.filter(
                (c) =>
                  ((c.campaign_name as string) || '').toLowerCase() === campaign.toLowerCase(),
              )
            : mapped;

          // Sort + limit
          filtered.sort(
            (a, b) => ((b[sortKey] as number) || 0) - ((a[sortKey] as number) || 0),
          );
          creatives = filtered.slice(0, limit);

          // Cache to DB (fire and forget — don't block the response)
          const sql2 = getDb();
          for (const c of creatives) {
            sql2`
              INSERT INTO ad_creatives_cache (
                platform, ad_account_id, ad_id, ad_name, creative_id, creative_name,
                campaign_id, campaign_name, adset_id, adset_name, status,
                image_url, thumbnail_url, image_hash, video_id,
                impressions, clicks, spend, conversions, ctr, cpc, cpa,
                date_range_start, date_range_end
              ) VALUES (
                'meta_ads', ${adAccountId}, ${c.ad_id as string}, ${c.ad_name as string},
                ${c.creative_id as string}, ${c.creative_name as string},
                ${c.campaign_id as string}, ${c.campaign_name as string},
                ${c.adset_id as string}, ${c.adset_name as string}, ${c.status as string},
                ${c.image_url as string}, ${c.thumbnail_url as string},
                ${c.image_hash as string}, ${(c.video_id as string | null) ?? null},
                ${c.impressions as number}, ${c.clicks as number}, ${c.spend as number},
                ${c.conversions as number}, ${c.ctr as number}, ${c.cpc as number}, ${c.cpa as number},
                ${sinceStr}::date, ${untilStr}::date
              )
              ON CONFLICT (platform, ad_id, date_range_start) DO UPDATE SET
                impressions    = EXCLUDED.impressions,
                clicks         = EXCLUDED.clicks,
                spend          = EXCLUDED.spend,
                conversions    = EXCLUDED.conversions,
                ctr            = EXCLUDED.ctr,
                cpc            = EXCLUDED.cpc,
                cpa            = EXCLUDED.cpa,
                image_url      = EXCLUDED.image_url,
                thumbnail_url  = EXCLUDED.thumbnail_url,
                status         = EXCLUDED.status,
                last_synced_at = NOW()
            `.catch(() => {});
          }
        }
      } catch (err) {
        console.error('[Creative Gallery] Meta API error:', err);
      }
    }
  }

  // ── 3. Enrich with GA4 funnel data via utm_content matching ──────────────
  if (creatives.length > 0) {
    try {
      // Get all unique utm_content values we might match against
      // Meta ad names often map to utm_content (e.g., "Cold-Dog-04_Urgency" → utm_content "Cold-Dog-04_Urgency")
      // Also try ad_id as utm_content (Meta auto-sets this in some configurations)
      const adNames = creatives.map((c: any) => c.ad_name).filter(Boolean);
      const adIds = creatives.map((c: any) => c.ad_id).filter(Boolean);
      const creativeNames = creatives.map((c: any) => c.creative_name).filter(Boolean);

      // Query GA4 funnel events where utm_content matches any of our creative identifiers
      const funnelData = await sql`
        SELECT
          campaign,
          source,
          medium,
          SUM(CASE WHEN event_name = 'session_start' THEN event_count ELSE 0 END)::int as sessions,
          SUM(CASE WHEN event_name = 'sign_up' THEN event_count ELSE 0 END)::int as signups,
          SUM(CASE WHEN event_name = 'purchase' THEN event_count ELSE 0 END)::int as completions
        FROM ga4_funnel_events
        WHERE date >= CURRENT_DATE - ${days}
          AND campaign != '(not set)' AND campaign != '(direct)'
        GROUP BY campaign, source, medium
        HAVING SUM(event_count) > 0
      `.catch(() => []);

      // Also try direct utm_content matching from ga4_session_cache if available
      // For now, match by campaign name + source to attribute funnel to creatives
      const funnelByCampaign = new Map<string, { sessions: number; signups: number; completions: number }>();
      for (const row of funnelData as any[]) {
        const key = (row.campaign || '').toLowerCase();
        const existing = funnelByCampaign.get(key) || { sessions: 0, signups: 0, completions: 0 };
        funnelByCampaign.set(key, {
          sessions: existing.sessions + row.sessions,
          signups: existing.signups + row.signups,
          completions: existing.completions + row.completions,
        });
      }

      // Enrich each creative with funnel data from its campaign
      for (const c of creatives as any[]) {
        const campaignKey = (c.campaign_name || '').toLowerCase();
        const funnel = funnelByCampaign.get(campaignKey);
        if (funnel && funnel.sessions > 0) {
          // Attribute proportionally: this creative's share of impressions × campaign funnel
          const totalCampaignImpressions = creatives
            .filter((x: any) => (x.campaign_name || '').toLowerCase() === campaignKey)
            .reduce((sum: number, x: any) => sum + (x.impressions || 0), 0);
          const share = totalCampaignImpressions > 0 ? (c.impressions || 0) / totalCampaignImpressions : 0;

          c.funnel_sessions = Math.round(funnel.sessions * share);
          c.funnel_signups = Math.round(funnel.signups * share);
          c.funnel_completions = Math.round(funnel.completions * share);
          c.funnel_cvr = c.funnel_sessions > 0 ? (c.funnel_completions / c.funnel_sessions * 100) : 0;
        } else {
          c.funnel_sessions = 0;
          c.funnel_signups = 0;
          c.funnel_completions = 0;
          c.funnel_cvr = 0;
        }
      }
    } catch (err) {
      console.error('[Creative Gallery] GA4 funnel enrichment error:', err);
    }
  }

  // ── 4. Available campaigns for filter dropdown ───────────────────────────
  const available_campaigns = await sql`
    SELECT DISTINCT campaign_name, SUM(conversions)::int AS total_conversions
    FROM ad_creatives_cache
    WHERE campaign_name IS NOT NULL AND campaign_name != ''
    GROUP BY campaign_name
    ORDER BY total_conversions DESC
    LIMIT 20
  `.catch(() => []);

  return NextResponse.json({
    creatives,
    total: creatives.length,
    available_campaigns,
  });
}
