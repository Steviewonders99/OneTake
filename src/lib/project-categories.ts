/**
 * Project category taxonomy — maps campaign names to business categories.
 *
 * OneForma recruits for different types of work:
 * - Data Collection: video/image/audio capture for AI training
 * - Language Services: translation, OCR, annotation, transcription
 * - Evaluation: MAPS, search quality, content review
 * - Onsite Studies: in-person, location-specific data collection
 */

export type ProjectCategory =
  | 'Data Collection'
  | 'Language Services'
  | 'Evaluation'
  | 'Onsite Study'
  | 'General';

export interface ProjectCategoryInfo {
  category: ProjectCategory;
  color: string;
  description: string;
}

export const PROJECT_CATEGORIES: Record<ProjectCategory, ProjectCategoryInfo> = {
  'Data Collection': { category: 'Data Collection', color: '#3b82f6', description: 'Video, image, and audio capture for AI training' },
  'Language Services': { category: 'Language Services', color: '#a855f7', description: 'Translation, OCR, annotation, transcription' },
  'Evaluation': { category: 'Evaluation', color: '#14b8a6', description: 'MAPS, search quality, content review' },
  'Onsite Study': { category: 'Onsite Study', color: '#f97316', description: 'In-person, location-specific data collection' },
  'General': { category: 'General', color: '#a3a3a3', description: 'Uncategorized campaigns' },
};

/**
 * Maps campaign names (fuzzy) to project categories.
 * Add new campaigns here as they launch.
 */
const CAMPAIGN_MAP: [RegExp, ProjectCategory][] = [
  // Data Collection
  [/centaurus/i, 'Data Collection'],
  [/humus/i, 'Data Collection'],
  [/hummus/i, 'Data Collection'],
  [/fur.?frame/i, 'Data Collection'],
  [/andromeda/i, 'Data Collection'],
  [/nighthawk/i, 'Data Collection'],
  [/cochera/i, 'Data Collection'],
  [/casas/i, 'Data Collection'],
  [/moonbrush/i, 'Data Collection'],
  [/jellyfish/i, 'Data Collection'],

  // Language Services
  [/fred/i, 'Language Services'],
  [/onyx/i, 'Language Services'],
  [/ocr/i, 'Language Services'],
  [/translation/i, 'Language Services'],
  [/transcri/i, 'Language Services'],
  [/voice.?assistant/i, 'Language Services'],
  [/acceptability/i, 'Language Services'],

  // Evaluation
  [/milky.?way/i, 'Evaluation'],
  [/maps/i, 'Evaluation'],
  [/lighthouse/i, 'Evaluation'],
  [/vega/i, 'Evaluation'],
  [/cosmos/i, 'Evaluation'],
  [/amber/i, 'Evaluation'],
  [/orbit/i, 'Evaluation'],

  // Onsite Study
  [/lumina/i, 'Onsite Study'],
];

/**
 * Get the project category for a campaign name.
 */
export function getCampaignCategory(campaignName: string): ProjectCategory {
  if (!campaignName) return 'General';
  for (const [pattern, category] of CAMPAIGN_MAP) {
    if (pattern.test(campaignName)) return category;
  }
  return 'General';
}

/**
 * Categorize an array of items by campaign name.
 */
export function categorizeItems<T extends { campaign_name?: string; campaign?: string }>(
  items: T[],
): (T & { project_category: ProjectCategory })[] {
  return items.map(item => ({
    ...item,
    project_category: getCampaignCategory(item.campaign_name || item.campaign || ''),
  }));
}

/**
 * Group items by category and aggregate numeric fields.
 */
export function groupByCategory<T extends Record<string, any>>(
  items: T[],
  campaignField: keyof T = 'campaign_name' as keyof T,
  numericFields: string[] = ['impressions', 'clicks', 'spend', 'conversions'],
): { category: ProjectCategory; info: ProjectCategoryInfo; count: number; totals: Record<string, number> }[] {
  const groups = new Map<ProjectCategory, { count: number; totals: Record<string, number> }>();

  for (const item of items) {
    const cat = getCampaignCategory(String(item[campaignField] || ''));
    const existing = groups.get(cat) || { count: 0, totals: {} };
    existing.count++;
    for (const field of numericFields) {
      existing.totals[field] = (existing.totals[field] || 0) + (Number(item[field]) || 0);
    }
    groups.set(cat, existing);
  }

  return Array.from(groups.entries())
    .map(([cat, data]) => ({ category: cat, info: PROJECT_CATEGORIES[cat], ...data }))
    .sort((a, b) => (b.totals.conversions || 0) - (a.totals.conversions || 0));
}
