import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { callNIM } from '@/lib/nim';
import { createDashboard } from '@/lib/db/dashboards';
import { getDb } from '@/lib/db';
import type { DashboardLayoutData, WidgetType, GridLayoutItem, WidgetInstance } from '@/components/insights/types';

// ---------------------------------------------------------------------------
// Widget catalog — simplified for LLM (no component references)
// ---------------------------------------------------------------------------
const WIDGET_CATALOG = [
  { type: 'paid-kpi', label: 'Paid KPIs', description: 'Spend, impressions, clicks, conversions, CPA, CTR', config: '{ days: number }', size: '12x2' },
  { type: 'organic-kpi', label: 'Organic KPIs', description: 'Impressions, reach, engagement, clicks, followers, eng rate', config: '{ days: number }', size: '12x2' },
  { type: 'campaign-funnel', label: 'Campaign Funnel', description: 'Full funnel: spend → sessions → signups → completions with CVR and channel breakdown', config: '{ days: number, campaign?: string }', size: '12x8' },
  { type: 'paid-platform-compare', label: 'Paid Platform Comparison', description: 'Spend by platform over time', config: '{ days: number }', size: '6x4' },
  { type: 'organic-platform-compare', label: 'Organic Platform Comparison', description: 'Engagement by platform over time', config: '{ days: number }', size: '6x4' },
  { type: 'paid-campaign-detail', label: 'Campaign Detail Table', description: 'Campaign-level spend, impressions, clicks, conversions, CPA', config: '{ days: number, platform?: string }', size: '12x5' },
  { type: 'organic-top-posts', label: 'Top Organic Posts', description: 'Ranked posts by engagement with pipeline/manual attribution', config: '{ days: number, platform?: string }', size: '12x5' },
  { type: 'organic-attribution', label: 'Pipeline vs Manual', description: 'AI-generated vs manual content comparison', config: '{ days: number }', size: '6x4' },
  { type: 'organic-account-growth', label: 'Account Growth', description: 'Follower count trends per platform', config: '{ days: number }', size: '6x4' },
  { type: 'gsc-performance', label: 'GSC Performance', description: 'Search queries, pages, clicks, position trends', config: '{ days: number }', size: '6x5' },
  { type: 'campaign-roi', label: 'Campaign Link ROI', description: 'Per-campaign tracked links and click performance', config: '{ days: number }', size: '6x4' },
  { type: 'utm-funnel', label: 'UTM Funnel', description: 'Clicks by source, medium, campaign', config: '{ days: number }', size: '6x4' },
  { type: 'recruiter-leaderboard', label: 'Recruiter Leaderboard', description: 'Ranked recruiters by clicks', config: '{ days: number }', size: '6x4' },
  { type: 'kpi-cards', label: 'Pipeline KPIs', description: 'Total campaigns, approved, generating, sent', config: '{}', size: '12x2' },
  { type: 'pipeline-overview', label: 'Pipeline Status', description: 'Campaign distribution by stage', config: '{}', size: '6x4' },
  { type: 'campaign-timeline', label: 'Campaign Timeline', description: 'Recent campaigns with status', config: '{}', size: '12x4' },
  { type: 'ga4-traffic', label: 'GA4 Traffic', description: 'Sessions, sources, devices', config: '{ days: number }', size: '6x4' },
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
