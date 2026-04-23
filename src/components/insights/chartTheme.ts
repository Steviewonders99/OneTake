/**
 * Light-theme chart styling for Insights widgets.
 * OneForma brand palette — white backgrounds, charcoal text.
 */

export const CHART_COLORS = {
  blue: '#0693e3',
  purple: '#9b51e0',
  green: '#16a34a',
  amber: '#ca8a04',
  red: '#dc2626',
  teal: '#0d9488',
  orange: '#ea580c',
  charcoal: '#32373c',
};

export const CHART_PALETTE = [
  CHART_COLORS.blue, CHART_COLORS.purple, CHART_COLORS.green,
  CHART_COLORS.amber, CHART_COLORS.teal, CHART_COLORS.orange,
  CHART_COLORS.red, CHART_COLORS.charcoal,
];

export const AXIS_STYLE = {
  tick: { fill: '#737373', fontSize: 11 },
  axisLine: { stroke: '#e5e5e5' },
  tickLine: { stroke: '#e5e5e5' },
};

export const GRID_STYLE = { stroke: '#f0f0f0', strokeDasharray: '3 3' };

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #e5e5e5',
    borderRadius: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    fontSize: 12,
    color: '#1a1a1a',
  },
  itemStyle: { color: '#1a1a1a' },
  labelStyle: { color: '#737373', fontWeight: 600 },
};
