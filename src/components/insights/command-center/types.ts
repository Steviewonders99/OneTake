// src/components/insights/command-center/types.ts
import type { Project, ProjectChannelLink, ProjectWeeklySummary } from '@/lib/types/projects';

export const BRAND = {
  gradDeep: 'linear-gradient(135deg, #0348B2 0%, #7C3AED 50%, #DB2777 100%)',
  gradCool: 'linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)',
  gradWarm: 'linear-gradient(135deg, #DB2777 0%, #9333EA 100%)',
  grad: 'linear-gradient(135deg, #DB2777 0%, #7C3AED 40%, #2563EB 100%)',
  pink: '#DB2777',
  purple: '#7C3AED',
  blue: '#2563EB',
  deepBlue: '#0348B2',
  rose: '#E11D48',
  amber: '#D97706',
  text: '#111827',
  text2: '#4B5563',
  text3: '#9CA3AF',
  bg: '#FFFFFF',
  bgRaised: '#F6F7FB',
  border: 'rgba(0,0,0,0.08)',
} as const;

export const CHANNEL_COLORS: Record<string, string> = {
  meta_paid: '#2563EB', linkedin_organic: '#7C3AED', linkedin_paid: '#7C3AED',
  recruiter: '#DB2777', indeed: '#9333EA', glassdoor: '#9333EA',
  brevo_email: '#6366F1', flyer: '#A855F7', qr_poster: '#A855F7',
  reddit_paid: '#818CF8', organic_search: '#C084FC', google_paid: '#4F46E5',
  tiktok_paid: '#7E22CE', linkedin_jobs: '#6D28D9', influencer: '#BE185D',
  referral: '#9333EA', direct: '#A1A1AA', monster: '#8B5CF6',
  organic: '#818CF8', social_referral: '#A78BFA', job_board: '#C084FC', email: '#F472B6',
};

export const CHANNEL_DISPLAY: Record<string, string> = {
  meta_paid: 'Meta Ads', linkedin_organic: 'LinkedIn', linkedin_paid: 'LinkedIn Ads',
  recruiter: 'Recruiter', indeed: 'Indeed', glassdoor: 'Glassdoor',
  brevo_email: 'Brevo Email', flyer: 'Flyers + QR', qr_poster: 'QR Posters',
  reddit_paid: 'Reddit Ads', organic_search: 'Organic Search', google_paid: 'Google Ads',
  tiktok_paid: 'TikTok Ads', linkedin_jobs: 'LinkedIn Jobs', influencer: 'Influencer',
  referral: 'Referral', direct: 'Direct', monster: 'Monster',
  organic: 'Organic', social_referral: 'Social Referral', job_board: 'Job Boards', email: 'Email',
};

export const PILL_CLASSES: Record<string, string> = {
  meta_paid: 'bg-[#EDE9FE] text-[#6D28D9]', linkedin_organic: 'bg-[#EDE9FE] text-[#4C1D95]',
  linkedin_paid: 'bg-[#EDE9FE] text-[#4C1D95]', recruiter: 'bg-[#E0E7FF] text-[#3730A3]',
  indeed: 'bg-[#FEF3C7] text-[#92400E]', glassdoor: 'bg-[#FEF3C7] text-[#92400E]',
  brevo_email: 'bg-[#FCE7F3] text-[#9D174D]', flyer: 'bg-[#F5F3FF] text-[#5B21B6]',
  reddit_paid: 'bg-[#FEE2E2] text-[#991B1B]', organic_search: 'bg-[#DBEAFE] text-[#1E3A8A]',
  google_paid: 'bg-[#DBEAFE] text-[#1E40AF]', tiktok_paid: 'bg-[#F5F3FF] text-[#7E22CE]',
  linkedin_jobs: 'bg-[#EDE9FE] text-[#4C1D95]', influencer: 'bg-[#FDF2F8] text-[#BE185D]',
};

export const TOP_CHANNELS = ['meta_paid', 'linkedin_organic', 'recruiter'];

export interface ProjectWithFunnel extends Project {
  weekly?: ProjectWeeklySummary[];
  channels?: ProjectChannelLink[];
  wow?: WoWDeltas | null;
  action?: 'increase' | 'hold' | 'fix' | 'boost';
}

export interface WoWDeltas {
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  conversions: number | null;
  cpa_direction: 'up' | 'down' | null;
}

export interface ChartWeek {
  week: string;
  [channelSlug: string]: number | string;
}

export type DateRangePreset = 7 | 14 | 30 | 90 | 'all';

export interface DateRangeValue {
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD
  preset?: DateRangePreset;
  compare?: { start: string; end: string } | null;
}

/** @deprecated Use DateRangeValue instead */
export type DateRange = 7 | 14 | 30 | 90;
