import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { callNIM } from '@/lib/nim';
import { createDashboard } from '@/lib/db/dashboards';
import { getDb } from '@/lib/db';
import type { DashboardLayoutData, WidgetType, GridLayoutItem, WidgetInstance } from '@/components/insights/types';

// ---------------------------------------------------------------------------
// Widget catalog — ALL 43 widgets, grouped for LLM context
// Auto-derived from widgetRegistry.ts. LLM sees descriptions only, never data.
// ---------------------------------------------------------------------------
const WIDGET_CATALOG = [
  // ── Paid Media (10) ─────────────────────────────────────────
  { type: 'paid-kpi', label: 'Paid KPIs', description: 'Headline spend, impressions, clicks, conversions, CPA, CTR across all paid platforms', config: '{ days: number }', size: '12x2' },
  { type: 'paid-platform-compare', label: 'Paid Platform Comparison', description: 'Spend by platform over time — Meta, Reddit, LinkedIn, Google, TikTok', config: '{ days: number }', size: '6x4' },
  { type: 'paid-campaign-detail', label: 'Campaign Detail Table', description: 'Campaign-level spend, impressions, clicks, conversions, CPA breakdown', config: '{ days: number, platform?: string }', size: '12x5' },
  { type: 'campaign-funnel', label: 'Project Funnel', description: 'Full funnel: ad spend → sessions → sign-ups → completions. Cross-channel, per campaign', config: '{ days: number, campaign?: string }', size: '12x8' },
  { type: 'funnel-visualization', label: 'Visual Funnel', description: 'Tapered funnel: sessions → sign-ups → completions with drop-off rates and CVR', config: '{ days: number }', size: '6x8' },
  { type: 'channel-attribution', label: 'Channel Attribution', description: 'Sessions, sign-ups, completions and CVR by traffic source and medium', config: '{ days: number }', size: '6x6' },
  { type: 'top-campaign-spend', label: 'Top Campaigns by Spend', description: 'Top 10 campaigns ranked by ad spend with impressions and clicks', config: '{ days: number }', size: '6x6' },
  { type: 'creative-gallery', label: 'Creative Gallery', description: 'Ad creative images with performance metrics — see what works', config: '{ days: number }', size: '12x8' },
  { type: 'category-breakdown', label: 'Project Categories', description: 'Performance by project type: Data Collection, Language, Evaluation, Onsite', config: '{ days: number }', size: '12x6' },
  { type: 'recruitment-attribution', label: 'Recruitment Attribution', description: 'Form completions by traffic source + city with W1 vs W2 and CPA trends', config: '{ days: number }', size: '12x8' },

  // ── Organic Social (6) ──────────────────────────────────────
  { type: 'organic-kpi', label: 'Organic KPIs', description: 'Impressions, reach, engagement, follower delta across Facebook, Instagram, LinkedIn, Reddit', config: '{ days: number }', size: '12x2' },
  { type: 'organic-platform-compare', label: 'Organic Platform Comparison', description: 'Engagement by platform over time — Facebook, Instagram, LinkedIn, Reddit', config: '{ days: number }', size: '6x4' },
  { type: 'organic-top-posts', label: 'Top Organic Posts', description: 'Ranked posts by engagement with content type classification and pipeline attribution', config: '{ days: number, platform?: string }', size: '12x5' },
  { type: 'organic-attribution', label: 'Pipeline vs Manual', description: 'AI-generated vs manually posted content performance comparison', config: '{ days: number }', size: '6x4' },
  { type: 'organic-account-growth', label: 'Account Growth', description: 'Follower count trends per platform over time', config: '{ days: number }', size: '6x4' },
  { type: 'gsc-performance', label: 'GSC Performance', description: 'Google Search Console: top queries, pages, click/impression trends, avg position', config: '{ days: number }', size: '6x5' },

  // ── Pipeline & Operations (8) ───────────────────────────────
  { type: 'kpi-cards', label: 'Pipeline KPIs', description: 'Total campaigns, approved, generating, sent to agency', config: '{}', size: '12x2' },
  { type: 'pipeline-overview', label: 'Pipeline Status', description: 'Campaign distribution by pipeline stage (donut/bar chart)', config: '{}', size: '6x4' },
  { type: 'campaign-timeline', label: 'Campaign Timeline', description: 'Recent campaigns with status, progress, and timeline', config: '{}', size: '12x4' },
  { type: 'urgency-breakdown', label: 'Urgency Breakdown', description: 'Urgent vs standard vs pipeline campaign distribution', config: '{}', size: '4x3' },
  { type: 'recent-activity', label: 'Recent Activity', description: 'Latest campaign updates, approvals, and pipeline events feed', config: '{}', size: '12x4' },
  { type: 'worker-health', label: 'Worker Health', description: 'Compute job status, success/failure rates, avg processing time', config: '{}', size: '6x3' },
  { type: 'pipeline-performance', label: 'Pipeline Performance', description: 'Stage durations and success/failure rates across the pipeline', config: '{}', size: '12x4' },
  { type: 'region-map', label: 'Region Distribution', description: 'Campaign target regions breakdown — geographic distribution', config: '{}', size: '6x4' },

  // ── UTM & Link Analytics (6) ────────────────────────────────
  { type: 'click-analytics', label: 'Click Overview', description: 'Total clicks, tracked links, and recruiter count', config: '{ days: number }', size: '6x4' },
  { type: 'utm-funnel', label: 'UTM Breakdown', description: 'Clicks by UTM source, medium, and campaign — full drill-down', config: '{ days: number }', size: '6x4' },
  { type: 'recruiter-leaderboard', label: 'Recruiter Leaderboard', description: 'Ranked recruiters by clicks, links created, and active campaigns', config: '{ days: number }', size: '6x4' },
  { type: 'campaign-roi', label: 'Campaign Link ROI', description: 'Per-campaign tracked links and total click performance', config: '{ days: number }', size: '12x4' },
  { type: 'source-heatmap', label: 'Source x Medium Heatmap', description: 'Heatmap grid of clicks by UTM source and medium combinations', config: '{ days: number }', size: '6x5' },
  { type: 'link-builder', label: 'Quick Link Builder', description: 'Create UTM tracked links without leaving the dashboard', config: '{}', size: '6x3' },

  // ── AudienceIQ & Behavioral (10) ────────────────────────────
  { type: 'contributor-funnel', label: 'Contributor Funnel', description: 'Clicks → signups → active → quality threshold conversion funnel', config: '{ days: number }', size: '12x4' },
  { type: 'quality-by-channel', label: 'Quality by Channel', description: 'Average contributor quality score per UTM source', config: '{ days: number }', size: '6x4' },
  { type: 'retention-curve', label: 'Retention Curve', description: 'Contributor retention by campaign over 30/60/90 days', config: '{ days: number }', size: '6x4' },
  { type: 'skill-distribution', label: 'Skill Distribution', description: 'Declared skills vs actual CRM contributor skills — divergence chart', config: '{}', size: '6x4' },
  { type: 'targeting-vs-reality', label: 'Targeting vs Reality', description: 'Side-by-side: declared ICP regions/languages/skills vs CRM actuals', config: '{}', size: '12x5' },
  { type: 'drift-radar', label: 'Drift Radar', description: 'Four-ring audience drift visualization with severity indicators', config: '{}', size: '6x5' },
  { type: 'audience-health', label: 'Audience Health Score', description: 'Health score gauge (0-100) with actionable issue detection', config: '{}', size: '6x5' },
  { type: 'ga4-traffic', label: 'GA4 Traffic', description: 'Sessions, traffic sources, and device breakdown from Google Analytics', config: '{ days: number }', size: '6x4' },
  { type: 'gsc-queries', label: 'Search Queries', description: 'Top search queries driving traffic from Google Search Console', config: '{ days: number }', size: '6x4' },
  { type: 'platform-audiences', label: 'Platform Audiences', description: 'Multi-platform ad audience overview — Google, Meta, LinkedIn, TikTok', config: '{}', size: '12x4' },

  // ── HIE Behavioral (3) ──────────────────────────────────────
  { type: 'hie-heatmap', label: 'Click Heatmap', description: 'Click density grid for tracked landing pages', config: '{ url?: string }', size: '6x5' },
  { type: 'hie-scrollmap', label: 'Scroll Depth Map', description: 'Scroll depth distribution with milestone annotations', config: '{ url?: string }', size: '6x4' },
  { type: 'hie-form-friction', label: 'CRO Diagnostics', description: 'Scroll cliffs, CTA weakness, form friction analysis', config: '{ url?: string }', size: '12x4' },

  // ── Assets & Creative (2) ───────────────────────────────────
  { type: 'asset-gallery', label: 'Asset Summary', description: 'Generated assets by type and platform with pass rates', config: '{}', size: '6x4' },
  { type: 'creative-performance', label: 'Creative Performance', description: 'Which creatives drive the most clicks — asset-to-click correlation', config: '{ days: number }', size: '12x4' },

  // ── Utility (2) ─────────────────────────────────────────────
  { type: 'master-filter', label: 'Campaign Filter', description: 'Master campaign selector — all widgets on the dashboard respond to this filter', config: '{}', size: '3x6' },
  { type: 'text-note', label: 'Text Note', description: 'Add custom text annotations or notes to the dashboard', config: '{ text?: string }', size: '6x3' },
] as const;

const VALID_WIDGET_TYPES = new Set<string>(WIDGET_CATALOG.map((w) => w.type));

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a dashboard composer for OneForma marketing analytics (recruitment / contributor acquisition platform).

Given a user's natural language question, select 3–8 relevant widgets from the catalog and arrange them into a responsive dashboard layout.

Rules:
- Start with a KPI widget (paid-kpi, organic-kpi, or kpi-cards) for headline numbers.
- Use campaign-funnel for any funnel / conversion / drop-off question.
- Use side-by-side widgets (w: 6) for comparisons; full-width (w: 12) for detail tables and timelines.
- When the user mentions a specific campaign or platform, set it in the widget config.
- Default days to 30 unless the user specifies a different time window.
- Grid is 12 columns. Stack rows by incrementing y by the previous widget's h.
- Side-by-side layout: left widget x=0 w=6, right widget x=6 w=6.
- Full-width: x=0 w=12.
- Each widget must have a unique id (e.g. "w1", "w2", …).

Respond with ONLY valid JSON — no explanation, no markdown fences. Schema:
{
  "title": "string — concise dashboard name",
  "description": "string — one-sentence summary",
  "widgets": [
    { "id": "string", "type": "WidgetType", "title": "string", "config": { "days": number, ...optional } }
  ],
  "gridLayouts": {
    "lg": [{ "i": "string", "x": 0, "y": 0, "w": 12, "h": 4, "minW": 4, "minH": 2 }]
  }
}`;

// ---------------------------------------------------------------------------
// Layout generation helpers
// ---------------------------------------------------------------------------

/** Parse "WxH" size string from catalog */
function parseCatalogSize(type: string): { w: number; h: number } {
  const entry = WIDGET_CATALOG.find((c) => c.type === type);
  if (!entry) return { w: 6, h: 4 };
  const [ws, hs] = entry.size.split('x');
  return { w: parseInt(ws, 10), h: parseInt(hs, 10) };
}

/** Generate md (8-col) layout by scaling lg */
function generateMdLayout(lgLayout: GridLayoutItem[]): GridLayoutItem[] {
  return lgLayout.map((item) => ({
    ...item,
    x: item.w === 12 ? 0 : item.x === 0 ? 0 : 4,
    w: item.w === 12 ? 8 : 4,
    minW: Math.min(item.minW ?? 3, 4),
  }));
}

/** Generate sm (4-col) layout — stack everything vertically */
function generateSmLayout(lgLayout: GridLayoutItem[]): GridLayoutItem[] {
  let y = 0;
  return lgLayout.map((item) => {
    const smItem = { i: item.i, x: 0, y, w: 4, h: item.h };
    y += item.h;
    return smItem;
  });
}

/** Build lg grid from widgets when LLM didn't provide gridLayouts */
function buildLgLayout(widgets: WidgetInstance[]): GridLayoutItem[] {
  const lg: GridLayoutItem[] = [];
  let y = 0;
  let i = 0;

  while (i < widgets.length) {
    const widget = widgets[i];
    const { w: defaultW, h } = parseCatalogSize(widget.type);

    if (defaultW === 6 && i + 1 < widgets.length) {
      const next = widgets[i + 1];
      const { w: nextW } = parseCatalogSize(next.type);
      if (nextW === 6) {
        // Side-by-side pair
        lg.push({ i: widget.id, x: 0, y, w: 6, h, minW: 4, minH: 2 });
        lg.push({ i: next.id, x: 6, y, w: 6, h, minW: 4, minH: 2 });
        y += h;
        i += 2;
        continue;
      }
    }

    // Full-width (or solo 6-col)
    lg.push({ i: widget.id, x: 0, y, w: defaultW, h, minW: Math.min(defaultW, 4), minH: 2 });
    y += h;
    i++;
  }

  return lg;
}

// ---------------------------------------------------------------------------
// POST /api/insights/ai/compose
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // 1. Auth
  const user = await requireAuth();

  // 2. Body
  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // 3. Fetch available campaign names for LLM context
  const sql = getDb();
  let campaigns: string[] = [];
  try {
    const rows = await sql`
      SELECT DISTINCT campaign
      FROM ga4_funnel_events
      WHERE campaign NOT IN ('(direct)', '(organic)', '(referral)', '(not set)', '')
      ORDER BY campaign
      LIMIT 50
    `;
    campaigns = rows.map((r: Record<string, unknown>) => String(r.campaign));
  } catch {
    // Table may not exist in dev — non-fatal
  }

  // 4. Build user prompt
  const catalogText = WIDGET_CATALOG.map(
    (w) => `- type: "${w.type}" | label: "${w.label}" | ${w.description} | config: ${w.config} | default size: ${w.size}`,
  ).join('\n');

  const campaignContext =
    campaigns.length > 0
      ? `\nAvailable campaigns in the database: ${campaigns.slice(0, 20).join(', ')}`
      : '';

  const userPrompt = `Widget catalog:\n${catalogText}${campaignContext}\n\nUser request: ${prompt}`;

  // 5. Call LLM
  let rawResponse: string;
  try {
    rawResponse = await callNIM(SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    console.error('[compose] LLM call failed:', err);
    return NextResponse.json(
      { error: 'AI service unavailable. Please try again shortly.' },
      { status: 500 },
    );
  }

  // 6. Parse JSON — strip markdown code blocks if present
  let parsed: {
    title?: string;
    description?: string;
    widgets?: Array<{ id: string; type: string; title: string; config: Record<string, unknown> }>;
    gridLayouts?: { lg?: GridLayoutItem[]; md?: GridLayoutItem[]; sm?: GridLayoutItem[] };
  };

  try {
    const cleaned = rawResponse
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[compose] JSON parse failed. Raw response:', rawResponse.slice(0, 500));
    return NextResponse.json(
      { error: 'AI returned an unreadable response. Please rephrase your request.' },
      { status: 500 },
    );
  }

  // 7. Validate widgets
  const rawWidgets = Array.isArray(parsed.widgets) ? parsed.widgets : [];
  const validWidgets: WidgetInstance[] = rawWidgets
    .filter((w) => w?.type && VALID_WIDGET_TYPES.has(w.type))
    .map((w) => ({
      id: w.id || `w-${Math.random().toString(36).slice(2, 7)}`,
      type: w.type as WidgetType,
      title: w.title || w.type,
      config: w.config ?? {},
    }));

  if (validWidgets.length === 0) {
    return NextResponse.json(
      { error: 'AI could not identify suitable widgets for your request. Try rephrasing.' },
      { status: 422 },
    );
  }

  // 8. Build / fill responsive layouts
  const llmLg = Array.isArray(parsed.gridLayouts?.lg) ? parsed.gridLayouts!.lg! : null;

  // Filter lg to only valid widget ids
  const validIds = new Set(validWidgets.map((w) => w.id));
  const lgLayout: GridLayoutItem[] = llmLg
    ? llmLg.filter((item) => validIds.has(item.i))
    : buildLgLayout(validWidgets);

  // If LLM provided lg but missed some widgets, append them
  if (llmLg) {
    const coveredIds = new Set(lgLayout.map((item) => item.i));
    const missing = validWidgets.filter((w) => !coveredIds.has(w.id));
    const maxY = lgLayout.reduce((acc, item) => Math.max(acc, item.y + item.h), 0);
    let y = maxY;
    for (const widget of missing) {
      const { w, h } = parseCatalogSize(widget.type);
      lgLayout.push({ i: widget.id, x: 0, y, w, h, minW: Math.min(w, 4), minH: 2 });
      y += h;
    }
  }

  const mdLayout = Array.isArray(parsed.gridLayouts?.md)
    ? parsed.gridLayouts!.md!
    : generateMdLayout(lgLayout);

  const smLayout = Array.isArray(parsed.gridLayouts?.sm)
    ? parsed.gridLayouts!.sm!
    : generateSmLayout(lgLayout);

  const layoutData: DashboardLayoutData = {
    widgets: validWidgets,
    gridLayouts: { lg: lgLayout, md: mdLayout, sm: smLayout },
  };

  // 9. Create dashboard
  let dashboard;
  try {
    dashboard = await createDashboard(
      parsed.title || 'AI Dashboard',
      user.userId,
      layoutData,
      parsed.description ?? `Generated from: "${prompt}"`,
    );
  } catch (err) {
    console.error('[compose] createDashboard failed:', err);
    return NextResponse.json({ error: 'Failed to save dashboard.' }, { status: 500 });
  }

  // 10. Return id + title for redirect
  return NextResponse.json({ id: dashboard.id, title: dashboard.title }, { status: 201 });
}
