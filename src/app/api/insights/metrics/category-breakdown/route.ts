import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getCampaignCategory, PROJECT_CATEGORIES, type ProjectCategory } from '@/lib/project-categories';

/**
 * Category Breakdown API — aggregate paid + funnel metrics by project category.
 *
 * Groups campaigns into: Data Collection, Language Services, Evaluation, Onsite Study, General.
 * Returns per-category: spend, impressions, clicks, conversions, CPA, sessions, signups, completions, CVR.
 */
export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30') || 30);

  // Get paid metrics by campaign
  const paidRows = await sql`
    SELECT campaign_name, SUM(impressions)::int as impressions, SUM(clicks)::int as clicks,
           SUM(spend)::float as spend, SUM(conversions)::int as conversions
    FROM meta_ads_cache WHERE date >= CURRENT_DATE - ${days}
    GROUP BY campaign_name
  `;

  // Get funnel metrics by campaign
  const funnelRows = await sql`
    SELECT campaign,
           SUM(CASE WHEN event_name = 'session_start' THEN event_count ELSE 0 END)::int as sessions,
           SUM(CASE WHEN event_name = 'sign_up' THEN event_count ELSE 0 END)::int as signups,
           SUM(CASE WHEN event_name = 'purchase' THEN event_count ELSE 0 END)::int as completions
    FROM ga4_funnel_events
    WHERE date >= CURRENT_DATE - ${days}
      AND campaign NOT IN ('(direct)', '(organic)', '(referral)', '(not set)')
    GROUP BY campaign
  `;

  // Group by category
  const categories = new Map<ProjectCategory, {
    spend: number; impressions: number; clicks: number; conversions: number;
    sessions: number; signups: number; completions: number; campaigns: Set<string>;
  }>();

  for (const row of paidRows as any[]) {
    const cat = getCampaignCategory(row.campaign_name || '');
    const existing = categories.get(cat) || {
      spend: 0, impressions: 0, clicks: 0, conversions: 0,
      sessions: 0, signups: 0, completions: 0, campaigns: new Set<string>(),
    };
    existing.spend += row.spend || 0;
    existing.impressions += row.impressions || 0;
    existing.clicks += row.clicks || 0;
    existing.conversions += row.conversions || 0;
    existing.campaigns.add(row.campaign_name);
    categories.set(cat, existing);
  }

  for (const row of funnelRows as any[]) {
    const cat = getCampaignCategory(row.campaign || '');
    const existing = categories.get(cat) || {
      spend: 0, impressions: 0, clicks: 0, conversions: 0,
      sessions: 0, signups: 0, completions: 0, campaigns: new Set<string>(),
    };
    existing.sessions += row.sessions || 0;
    existing.signups += row.signups || 0;
    existing.completions += row.completions || 0;
    existing.campaigns.add(row.campaign);
    categories.set(cat, existing);
  }

  const result = Array.from(categories.entries()).map(([cat, data]) => ({
    category: cat,
    color: PROJECT_CATEGORIES[cat].color,
    description: PROJECT_CATEGORIES[cat].description,
    campaign_count: data.campaigns.size,
    campaigns: Array.from(data.campaigns).filter(Boolean).slice(0, 10),
    spend: Math.round(data.spend * 100) / 100,
    impressions: data.impressions,
    clicks: data.clicks,
    conversions: data.conversions,
    cpa: data.conversions > 0 ? Math.round(data.spend / data.conversions * 100) / 100 : 0,
    sessions: data.sessions,
    signups: data.signups,
    completions: data.completions,
    cvr_session_to_completion: data.sessions > 0 ? Math.round(data.completions / data.sessions * 10000) / 100 : 0,
    cvr_click_to_signup: data.clicks > 0 ? Math.round(data.signups / data.clicks * 10000) / 100 : 0,
  })).sort((a, b) => b.spend - a.spend);

  return NextResponse.json({ categories: result, days });
}
