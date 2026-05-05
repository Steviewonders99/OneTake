/**
 * Classify a recruiter's edit instruction into an action type.
 * Uses keyword/pattern matching — no LLM needed for routing.
 */

export type EditActionType = 'copy_update' | 'link_update' | 'locale_add' | 'targeted_edit';

export interface ClassificationResult {
  action_type: EditActionType;
  detected_url?: string;
  confidence: 'high' | 'medium';
}

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/i;

const LOCALE_KEYWORDS = [
  'new country', 'new countries', 'add country', 'add countries',
  'new locale', 'new locales', 'add locale', 'add locales',
  'new region', 'new regions', 'add region', 'add regions',
];

export function classifyEdit(
  instruction: string,
  assetCount: number,
  hasExcel: boolean,
): ClassificationResult {
  const lower = instruction.toLowerCase();

  // Excel attachment → locale_add (mandatory signal)
  if (hasExcel) {
    return { action_type: 'locale_add', confidence: 'high' };
  }

  // Locale keywords without Excel → still locale_add but will fail validation
  if (LOCALE_KEYWORDS.some(kw => lower.includes(kw))) {
    return { action_type: 'locale_add', confidence: 'high' };
  }

  // URL pattern → link_update
  const urlMatch = instruction.match(URL_PATTERN);
  if (urlMatch) {
    return {
      action_type: 'link_update',
      detected_url: urlMatch[0],
      confidence: 'high',
    };
  }

  // Small selection (1-3 assets) with specific replacement text → targeted_edit
  if (assetCount > 0 && assetCount <= 3) {
    const hasReplacement = /change .+ to |replace .+ with |update .+ to |set .+ to /i.test(instruction);
    if (hasReplacement) {
      return { action_type: 'targeted_edit', confidence: 'high' };
    }
  }

  // Default: copy_update (most common case)
  return { action_type: 'copy_update', confidence: 'medium' };
}
