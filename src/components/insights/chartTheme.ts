/**
 * Premium analytics chart theme — OneForma light.
 *
 * Inspired by SRC Command: extreme restraint, confident numbers,
 * barely-there grids, color only where it means something.
 * Translated to light OneForma brand palette.
 */

/* ── Palette ─────────────────────────────────────────────
 * Almost monochrome base. Color is ACCENT, not decoration.
 * Each color has ONE meaning — never decorative. */
export const CHART_COLORS = {
  /** Primary metric line / positive accent */
  green: '#22c55e',
  /** Secondary metric line */
  charcoal: '#32373c',
  /** Warning / moderate CPA */
  amber: '#eab308',
  /** Danger / high CPA / negative delta */
  red: '#ef4444',
  /** Platform: Meta / Facebook */
  blue: '#3b82f6',
  /** Platform: Instagram / creative */
  purple: '#a855f7',
  /** Platform: LinkedIn */
  teal: '#14b8a6',
  /** Platform: Reddit / TikTok */
  orange: '#f97316',
  /** Muted line / secondary series */
  muted: '#d4d4d4',
};

export const CHART_PALETTE = [
  CHART_COLORS.charcoal,
  CHART_COLORS.green,
  CHART_COLORS.blue,
  CHART_COLORS.amber,
  CHART_COLORS.teal,
  CHART_COLORS.orange,
  CHART_COLORS.purple,
  CHART_COLORS.red,
];

/* ── Axis ────────────────────────────────────────────────
 * Nearly invisible. Labels are whisper-light. */
export const AXIS_STYLE = {
  tick: { fill: '#a3a3a3', fontSize: 10, fontFamily: '-apple-system, system-ui, sans-serif' },
  axisLine: false as const,
  tickLine: false as const,
};

/* ── Grid ────────────────────────────────────────────────
 * Barely there — just enough to guide the eye. */
export const GRID_STYLE = {
  stroke: '#f0f0f0',
  strokeDasharray: '2 4',
  vertical: false as const,
};

/* ── Tooltip ─────────────────────────────────────────────
 * Clean, sharp, no rounded excess. */
export const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #e5e5e5',
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    fontSize: 11,
    fontFamily: '-apple-system, system-ui, sans-serif',
    color: '#1a1a1a',
    padding: '8px 12px',
  },
  itemStyle: { color: '#525252', fontSize: 11 },
  labelStyle: { color: '#a3a3a3', fontWeight: 500, fontSize: 10, marginBottom: 4 },
  cursor: { stroke: '#e5e5e5', strokeWidth: 1 },
};

/* ── Line props ──────────────────────────────────────────
 * Ultra-thin, no dots. Like SRC Command. */
export const LINE_STYLE = {
  strokeWidth: 1.5,
  dot: false as const,
  activeDot: { r: 3, stroke: '#fff', strokeWidth: 2 },
};

/* ── Bar props ───────────────────────────────────────────
 * Subtle radius, no border. */
export const BAR_STYLE = {
  radius: [3, 3, 0, 0] as [number, number, number, number],
  maxBarSize: 32,
};

/* ── Formatting helpers ──────────────────────────────────*/
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatCurrency(n: number, decimals = 0): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatDelta(n: number): { text: string; color: string } {
  if (n > 0) return { text: `+${n.toLocaleString()}`, color: CHART_COLORS.green };
  if (n < 0) return { text: n.toLocaleString(), color: CHART_COLORS.red };
  return { text: '0', color: '#a3a3a3' };
}

export const ANIMATION_CONFIG = {
  bar: { isAnimationActive: true, animationDuration: 600, animationEasing: 'ease-out' as const },
  line: { isAnimationActive: true, animationDuration: 800, animationEasing: 'ease-out' as const },
};
