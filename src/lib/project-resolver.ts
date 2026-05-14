/**
 * Project Resolver — maps raw GA4 campaign strings to clean project names.
 *
 * GA4 campaigns come from many sources:
 * - Meta UTM: "humus", "humus-cold-nyc", "humus-twins"
 * - Meta campaign IDs: "6870656477862"
 * - Brevo email: "Milky Way LightSpeed - GB"
 * - Job boards: "MAPS_Milkyway"
 * - LinkedIn: "Milkyway_LI"
 *
 * This resolver groups them into project families.
 */

const PROJECT_MAP: [RegExp, string][] = [
  // Data Collection
  [/humus|hummus/i, 'Humus'],
  [/centaurus/i, 'Centaurus'],
  [/fur.?frame|pet.?video/i, 'Fur Frame'],
  [/andromeda/i, 'Andromeda'],
  [/nighthawk/i, 'Nighthawk'],
  [/cochera/i, 'Cochera'],
  [/casas/i, 'Casas'],
  [/moonbrush/i, 'MoonBrush'],
  [/jellyfish/i, 'Jellyfish'],
  [/karl/i, 'Karl'],

  // Language Services
  [/fred/i, 'Fred'],
  [/onyx|ocr/i, 'Onyx'],
  [/dapeng/i, 'Dapeng'],
  [/acceptability/i, 'Acceptability'],
  [/HT AND MTPE/i, 'HT & MTPE'],

  // Evaluation
  [/milky.?way|milkyway|MAPS/i, 'Milky Way'],
  [/lighthouse/i, 'Lighthouse'],
  [/vega/i, 'Vega'],
  [/cosmos/i, 'Cosmos'],
  [/amber/i, 'Amber'],
  [/orbit/i, 'Orbit'],

  // Onsite Study
  [/lumina/i, 'Lumina'],
];

/**
 * Resolve a raw GA4 campaign string to a clean project name.
 */
export function resolveProject(campaign: string): string {
  if (!campaign) return 'Unknown';

  for (const [pattern, name] of PROJECT_MAP) {
    if (pattern.test(campaign)) return name;
  }

  // Numeric IDs → try to match known Meta campaign IDs
  if (/^\d{5,}$/.test(campaign.trim())) return 'Meta Campaign';

  // Short unknown strings — return as-is with title case
  if (campaign.length < 30) {
    return campaign.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Long strings — truncate
  return campaign.slice(0, 25) + '…';
}

/**
 * Group raw campaign strings into project families.
 * Returns: { projectName: string, campaigns: string[], totalEvents: number }[]
 */
export function groupByProject(
  campaigns: { campaign: string; total: number }[],
): { project: string; campaigns: string[]; total: number }[] {
  const groups = new Map<string, { campaigns: string[]; total: number }>();

  for (const c of campaigns) {
    const project = resolveProject(c.campaign);
    const existing = groups.get(project) || { campaigns: [], total: 0 };
    existing.campaigns.push(c.campaign);
    existing.total += c.total;
    groups.set(project, existing);
  }

  return Array.from(groups.entries())
    .map(([project, data]) => ({ project, ...data }))
    .sort((a, b) => b.total - a.total);
}
