import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

/**
 * Recruitment Attribution API — form completions by traffic source + city.
 * Proves: marketing dollars → completions at decreasing CPA.
 *
 * ?days=30&campaign=humus
 */
export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30') || 30);
  const campaign = req.nextUrl.searchParams.get('campaign') || '';
  const half = Math.floor(days / 2);

  // 1. Completions by source (first-touch attribution)
  const sourceFilter = campaign
    ? sql`AND LOWER(campaign) = ${campaign.toLowerCase()}`
    : sql`AND campaign NOT IN ('(direct)','(organic)','(referral)','(not set)','')`;

  const sourceRows = await sql`
    SELECT source, medium,
      SUM(CASE WHEN event_name = 'session_start' THEN event_count ELSE 0 END)::int as sessions,
      SUM(CASE WHEN event_name = 'sign_up' THEN event_count ELSE 0 END)::int as signups,
      SUM(CASE WHEN event_name = 'purchase' THEN event_count ELSE 0 END)::int as completions,
      SUM(CASE WHEN event_name = 'apply_click' THEN event_count ELSE 0 END)::int as applies
    FROM ga4_funnel_events
    WHERE date >= CURRENT_DATE - make_interval(days => ${days}) ${sourceFilter}
    GROUP BY source, medium
    ORDER BY completions DESC
  `;

  // 2. Completions by country/city
  const cityRows = await sql`
    SELECT country,
      SUM(CASE WHEN event_name = 'session_start' THEN event_count ELSE 0 END)::int as sessions,
      SUM(CASE WHEN event_name = 'sign_up' THEN event_count ELSE 0 END)::int as signups,
      SUM(CASE WHEN event_name = 'purchase' THEN event_count ELSE 0 END)::int as completions
    FROM ga4_funnel_events
    WHERE date >= CURRENT_DATE - make_interval(days => ${days}) ${sourceFilter}
    GROUP BY country
    ORDER BY completions DESC
    LIMIT 15
  `;

  // 3. Week-over-week comparison (W1 = first half, W2 = second half)
  const [w1Sources, w2Sources] = await Promise.all([
    sql`SELECT source, medium,
      SUM(CASE WHEN event_name = 'purchase' THEN event_count ELSE 0 END)::int as completions
      FROM ga4_funnel_events
      WHERE date >= CURRENT_DATE - make_interval(days => ${days}) AND date < CURRENT_DATE - make_interval(days => ${half}) ${sourceFilter}
      GROUP BY source, medium`,
    sql`SELECT source, medium,
      SUM(CASE WHEN event_name = 'purchase' THEN event_count ELSE 0 END)::int as completions
      FROM ga4_funnel_events
      WHERE date >= CURRENT_DATE - make_interval(days => ${half}) ${sourceFilter}
      GROUP BY source, medium`,
  ]);

  const w1Map = new Map((w1Sources as any[]).map(r => [`${r.source}/${r.medium}`, r.completions]));
  const w2Map = new Map((w2Sources as any[]).map(r => [`${r.source}/${r.medium}`, r.completions]));

  const sourcesWithWoW = (sourceRows as any[]).map(r => {
    const key = `${r.source}/${r.medium}`;
    const w1 = w1Map.get(key) || 0;
    const w2 = w2Map.get(key) || 0;
    const paceChange = w1 > 0 ? Math.round((w2 - w1) / w1 * 100) : 0;
    return {
      ...r,
      w1_completions: w1,
      w2_completions: w2,
      pace_change_pct: paceChange,
      share_pct: 0, // computed below
      cvr: r.sessions > 0 ? Math.round(r.completions / r.sessions * 10000) / 100 : 0,
      type: classifySource(r.source, r.medium),
    };
  });

  const totalCompletions = sourcesWithWoW.reduce((s, r) => s + r.completions, 0);
  sourcesWithWoW.forEach(r => { r.share_pct = totalCompletions > 0 ? Math.round(r.completions / totalCompletions * 1000) / 10 : 0; });

  // 4. Spend + CPA from Meta ads
  const spendRows = await sql`
    SELECT SUM(spend)::float as total_spend, SUM(conversions)::int as total_conversions
    FROM meta_ads_cache
    WHERE date >= CURRENT_DATE - make_interval(days => ${days})
    ${campaign ? sql`AND LOWER(campaign_name) LIKE ${'%' + campaign.toLowerCase() + '%'}` : sql``}
  `;
  const spend = (spendRows[0] as any)?.total_spend || 0;
  const metaConversions = (spendRows[0] as any)?.total_conversions || 0;

  // W1 vs W2 spend
  const [w1Spend, w2Spend] = await Promise.all([
    sql`SELECT SUM(spend)::float as spend, SUM(conversions)::int as conv FROM meta_ads_cache
        WHERE date >= CURRENT_DATE - make_interval(days => ${days}) AND date < CURRENT_DATE - make_interval(days => ${half})
        ${campaign ? sql`AND LOWER(campaign_name) LIKE ${'%' + campaign.toLowerCase() + '%'}` : sql``}`,
    sql`SELECT SUM(spend)::float as spend, SUM(conversions)::int as conv FROM meta_ads_cache
        WHERE date >= CURRENT_DATE - make_interval(days => ${half})
        ${campaign ? sql`AND LOWER(campaign_name) LIKE ${'%' + campaign.toLowerCase() + '%'}` : sql``}`,
  ]);

  const w1s = (w1Spend[0] as any) || { spend: 0, conv: 0 };
  const w2s = (w2Spend[0] as any) || { spend: 0, conv: 0 };
  const w1Cpa = w1s.conv > 0 ? w1s.spend / w1s.conv : 0;
  const w2Cpa = w2s.conv > 0 ? w2s.spend / w2s.conv : 0;

  // City CVR enrichment
  const citiesWithCvr = (cityRows as any[]).map(r => ({
    ...r,
    cvr: r.sessions > 0 ? Math.round(r.completions / r.sessions * 1000) / 10 : 0,
  }));

  // Available campaigns
  const campaigns = await sql`
    SELECT DISTINCT campaign, SUM(event_count)::int as total
    FROM ga4_funnel_events
    WHERE campaign NOT IN ('(direct)','(organic)','(referral)','(not set)','')
      AND date >= CURRENT_DATE - make_interval(days => ${days})
    GROUP BY campaign ORDER BY total DESC LIMIT 20
  `;

  return NextResponse.json({
    campaign: campaign || 'All Campaigns',
    days,
    kpis: {
      total_completions: totalCompletions,
      meta_attributed: metaConversions,
      meta_share_pct: totalCompletions > 0 ? Math.round(metaConversions / totalCompletions * 1000) / 10 : 0,
      total_spend: Math.round(spend * 100) / 100,
      cpa: totalCompletions > 0 ? Math.round(spend / totalCompletions * 100) / 100 : 0,
      w1_cpa: Math.round(w1Cpa * 100) / 100,
      w2_cpa: Math.round(w2Cpa * 100) / 100,
      cpa_trend: w1Cpa > 0 ? Math.round((w2Cpa - w1Cpa) / w1Cpa * 100) : 0,
      w1_completions: w1s.conv || 0,
      w2_completions: w2s.conv || 0,
    },
    sources: sourcesWithWoW,
    cities: citiesWithCvr,
    available_campaigns: campaigns,
  });
}

function classifySource(source: string, medium: string): string {
  const s = source.toLowerCase();
  const m = medium.toLowerCase();
  if (m === 'paid' || m === 'cpc' || s === 'paid_media') return 'Paid';
  if (s === 'facebook' || s === 'meta') return 'Paid';
  if (m === 'organic') return 'Organic';
  if (m === 'email' || s === 'brevo') return 'Email';
  if (m === 'referral') return 'Referral';
  if (s === '(direct)' || s === 'direct') return 'Direct';
  if (s.includes('tiktok')) return 'Paid';
  if (s.includes('reddit')) return 'Paid';
  if (s.includes('linkedin')) return 'Paid';
  return 'Other';
}
