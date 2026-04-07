/**
 * UTM source/content options for the recruiter link builder.
 *
 * - utm_source is one of 5 broad categories
 * - utm_content is a specific platform/placement, scoped to a source
 * - utm_medium is always "referral" (locked, not in this file — handled in LinkBuilderBar)
 *
 * This file is the single source of truth — both client (LinkBuilderBar dropdown
 * options) and server (POST /api/tracked-links allowlist validation) import from here.
 */

export type UtmSource = 'job_board' | 'social' | 'email' | 'internal' | 'influencer';

export interface SourceOption {
  value: UtmSource;
  label: string;
}

export const SOURCE_OPTIONS: readonly SourceOption[] = [
  { value: 'job_board', label: 'Job Board' },
  { value: 'social', label: 'Social' },
  { value: 'email', label: 'Email' },
  { value: 'internal', label: 'Internal' },
  { value: 'influencer', label: 'Influencer' },
] as const;

export interface ContentOption {
  value: string;
  label: string;
  source: UtmSource;
}

export const CONTENT_OPTIONS: readonly ContentOption[] = [
  // ─── job_board ─────────────────────────────────────────────────────────
  { value: 'glassdoor', label: 'Glassdoor', source: 'job_board' },
  { value: 'zip_recruiter', label: 'ZipRecruiter', source: 'job_board' },
  { value: 'monster', label: 'Monster', source: 'job_board' },
  { value: 'simply_hired', label: 'SimplyHired', source: 'job_board' },
  { value: 'career_builder', label: 'CareerBuilder', source: 'job_board' },
  { value: 'indeed', label: 'Indeed', source: 'job_board' },
  { value: 'craigslist', label: 'Craigslist', source: 'job_board' },
  { value: 'upwork', label: 'Upwork', source: 'job_board' },
  { value: 'freelance', label: 'Freelance.com', source: 'job_board' },
  { value: 'fiverr', label: 'Fiverr', source: 'job_board' },
  { value: 'jooble', label: 'Jooble', source: 'job_board' },
  { value: 'jobiblo', label: 'Jobiblo', source: 'job_board' },
  { value: 'dreamcareerbuilder', label: 'DreamCareerBuilder', source: 'job_board' },
  { value: 'expatriates_com', label: 'Expatriates.com', source: 'job_board' },
  { value: '9cv9', label: '9cv9', source: 'job_board' },
  { value: 'jobspider', label: 'JobSpider', source: 'job_board' },
  { value: 'nationale_vacaturebank', label: 'Nationale Vacaturebank', source: 'job_board' },
  { value: 'infojobs', label: 'InfoJobs', source: 'job_board' },
  { value: 'handshake', label: 'Handshake', source: 'job_board' },

  // ─── social ────────────────────────────────────────────────────────────
  { value: 'linkedin_inmail', label: 'LinkedIn InMail', source: 'social' },
  { value: 'linkedin_post', label: 'LinkedIn Post', source: 'social' },
  { value: 'linkedin_export', label: 'LinkedIn Export', source: 'social' },
  { value: 'facebook', label: 'Facebook', source: 'social' },
  { value: 'instagram', label: 'Instagram', source: 'social' },
  { value: 'tiktok', label: 'TikTok', source: 'social' },
  { value: 'reddit', label: 'Reddit', source: 'social' },
  { value: 'nextdoor', label: 'Nextdoor', source: 'social' },
  { value: 'discord', label: 'Discord', source: 'social' },
  { value: 'juicebox', label: 'Juicebox', source: 'social' },

  // ─── email ─────────────────────────────────────────────────────────────
  { value: 'college', label: 'College', source: 'email' },
  { value: 'community_center', label: 'Community Center', source: 'email' },
  { value: 'social_aid_program', label: 'Social Aid Program', source: 'email' },
  { value: 'non_profit', label: 'Non-Profit', source: 'email' },
  { value: 'support_group', label: 'Support Group', source: 'email' },
  { value: 'talent_agency', label: 'Talent Agency', source: 'email' },
  { value: 'public_library', label: 'Public Library', source: 'email' },
  { value: 'restaurant', label: 'Restaurant', source: 'email' },
  { value: 'recreation', label: 'Recreation', source: 'email' },
  { value: 'religious_organization', label: 'Religious Organization', source: 'email' },
  { value: 'shopping_center', label: 'Shopping Center', source: 'email' },
  { value: 'vocational_services', label: 'Vocational Services', source: 'email' },
  { value: 'senior_services', label: 'Senior Services', source: 'email' },
  { value: 'pet_care_services', label: 'Pet Care Services', source: 'email' },
  { value: 'financial_assistance', label: 'Financial Assistance', source: 'email' },
  { value: 'healthcare', label: 'Healthcare', source: 'email' },
  { value: 'childcare_family_services', label: 'Childcare & Family Services', source: 'email' },
  { value: 'immigration_services', label: 'Immigration Services', source: 'email' },
  { value: 'lgbtq_services', label: 'LGBTQ Services', source: 'email' },
  { value: 'veterans_services', label: 'Veterans Services', source: 'email' },

  // ─── internal ──────────────────────────────────────────────────────────
  { value: 'employee_referral', label: 'Employee Referral', source: 'internal' },
  { value: 'internal_database', label: 'Internal Database', source: 'internal' },
  { value: 'indeed_inmail', label: 'Indeed InMail', source: 'internal' },

  // ─── influencer ────────────────────────────────────────────────────────
  { value: 'indeed_post', label: 'Indeed Post', source: 'influencer' },
  { value: 'seek_inmail', label: 'Seek InMail', source: 'influencer' },
  { value: 'computrabajo_mx', label: 'Computrabajo MX', source: 'influencer' },
  { value: 'eu_languages_jobs_inmail', label: 'EU Languages Jobs InMail', source: 'influencer' },
  { value: 'facebook_outreach', label: 'Facebook Outreach', source: 'influencer' },
  { value: 'gigexchange', label: 'GigExchange', source: 'influencer' },
  { value: '404works', label: '404works', source: 'influencer' },
  { value: 'hubstaff', label: 'Hubstaff', source: 'influencer' },
  { value: 'mustakbil', label: 'Mustakbil', source: 'influencer' },
  { value: 'profdir', label: 'ProfDir', source: 'influencer' },
] as const;

export const UTM_MEDIUM = 'referral' as const;

/** Get all content options that belong to a given source. */
export function getContentOptionsForSource(source: UtmSource): ContentOption[] {
  return CONTENT_OPTIONS.filter((c) => c.source === source);
}

/** Type guard: is the input a valid UtmSource? */
export function isValidSource(value: unknown): value is UtmSource {
  return typeof value === 'string' && SOURCE_OPTIONS.some((s) => s.value === value);
}

/** Validate that a content slug exists for the given source. */
export function isValidContentForSource(source: UtmSource, content: string): boolean {
  return CONTENT_OPTIONS.some((c) => c.source === source && c.value === content);
}

/**
 * Map a channel tab name (e.g., 'linkedin', 'facebook', 'instagram', 'reddit')
 * to the most natural default content option for the social source.
 * Returns null if no obvious match.
 */
export function getDefaultContentForChannel(channel: string): ContentOption | null {
  const lower = channel.toLowerCase();
  const directMatch = CONTENT_OPTIONS.find((c) => c.value === lower);
  if (directMatch) return directMatch;
  if (lower === 'linkedin') return CONTENT_OPTIONS.find((c) => c.value === 'linkedin_post') ?? null;
  return null;
}
