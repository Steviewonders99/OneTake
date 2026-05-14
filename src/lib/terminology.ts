/**
 * OneForma Terminology — single source of truth for business labels.
 *
 * Maps GA4 event names and generic analytics terms to OneForma-specific language.
 * All widgets read from here. Update this file when business terminology changes.
 */

/**
 * Funnel stage labels — maps GA4 event names to OneForma business terms.
 */
export const FUNNEL_STAGE_LABELS: Record<string, string> = {
  'AdToHomepageView': 'Ad → Homepage',
  'session_start': 'Sessions',
  'Job Card List': 'Browsed Jobs',
  'Job Details Page': 'Viewed Job',
  'apply_click': 'Applied',
  'UserEnterLoginPage': 'Login Page',
  'Onboarding': 'Onboarding',
  'sign_up': 'Project Signup',
  'generate_lead': 'Lead Generated',
  'begin_checkout': 'Started Task',
  'purchase': 'AidaForm Completion',
  'survey_complete': 'Survey Complete',
};

/**
 * Metric display labels — consistent across all widgets.
 */
export const METRIC_LABELS = {
  // Conversions
  signups: 'Project Signups',
  signups_short: 'Signups',
  completions: 'AidaForm Completions',
  completions_short: 'Completions',
  purchases: 'AidaForm Completions',

  // Rates
  cvr_click_signup: 'CVR Click → Signup',
  cvr_click_completion: 'CVR Click → Completion',
  cvr_signup_completion: 'CVR Signup → Completion',

  // Spend
  cpa_signup: 'CPA Signup',
  cpa_completion: 'CPA Completion',
  total_spend: 'Ad Spend',

  // Traffic
  sessions: 'Sessions',
  impressions: 'Impressions',
  clicks: 'Clicks',
} as const;

/**
 * Column header labels for tables.
 */
export const TABLE_HEADERS = {
  signups: 'Signups',
  completions: 'Completions',
  done: 'Completions',
  share: '% Share',
  cvr: 'CVR',
  sessions: 'Sessions',
  source: 'Source',
  spend: 'Spend',
  cpa: 'CPA',
} as const;
