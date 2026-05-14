import { getDb } from '@/lib/db';
import type { DashboardLayoutData, GridLayoutItem, WidgetInstance, WidgetType } from '@/components/insights/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function w(id: string, type: WidgetType, title: string, config: Record<string, unknown> = {}): WidgetInstance {
  return { id, type, title, config };
}

function g(i: string, x: number, y: number, ww: number, h: number, minW = 4, minH = 2): GridLayoutItem {
  return { i, x, y, w: ww, h, minW, minH };
}

/**
 * Derives md and sm layouts from the lg layout.
 * md (8 cols): full-width items (w >= 12) → w=8; side-by-side pairs → w=4, x adjusted
 * sm (4 cols): all items w=4, x=0, y stacked in lg order
 */
function responsiveLayouts(lgLayout: GridLayoutItem[]): {
  lg: GridLayoutItem[];
  md: GridLayoutItem[];
  sm: GridLayoutItem[];
} {
  const md: GridLayoutItem[] = lgLayout.map((item) => {
    if (item.w >= 12) {
      return { ...item, w: 8, x: 0 };
    }
    // side-by-side: left stays x=0, right becomes x=4
    const mdX = item.x === 0 ? 0 : 4;
    return { ...item, w: 4, x: mdX };
  });

  // sm: stack everything in y order, all full-width
  const sorted = [...lgLayout].sort((a, b) => a.y - b.y || a.x - b.x);
  let smY = 0;
  const sm: GridLayoutItem[] = sorted.map((item) => {
    const smItem = { ...item, w: 4, x: 0, y: smY };
    smY += item.h;
    return smItem;
  });

  return { lg: lgLayout, md, sm };
}

// ---------------------------------------------------------------------------
// Dashboard definitions
// ---------------------------------------------------------------------------

interface DashboardSeed {
  title: string;
  description: string;
  layoutData: DashboardLayoutData;
}

const dashboards: DashboardSeed[] = [
  // -------------------------------------------------------------------------
  // 1. Executive Overview
  // -------------------------------------------------------------------------
  {
    title: 'Executive Overview',
    description:
      'Marketing performance at a glance — paid headline, organic presence, AI vs manual, top content.',
    layoutData: {
      widgets: [
        w('exec-paid-kpi',        'paid-kpi',                'Paid KPIs',              { days: 30 }),
        w('exec-categories',      'category-breakdown',      'By Project Type',         { days: 30 }),
        w('exec-organic-kpi',     'organic-kpi',             'Organic KPIs',            { days: 30 }),
        w('exec-paid-compare',    'paid-platform-compare',   'Paid by Platform',        { days: 30 }),
        w('exec-organic-compare', 'organic-platform-compare','Organic by Platform',     { days: 30 }),
        w('exec-attribution',     'organic-attribution',     'Attribution (AI vs Manual)',{ days: 30 }),
        w('exec-growth',          'organic-account-growth',  'Account Growth',          { days: 90 }),
        w('exec-funnel-viz',      'funnel-visualization',    'Conversion Funnel',       { days: 90 }),
        w('exec-channels',        'channel-attribution',     'Channel Attribution',     { days: 90 }),
        w('exec-top-posts',       'organic-top-posts',       'Top Posts',               { days: 30 }),
      ],
      gridLayouts: responsiveLayouts([
        g('exec-paid-kpi',        0, 0,  12, 2),
        g('exec-categories',      0, 2,  12, 6),
        g('exec-organic-kpi',     0, 8,  12, 2),
        g('exec-paid-compare',    0, 10,  6, 4),
        g('exec-organic-compare', 6, 10,  6, 4),
        g('exec-attribution',     0, 14,  6, 4),
        g('exec-growth',          6, 14,  6, 4),
        g('exec-funnel-viz',      0, 18,  6, 8),
        g('exec-channels',        6, 18,  6, 8),
        g('exec-top-posts',       0, 26, 12, 5),
      ]),
    },
  },

  // -------------------------------------------------------------------------
  // 2. Organic Social
  // -------------------------------------------------------------------------
  {
    title: 'Organic Social',
    description:
      'Organic social performance — platform engagement, follower growth, pipeline attribution, search visibility.',
    layoutData: {
      widgets: [
        w('org-kpi',         'organic-kpi',             'Organic KPIs',        { days: 30 }),
        w('org-compare',     'organic-platform-compare','Platform Breakdown',   { days: 30 }),
        w('org-growth',      'organic-account-growth',  'Account Growth',       { days: 90 }),
        w('org-attribution', 'organic-attribution',     'Pipeline Attribution', { days: 30 }),
        w('org-gsc',         'gsc-performance',         'Search Console',       { days: 28 }),
        w('org-posts',       'organic-top-posts',       'Top Posts',            { days: 30 }),
      ],
      gridLayouts: responsiveLayouts([
        g('org-kpi',          0, 0,  12, 2),
        g('org-compare',      0, 2,   6, 4),
        g('org-growth',       6, 2,   6, 4),
        g('org-attribution',  0, 6,   6, 4),
        g('org-gsc',          6, 6,   6, 5),
        g('org-posts',        0, 11, 12, 5),
      ]),
    },
  },

  // -------------------------------------------------------------------------
  // 3. Paid Media
  // -------------------------------------------------------------------------
  {
    title: 'Paid Media',
    description:
      'Paid ad spend performance — platform distribution, campaign breakdown, UTM attribution, recruiter leaderboard.',
    layoutData: {
      widgets: [
        w('paid-kpi',         'paid-kpi',              'Paid KPIs',             { days: 30 }),
        w('paid-compare',     'paid-platform-compare', 'Platform Distribution', { days: 30 }),
        w('paid-roi',         'campaign-roi',          'Campaign ROI',          { days: 30 }),
        w('paid-funnel-viz',  'funnel-visualization',  'Conversion Funnel',     { days: 90 }),
        w('paid-channels',    'channel-attribution',   'Channel Attribution',   { days: 90 }),
        w('paid-top-spend',   'top-campaign-spend',    'Top Campaigns',         { days: 90 }),
        w('paid-gallery',     'creative-gallery',      'Top Creatives',         { days: 30 }),
        w('paid-campaigns',   'paid-campaign-detail',  'Campaign Detail',       { days: 30 }),
        w('paid-utm',         'utm-funnel',            'UTM Funnel',            { days: 30 }),
        w('paid-leaderboard', 'recruiter-leaderboard', 'Recruiter Leaderboard', { days: 30 }),
      ],
      gridLayouts: responsiveLayouts([
        g('paid-kpi',         0, 0,  12, 2),
        g('paid-compare',     0, 2,   6, 4),
        g('paid-roi',         6, 2,   6, 4),
        g('paid-funnel-viz',  0, 6,   6, 8),
        g('paid-channels',    6, 6,   6, 8),
        g('paid-top-spend',   0, 14,  12, 6),
        g('paid-gallery',     0, 20, 12, 8),
        g('paid-campaigns',   0, 28, 12, 5),
        g('paid-utm',         0, 33,  6, 4),
        g('paid-leaderboard', 6, 33,  6, 4),
      ]),
    },
  },

  // -------------------------------------------------------------------------
  // 4. Recruitment Pipeline
  // -------------------------------------------------------------------------
  {
    title: 'Recruitment Pipeline',
    description:
      'Campaign operations — pipeline status, urgency, timeline, creative output, worker health.',
    layoutData: {
      widgets: [
        w('pipe-kpi',      'kpi-cards',          'KPI Cards',             {}),
        w('pipe-status',   'pipeline-overview',  'Pipeline Status',       {}),
        w('pipe-urgency',  'urgency-breakdown',  'Urgency Breakdown',     {}),
        w('pipe-timeline', 'campaign-timeline',  'Campaign Timeline',     {}),
        w('pipe-creative', 'creative-performance','Creative Performance', {}),
        w('pipe-assets',   'asset-gallery',      'Asset Gallery',         {}),
        w('pipe-workers',  'worker-health',      'Worker Health',         {}),
        w('pipe-regions',  'region-map',         'Region Map',            {}),
      ],
      gridLayouts: responsiveLayouts([
        g('pipe-kpi',      0, 0,  12, 2),
        g('pipe-status',   0, 2,   6, 4),
        g('pipe-urgency',  6, 2,   6, 4),
        g('pipe-timeline', 0, 6,  12, 4),
        g('pipe-creative', 0, 10,  6, 4),
        g('pipe-assets',   6, 10,  6, 4),
        g('pipe-workers',  0, 14,  6, 3),
        g('pipe-regions',  6, 14,  6, 4),
      ]),
    },
  },

  // -------------------------------------------------------------------------
  // 5. Creative Intelligence
  // -------------------------------------------------------------------------
  {
    title: 'Creative Intelligence',
    description:
      'Which creatives drive results? Ad images with full funnel metrics per channel. Filter by campaign to compare creative performance across Meta, Reddit, and TikTok.',
    layoutData: {
      widgets: [
        w('ci-paid-kpi',      'paid-kpi',              'Project KPIs',             { days: 30 }),
        w('ci-funnel-viz',    'funnel-visualization',  'Conversion Funnel',         { days: 90 }),
        w('ci-channels',      'channel-attribution',   'Channel Attribution',       { days: 90 }),
        w('ci-top-spend',     'top-campaign-spend',    'Top Campaigns by Spend',    { days: 90 }),
        w('ci-gallery-all',   'creative-gallery',      'Top Creatives — All',       { days: 30 }),
        w('ci-compare',       'paid-platform-compare', 'Spend by Channel',          { days: 30 }),
        w('ci-attribution',   'organic-attribution',   'Pipeline vs Manual',        { days: 30 }),
        w('ci-campaigns',     'paid-campaign-detail',  'Campaign Breakdown',        { days: 30 }),
      ],
      gridLayouts: responsiveLayouts([
        g('ci-paid-kpi',      0, 0,  12, 2),
        g('ci-funnel-viz',    0, 2,   6, 8),
        g('ci-channels',      6, 2,   6, 8),
        g('ci-top-spend',     0, 10, 12, 6),
        g('ci-gallery-all',   0, 16, 12, 8),
        g('ci-compare',       0, 24,  6, 4),
        g('ci-attribution',   6, 24,  6, 4),
        g('ci-campaigns',     0, 28, 12, 5),
      ]),
    },
  },
  // -------------------------------------------------------------------------
  // 6. Recruitment ROI
  // -------------------------------------------------------------------------
  {
    title: 'Recruitment ROI',
    description:
      'Prove marketing dollars drive results. Completions by source, CPA trending down, volume trending up. Filter by campaign.',
    layoutData: {
      widgets: [
        w('roi-paid-kpi',       'paid-kpi',                  'Paid KPIs',               { days: 30 }),
        w('roi-categories',     'category-breakdown',        'By Project Type',         { days: 30 }),
        w('roi-attribution',    'recruitment-attribution',   'Source Attribution',       { days: 30 }),
        w('roi-funnel-viz',     'funnel-visualization',      'Conversion Funnel',       { days: 90 }),
        w('roi-channels',       'channel-attribution',       'Channel Attribution',     { days: 90 }),
        w('roi-top-spend',      'top-campaign-spend',        'Top Campaigns by Spend',  { days: 90 }),
        w('roi-gallery',        'creative-gallery',          'Top Creatives',           { days: 30 }),
      ],
      gridLayouts: responsiveLayouts([
        g('roi-paid-kpi',       0, 0,  12, 2),
        g('roi-categories',     0, 2,  12, 6),
        g('roi-attribution',    0, 8,  12, 8),
        g('roi-funnel-viz',     0, 16,  6, 8),
        g('roi-channels',       6, 16,  6, 8),
        g('roi-top-spend',      0, 24, 12, 6),
        g('roi-gallery',        0, 30, 12, 8),
      ]),
    },
  },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

export async function seedPrebuiltDashboards(): Promise<void> {
  const sql = getDb();

  for (const dash of dashboards) {
    const existing = await sql`
      SELECT id FROM dashboards WHERE created_by = 'system' AND title = ${dash.title}
    `;
    if (existing.length > 0) continue;

    await sql`
      INSERT INTO dashboards (title, description, layout_data, created_by, is_template)
      VALUES (
        ${dash.title},
        ${dash.description},
        ${JSON.stringify(dash.layoutData)}::jsonb,
        ${'system'},
        ${false}
      )
    `;
  }
}
