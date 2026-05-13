import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

/**
 * Campaign Funnel API — cross-channel, full funnel breakdown.
 *
 * Returns funnel stages aggregated by campaign (auto-matched across platforms).
 * When ?campaign=humus, shows all channels (Meta, Reddit, TikTok, organic) aggregated
 * for that campaign, with funnel stages from ad impression → sign_up → purchase.
 *
 * Query params:
 *   ?days=90          — lookback window (default 90)
 *   ?campaign=humus   — filter to specific campaign (fuzzy match)
 *   ?channel=all      — 'all' (default), 'paid', 'organic', or specific source
 */
export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '90') || 90);
  const campaignFilter = req.nextUrl.searchParams.get('campaign') || '';

  // Funnel stages in order
  const FUNNEL_ORDER = [
    'AdToHomepageView',
    'session_start',
    'Job Card List',
    'Job Details Page',
    'apply_click',
    'UserEnterLoginPage',
    'Onboarding',
    'sign_up',
    'generate_lead',
    'begin_checkout',
    'purchase',
  ];

  const STAGE_LABELS: Record<string, string> = {
    'AdToHomepageView': 'Ad → Homepage',
    'session_start': 'Sessions',
    'Job Card List': 'Browsed Jobs',
    'Job Details Page': 'Viewed Job',
    'apply_click': 'Applied',
    'UserEnterLoginPage': 'Login Page',
    'Onboarding': 'Onboarding',
    'sign_up': 'Signed Up',
    'generate_lead': 'Lead Generated',
    'begin_checkout': 'Started Task',
    'purchase': 'Completed Task',
  };

  // 1. Funnel stages (aggregated across all channels for this campaign)
  const funnelRows = campaignFilter
    ? await sql`
        SELECT event_name, SUM(event_count)::int as count, SUM(conversions)::int as conversions
        FROM ga4_funnel_events
        WHERE date >= CURRENT_DATE - ${days}
          AND LOWER(campaign) = ${campaignFilter.toLowerCase()}
          AND event_name = ANY(${FUNNEL_ORDER})
        GROUP BY event_name
      `
    : await sql`
        SELECT event_name, SUM(event_count)::int as count, SUM(conversions)::int as conversions
        FROM ga4_funnel_events
        WHERE date >= CURRENT_DATE - ${days}
          AND campaign NOT IN ('(direct)', '(organic)', '(referral)', '(not set)')
          AND event_name = ANY(${FUNNEL_ORDER})
        GROUP BY event_name
      `;

  // Build ordered funnel
  const funnelMap = new Map(funnelRows.map((r: any) => [r.event_name, { count: r.count, conversions: r.conversions }]));
  const funnel = FUNNEL_ORDER
    .filter(e => funnelMap.has(e))
    .map(e => ({
      stage: e,
      label: STAGE_LABELS[e] || e,
      count: funnelMap.get(e)!.count,
      conversions: funnelMap.get(e)!.conversions,
    }));

  // 2. Channel breakdown (same campaign, split by source/medium) — with CVR at every stage
  const channelRows = campaignFilter
    ? await sql`
        SELECT source, medium,
               SUM(event_count)::int as total_events,
               SUM(CASE WHEN event_name = 'session_start' THEN event_count ELSE 0 END)::int as sessions,
               SUM(CASE WHEN event_name = 'apply_click' THEN event_count ELSE 0 END)::int as applies,
               SUM(CASE WHEN event_name = 'sign_up' THEN event_count ELSE 0 END)::int as signups,
               SUM(CASE WHEN event_name = 'purchase' THEN event_count ELSE 0 END)::int as completions
        FROM ga4_funnel_events
        WHERE date >= CURRENT_DATE - ${days}
          AND LOWER(campaign) = ${campaignFilter.toLowerCase()}
        GROUP BY source, medium
        ORDER BY sessions DESC
        LIMIT 10
      `
    : await sql`
        SELECT source, medium,
               SUM(event_count)::int as total_events,
               SUM(CASE WHEN event_name = 'session_start' THEN event_count ELSE 0 END)::int as sessions,
               SUM(CASE WHEN event_name = 'apply_click' THEN event_count ELSE 0 END)::int as applies,
               SUM(CASE WHEN event_name = 'sign_up' THEN event_count ELSE 0 END)::int as signups,
               SUM(CASE WHEN event_name = 'purchase' THEN event_count ELSE 0 END)::int as completions
        FROM ga4_funnel_events
        WHERE date >= CURRENT_DATE - ${days}
          AND campaign NOT IN ('(direct)', '(organic)', '(referral)', '(not set)')
        GROUP BY source, medium
        ORDER BY sessions DESC
        LIMIT 10
      `;

  // Compute CVR per channel
  const channelsWithCvr = channelRows.map((ch: any) => ({
    ...ch,
    cvr_click_to_signup: ch.sessions > 0 ? (ch.signups / ch.sessions * 100) : 0,
    cvr_click_to_purchase: ch.sessions > 0 ? (ch.completions / ch.sessions * 100) : 0,
    cvr_signup_to_purchase: ch.signups > 0 ? (ch.completions / ch.signups * 100) : 0,
  }));

  // 3. Ad spend for this campaign (from paid cache tables)
  const spendRows = campaignFilter
    ? await sql`
        SELECT 'meta_ads' as platform, campaign_name,
               SUM(impressions)::int as impressions, SUM(clicks)::int as clicks, SUM(spend)::float as spend
        FROM meta_ads_cache
        WHERE date >= CURRENT_DATE - ${days}
          AND LOWER(campaign_name) = ${campaignFilter.toLowerCase()}
        GROUP BY campaign_name
        UNION ALL
        SELECT 'reddit_ads', campaign_name,
               SUM(impressions)::int, SUM(clicks)::int, SUM(spend)::float
        FROM reddit_ads_cache
        WHERE date >= CURRENT_DATE - ${days}
          AND LOWER(campaign_name) = ${campaignFilter.toLowerCase()}
        GROUP BY campaign_name
      `
    : await sql`
        SELECT 'meta_ads' as platform, campaign_name,
               SUM(impressions)::int as impressions, SUM(clicks)::int as clicks, SUM(spend)::float as spend
        FROM meta_ads_cache WHERE date >= CURRENT_DATE - ${days}
        GROUP BY campaign_name
        UNION ALL
        SELECT 'reddit_ads', campaign_name,
               SUM(impressions)::int, SUM(clicks)::int, SUM(spend)::float
        FROM reddit_ads_cache WHERE date >= CURRENT_DATE - ${days}
        GROUP BY campaign_name
      `;

  const totalSpend = spendRows.reduce((sum: number, r: any) => sum + (r.spend || 0), 0);
  const totalImpressions = spendRows.reduce((sum: number, r: any) => sum + (r.impressions || 0), 0);
  const totalClicks = spendRows.reduce((sum: number, r: any) => sum + (r.clicks || 0), 0);
  const signups = funnel.find(f => f.stage === 'sign_up')?.count || 0;
  const completions = funnel.find(f => f.stage === 'purchase')?.count || 0;

  // 4. Available campaigns (for the dropdown filter)
  const campaigns = await sql`
    SELECT DISTINCT campaign, SUM(event_count)::int as total
    FROM ga4_funnel_events
    WHERE date >= CURRENT_DATE - ${days}
      AND campaign NOT IN ('(direct)', '(organic)', '(referral)', '(not set)', '')
    GROUP BY campaign
    ORDER BY total DESC
    LIMIT 30
  `;

  // Aggregate CVR metrics
  const totalSessions = funnel.find(f => f.stage === 'session_start')?.count || 0;
  const applies = funnel.find(f => f.stage === 'apply_click')?.count || 0;

  return NextResponse.json({
    campaign: campaignFilter || 'All Campaigns',
    days,
    funnel,
    channels: channelsWithCvr,
    spend: { total: totalSpend, impressions: totalImpressions, clicks: totalClicks, by_platform: spendRows },
    kpis: {
      total_spend: totalSpend,
      total_sessions: totalSessions,
      applies,
      signups,
      completions,
      cpa_signup: signups > 0 ? totalSpend / signups : 0,
      cpa_completion: completions > 0 ? totalSpend / completions : 0,
      // CVR at every stage
      cvr_click_to_signup: totalClicks > 0 ? (signups / totalClicks * 100) : 0,
      cvr_click_to_purchase: totalClicks > 0 ? (completions / totalClicks * 100) : 0,
      cvr_session_to_signup: totalSessions > 0 ? (signups / totalSessions * 100) : 0,
      cvr_session_to_purchase: totalSessions > 0 ? (completions / totalSessions * 100) : 0,
      cvr_signup_to_purchase: signups > 0 ? (completions / signups * 100) : 0,
    },
    available_campaigns: campaigns,
  });
}
