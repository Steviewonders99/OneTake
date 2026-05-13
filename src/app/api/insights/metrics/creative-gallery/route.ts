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

  // ── 3. Enrich with REAL per-creative GA4 funnel via utm_content ──────────
  // The sGTM identity stack persists utm_content as first-touch attribution.
  // GA4 sessionManualAdContent dimension = utm_content = ad name / creative ID.
  // We query GA4 Analytics Data API directly for per-creative funnel events.
  if (creatives.length > 0) {
    try {
      const adcPath = process.env.HOME + '/.config/gcloud/application_default_credentials.json';
      let ga4Token: string | null = null;

      // Try to get Google credentials for GA4 API
      try {
        const fs = await import('fs');
        if (fs.existsSync(adcPath)) {
          const adc = JSON.parse(fs.readFileSync(adcPath, 'utf-8'));
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: adc.client_id,
              client_secret: adc.client_secret,
              refresh_token: adc.refresh_token,
            }),
          });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            ga4Token = tokenData.access_token;
          }
        }
      } catch { /* GA4 auth not available — skip enrichment */ }

      if (ga4Token) {
        const propertyId = process.env.GA4_PROPERTY_ID || '330157295';
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceStr = since.toISOString().split('T')[0];
        const untilStr = new Date().toISOString().split('T')[0];

        // Collect all utm_content values to query (ad names serve as utm_content)
        const utmContentValues = creatives
          .map((c: any) => c.ad_name as string)
          .filter((n: string) => n && n.length > 2);

        if (utmContentValues.length > 0) {
          // Query GA4 for funnel events grouped by utm_content
          const ga4Body = JSON.stringify({
            dateRanges: [{ startDate: sinceStr, endDate: untilStr }],
            dimensions: [
              { name: 'sessionManualAdContent' },
              { name: 'eventName' },
            ],
            metrics: [{ name: 'eventCount' }],
            dimensionFilter: {
              andGroup: {
                expressions: [
                  { filter: { fieldName: 'sessionManualAdContent', inListFilter: { values: utmContentValues } } },
                  { filter: { fieldName: 'eventName', inListFilter: { values: ['session_start', 'sign_up', 'purchase', 'apply_click', 'generate_lead', 'begin_checkout'] } } },
                ],
              },
            },
            limit: 5000,
          });

          const ga4Res = await fetch(
            `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${ga4Token}`, 'Content-Type': 'application/json' },
              body: ga4Body,
              signal: AbortSignal.timeout(15_000),
            },
          );

          if (ga4Res.ok) {
            const ga4Data = await ga4Res.json();

            // Build per-creative funnel map
            const funnelMap = new Map<string, { sessions: number; signups: number; completions: number; applies: number }>();
            for (const row of ga4Data.rows || []) {
              const utmContent = row.dimensionValues?.[0]?.value || '';
              const eventName = row.dimensionValues?.[1]?.value || '';
              const count = parseInt(row.metricValues?.[0]?.value || '0');

              const existing = funnelMap.get(utmContent) || { sessions: 0, signups: 0, completions: 0, applies: 0 };
              if (eventName === 'session_start') existing.sessions += count;
              else if (eventName === 'sign_up') existing.signups += count;
              else if (eventName === 'purchase') existing.completions += count;
              else if (eventName === 'apply_click') existing.applies += count;
              funnelMap.set(utmContent, existing);
            }

            // Enrich each creative with REAL funnel data
            for (const c of creatives as any[]) {
              const funnel = funnelMap.get(c.ad_name as string);
              if (funnel) {
                c.funnel_sessions = funnel.sessions;
                c.funnel_signups = funnel.signups;
                c.funnel_completions = funnel.completions;
                c.funnel_cvr = funnel.sessions > 0 ? (funnel.completions / funnel.sessions * 100) : 0;
                c.attribution = 'first-touch';
              } else {
                c.funnel_sessions = 0;
                c.funnel_signups = 0;
                c.funnel_completions = 0;
                c.funnel_cvr = 0;
                c.attribution = 'none';
              }
            }
          }
        }
      } else {
        // No GA4 token — set defaults
        for (const c of creatives as any[]) {
          c.funnel_sessions = 0;
          c.funnel_signups = 0;
          c.funnel_completions = 0;
          c.funnel_cvr = 0;
          c.attribution = 'unavailable';
        }
      }
    } catch (err) {
      console.error('[Creative Gallery] GA4 funnel enrichment error:', err);
      for (const c of creatives as any[]) {
        c.funnel_sessions = c.funnel_sessions ?? 0;
        c.funnel_signups = c.funnel_signups ?? 0;
        c.funnel_completions = c.funnel_completions ?? 0;
        c.funnel_cvr = c.funnel_cvr ?? 0;
      }
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
