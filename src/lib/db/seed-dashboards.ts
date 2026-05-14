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
  // 1. Executive Overview — Leadership at-a-glance
  // -------------------------------------------------------------------------
  {
    title: 'Executive Overview',
    description:
      'Marketing performance at a glance — spend, funnel, attribution, top creatives.',
    layoutData: {
      widgets: [
        w('exec-filter',     'master-filter',        'Project Filter',      { days: 90 }),
        w('exec-paid-kpi',   'paid-kpi',             'Paid KPIs',           { days: 30 }),
        w('exec-categories', 'category-breakdown',   'By Project Type',     { days: 30 }),
        w('exec-funnel-viz', 'funnel-visualization', 'Conversion Funnel',   { days: 90 }),
        w('exec-channels',   'channel-attribution',  'Channel Attribution', { days: 90 }),
        w('exec-top-spend',  'top-campaign-spend',   'Top Campaigns',       { days: 90 }),
        w('exec-gallery',    'creative-gallery',     'Top Creatives',       { days: 30 }),
      ],
      gridLayouts: responsiveLayouts([
        g('exec-filter',      0,  0,  3, 6),
        g('exec-paid-kpi',    3,  0,  9, 2),
        g('exec-categories',  3,  2,  9, 4),
        g('exec-funnel-viz',  0,  6,  6, 8),
        g('exec-channels',    6,  6,  6, 8),
        g('exec-top-spend',   0, 14, 12, 6),
        g('exec-gallery',     0, 20, 12, 8),
      ]),
    },
  },

  // -------------------------------------------------------------------------
  // 2. Organic Social — What we can show from organic channels
  // -------------------------------------------------------------------------
  {
    title: 'Organic Social',
    description:
      'Organic channel performance — traffic sources, funnel attribution, pipeline impact.',
    layoutData: {
      widgets: [
        w('org-filter',      'master-filter',        'Project Filter',       { days: 90 }),
        w('org-paid-kpi',    'paid-kpi',             'Campaign KPIs',        { days: 30 }),
        w('org-funnel',      'funnel-visualization', 'Conversion Funnel',    { days: 90 }),
        w('org-channels',    'channel-attribution',  'Traffic Sources',      { days: 90 }),
        w('org-categories',  'category-breakdown',   'By Project Type',      { days: 30 }),
      ],
      gridLayouts: responsiveLayouts([
        g('org-filter',      0,  0,  3, 6),
        g('org-paid-kpi',    3,  0,  9, 2),
        g('org-funnel',      3,  2,  4, 4),
        g('org-channels',    7,  2,  5, 4),
        g('org-categories',  0,  6, 12, 6),
      ]),
    },
  },

  // -------------------------------------------------------------------------
  // 3. Paid Media — Full ad spend story
  // -------------------------------------------------------------------------
  {
    title: 'Paid Media',
    description:
      'Paid ad spend performance — campaign ROI, funnel, attribution, top creatives with full metrics.',
    layoutData: {
      widgets: [
        w('paid-filter',      'master-filter',        'Project Filter',      { days: 90 }),
        w('paid-kpi',         'paid-kpi',             'Paid KPIs',           { days: 30 }),
        w('paid-funnel-viz',  'funnel-visualization', 'Conversion Funnel',   { days: 90 }),
        w('paid-channels',    'channel-attribution',  'Channel Attribution', { days: 90 }),
        w('paid-top-spend',   'top-campaign-spend',   'Top Campaigns',       { days: 90 }),
        w('paid-gallery',     'creative-gallery',     'Top Creatives',       { days: 30 }),
        w('paid-categories',  'category-breakdown',   'By Project Type',     { days: 30 }),
      ],
      gridLayouts: responsiveLayouts([
        g('paid-filter',      0,  0,  3, 6),
        g('paid-kpi',         3,  0,  9, 2),
        g('paid-funnel-viz',  3,  2,  4, 4),
        g('paid-channels',    7,  2,  5, 4),
        g('paid-top-spend',   0,  6, 12, 6),
        g('paid-gallery',     0, 12, 12, 8),
        g('paid-categories',  0, 20, 12, 6),
      ]),
    },
  },

  // -------------------------------------------------------------------------
  // 4. Recruitment Pipeline — Operations view
  // -------------------------------------------------------------------------
  {
    title: 'Recruitment Pipeline',
    description:
      'Campaign operations — pipeline status, urgency, timeline, creative output.',
    layoutData: {
      widgets: [
        w('pipe-kpi',      'kpi-cards',           'KPI Cards',          {}),
        w('pipe-status',   'pipeline-overview',   'Pipeline Status',    {}),
        w('pipe-urgency',  'urgency-breakdown',   'Urgency Breakdown',  {}),
        w('pipe-timeline', 'campaign-timeline',   'Campaign Timeline',  {}),
        w('pipe-assets',   'asset-gallery',       'Asset Gallery',      {}),
      ],
      gridLayouts: responsiveLayouts([
        g('pipe-kpi',      0, 0, 12, 2),
        g('pipe-status',   0, 2,  6, 4),
        g('pipe-urgency',  6, 2,  6, 4),
        g('pipe-timeline', 0, 6, 12, 4),
        g('pipe-assets',   0, 10, 12, 4),
      ]),
    },
  },

  // -------------------------------------------------------------------------
  // 5. Creative Intelligence — Which creatives win
  // -------------------------------------------------------------------------
  {
    title: 'Creative Intelligence',
    description:
      'Which creatives drive results? Ad images ranked by conversions, CTR, and CPA across all campaigns.',
    layoutData: {
      widgets: [
        w('ci-filter',       'master-filter',        'Project Filter',           { days: 90 }),
        w('ci-paid-kpi',     'paid-kpi',             'Project KPIs',             { days: 30 }),
        w('ci-gallery-all',  'creative-gallery',     'Top Creatives',            { days: 30 }),
        w('ci-funnel-viz',   'funnel-visualization', 'Conversion Funnel',        { days: 90 }),
        w('ci-channels',     'channel-attribution',  'Channel Attribution',      { days: 90 }),
        w('ci-top-spend',    'top-campaign-spend',   'Top Campaigns by Spend',   { days: 90 }),
      ],
      gridLayouts: responsiveLayouts([
        g('ci-filter',       0,  0,  3, 6),
        g('ci-paid-kpi',     3,  0,  9, 2),
        g('ci-gallery-all',  3,  2,  9, 4),
        g('ci-funnel-viz',   0,  6,  6, 8),
        g('ci-channels',     6,  6,  6, 8),
        g('ci-top-spend',    0, 14, 12, 6),
      ]),
    },
  },

  // -------------------------------------------------------------------------
  // 6. Recruitment ROI — Prove marketing dollars work
  // -------------------------------------------------------------------------
  {
    title: 'Recruitment ROI',
    description:
      'Prove marketing dollars drive results. Completions by source, CPA trending down, volume trending up.',
    layoutData: {
      widgets: [
        w('roi-filter',       'master-filter',              'Project Filter',       { days: 90 }),
        w('roi-paid-kpi',     'paid-kpi',                   'Paid KPIs',            { days: 30 }),
        w('roi-categories',   'category-breakdown',         'By Project Type',      { days: 30 }),
        w('roi-attribution',  'recruitment-attribution',    'Source Attribution',    { days: 30 }),
        w('roi-funnel-viz',   'funnel-visualization',       'Conversion Funnel',    { days: 90 }),
        w('roi-channels',     'channel-attribution',        'Channel Attribution',  { days: 90 }),
        w('roi-top-spend',    'top-campaign-spend',         'Top Campaigns',        { days: 90 }),
        w('roi-gallery',      'creative-gallery',           'Top Creatives',        { days: 30 }),
      ],
      gridLayouts: responsiveLayouts([
        g('roi-filter',       0,  0,  3, 6),
        g('roi-paid-kpi',     3,  0,  9, 2),
        g('roi-categories',   3,  2,  9, 4),
        g('roi-attribution',  0,  6, 12, 8),
        g('roi-funnel-viz',   0, 14,  6, 8),
        g('roi-channels',     6, 14,  6, 8),
        g('roi-top-spend',    0, 22, 12, 6),
        g('roi-gallery',      0, 28, 12, 8),
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
