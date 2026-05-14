/**
 * Source normalization — maps raw GA4/UTM source strings to clean display names.
 * Single source of truth used by all dashboard widgets.
 */

const EXACT_MAP: Record<string, string> = {
  'paid_media': 'Paid Media',
  'facebook': 'Facebook Paid',
  'l.facebook.com': 'FB Organic',
  'lm.facebook.com': 'FB Organic',
  'm.facebook.com': 'FB Organic',
  'fb': 'Facebook Paid',
  'brevo': 'Brevo Email',
  'google': 'Google',
  'bing': 'Bing',
  'handshake': 'Handshake',
  'youtube.com': 'YouTube',
  'linkedin': 'LinkedIn',
  'tiktok': 'TikTok',
  '(direct)': 'Direct',
  'direct': 'Direct',
  '(not set)': 'Unknown',
  'not set': 'Unknown',
  'ig': 'Instagram Paid',
  'indeed': 'Indeed',
  'reddit': 'Reddit',
  'craigslist': 'Craigslist',
  'twitter': 'Twitter/X',
  'x.com': 'Twitter/X',
  'glassdoor': 'Glassdoor',
  'meta': 'Meta Paid',
};

const PARTIAL_MAP: [string, string][] = [
  ['facebook', 'FB Organic'],
  ['instagram', 'Instagram'],
  ['linkedin', 'LinkedIn'],
  ['tiktok', 'TikTok'],
  ['reddit', 'Reddit'],
  ['youtube', 'YouTube'],
  ['brevo', 'Brevo Email'],
  ['indeed', 'Indeed'],
  ['handshake', 'Handshake'],
  ['oneforma', 'OneForma Internal'],
  ['teams', 'MS Teams'],
  ['aidaform', 'AidaForm'],
];

const SOURCE_COLORS: Record<string, string> = {
  'Paid Media': '#3b82f6',
  'Facebook Paid': '#3b82f6',
  'FB Organic': '#3b82f6',
  'Meta Paid': '#3b82f6',
  'Meta Ad': '#3b82f6',
  'Instagram Paid': '#a855f7',
  'Instagram': '#a855f7',
  'Google': '#22c55e',
  'Bing': '#22c55e',
  'Brevo Email': '#eab308',
  'Reddit': '#f97316',
  'TikTok': '#1a1a1a',
  'LinkedIn': '#14b8a6',
  'YouTube': '#ef4444',
  'Handshake': '#a855f7',
  'Indeed': '#3b82f6',
  'Direct': '#a3a3a3',
  'Unknown': '#d4d4d4',
  'OneForma Internal': '#d4d4d4',
};

/**
 * Normalize a raw GA4/UTM source string to a clean display name.
 */
export function normalizeSource(source: string): string {
  if (!source) return 'Unknown';
  const s = source.toLowerCase().trim();

  // Exact match
  if (EXACT_MAP[s]) return EXACT_MAP[s];

  // Partial match
  for (const [pattern, label] of PARTIAL_MAP) {
    if (s.includes(pattern)) return label;
  }

  // Numeric IDs (Meta campaign/ad IDs)
  if (/^\d{5,}$/.test(s)) return 'Meta Ad';

  // URLs → extract domain name
  if (s.includes('.com') || s.includes('.org') || s.includes('.net') || s.includes('.io')) {
    const domain = s.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].split('.')[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }

  // Truncate long unknown strings
  return source.length > 14 ? source.slice(0, 13) + '…' : source;
}

/**
 * Get the brand color for a normalized source name.
 */
export function getSourceColor(normalizedSource: string): string {
  return SOURCE_COLORS[normalizedSource] || '#d4d4d4';
}

/**
 * Classify a source/medium pair into a channel type.
 */
export function classifyChannel(source: string, medium: string): string {
  const s = source.toLowerCase();
  const m = medium.toLowerCase();
  if (m === 'paid' || m === 'cpc' || s === 'paid_media' || s === 'meta') return 'Paid';
  if (s === 'facebook' || s === 'fb') return 'Paid';
  if (m === 'organic') return 'Organic';
  if (m === 'email' || s === 'brevo') return 'Email';
  if (m === 'referral') return 'Referral';
  if (s === '(direct)' || s === 'direct') return 'Direct';
  if (s.includes('tiktok') || s.includes('reddit') || s.includes('linkedin')) return 'Paid';
  return 'Other';
}
