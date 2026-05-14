/**
 * Widget Registry — 30 widgets / 6 categories.
 * Ported from VYRA, adapted for recruitment pipeline + UTM tracking.
 */

import { lazy, type ComponentType } from 'react';
import {
  BarChart3, Activity, Clock, Image, MousePointerClick, Cpu, Timer,
  Globe, AlertTriangle, ListChecks, StickyNote, GitCompare, Trophy,
  Palette, TrendingUp, Grid3x3, Link2, Funnel, Award, TrendingDown,
  Crosshair, Target, Radar, HeartPulse, Search, Megaphone,
  Share2, Rss, ArrowUpRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WidgetType, WidgetCategory } from './types';

export interface WidgetRegistryEntry {
  component: ComponentType<{ config: Record<string, unknown> }>;
  category: WidgetCategory;
  label: string;
  icon: LucideIcon;
  description: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
}

export const WIDGET_CATEGORIES: { id: WidgetCategory; label: string }[] = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'utm', label: 'UTM & Link Analytics' },
  { id: 'assets', label: 'Assets & Creative' },
  { id: 'operations', label: 'Operations' },
  { id: 'audienceiq', label: 'AudienceIQ' },
  { id: 'organic', label: 'Organic Social' },
  { id: 'paid', label: 'Paid Media' },
  { id: 'utility', label: 'Utility' },
];

export const WIDGET_REGISTRY: Record<WidgetType, WidgetRegistryEntry> = {
  'kpi-cards': {
    component: lazy(() => import('./widgets/KpiCardsWidget')),
    category: 'pipeline', label: 'KPI Cards', icon: BarChart3,
    description: 'Total campaigns, approved, generating, sent to agency',
    defaultSize: { w: 12, h: 2 }, minSize: { w: 6, h: 2 },
  },
  'pipeline-overview': {
    component: lazy(() => import('./widgets/PipelineOverviewWidget')),
    category: 'pipeline', label: 'Pipeline Status', icon: Activity,
    description: 'Campaign distribution by pipeline stage',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'campaign-timeline': {
    component: lazy(() => import('./widgets/CampaignTimelineWidget')),
    category: 'pipeline', label: 'Campaign Timeline', icon: Clock,
    description: 'Recent campaigns with status and progress',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
  'urgency-breakdown': {
    component: lazy(() => import('./widgets/UrgencyWidget')),
    category: 'pipeline', label: 'Urgency Breakdown', icon: AlertTriangle,
    description: 'Urgent vs standard vs pipeline distribution',
    defaultSize: { w: 4, h: 3 }, minSize: { w: 3, h: 2 },
  },
  'recent-activity': {
    component: lazy(() => import('./widgets/RecentActivityWidget')),
    category: 'pipeline', label: 'Recent Activity', icon: ListChecks,
    description: 'Latest campaign updates and pipeline events',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
  'click-analytics': {
    component: lazy(() => import('./widgets/ClickAnalyticsWidget')),
    category: 'utm', label: 'Click Overview', icon: MousePointerClick,
    description: 'Total clicks, links, and recruiter count',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'utm-funnel': {
    component: lazy(() => import('./widgets/UtmFunnelWidget')),
    category: 'utm', label: 'UTM Breakdown', icon: GitCompare,
    description: 'Clicks by source, medium, and campaign — full UTM drill-down',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'recruiter-leaderboard': {
    component: lazy(() => import('./widgets/RecruiterLeaderboardWidget')),
    category: 'utm', label: 'Recruiter Leaderboard', icon: Trophy,
    description: 'Ranked recruiters by clicks, links, and active campaigns',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'campaign-roi': {
    component: lazy(() => import('./widgets/CampaignRoiWidget')),
    category: 'utm', label: 'Campaign Link ROI', icon: TrendingUp,
    description: 'Per-campaign links created and total click performance',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
  'source-heatmap': {
    component: lazy(() => import('./widgets/SourceHeatmapWidget')),
    category: 'utm', label: 'Source x Medium Heatmap', icon: Grid3x3,
    description: 'Heatmap grid of clicks by UTM source and medium',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 3 },
  },
  'link-builder': {
    component: lazy(() => import('./widgets/LinkBuilderWidget')),
    category: 'utm', label: 'Quick Link Builder', icon: Link2,
    description: 'Create UTM tracked links without leaving the dashboard',
    defaultSize: { w: 6, h: 3 }, minSize: { w: 4, h: 3 },
  },
  'asset-gallery': {
    component: lazy(() => import('./widgets/AssetGalleryWidget')),
    category: 'assets', label: 'Asset Summary', icon: Image,
    description: 'Generated assets by type and platform with pass rates',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'creative-performance': {
    component: lazy(() => import('./widgets/CreativePerformanceWidget')),
    category: 'assets', label: 'Creative Performance', icon: Palette,
    description: 'Which creatives drive the most clicks? Asset-to-click correlation',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
  'worker-health': {
    component: lazy(() => import('./widgets/WorkerHealthWidget')),
    category: 'operations', label: 'Worker Health', icon: Cpu,
    description: 'Compute job status and average processing time',
    defaultSize: { w: 6, h: 3 }, minSize: { w: 4, h: 2 },
  },
  'pipeline-performance': {
    component: lazy(() => import('./widgets/PipelinePerformanceWidget')),
    category: 'operations', label: 'Pipeline Performance', icon: Timer,
    description: 'Stage durations and success/failure rates',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
  'region-map': {
    component: lazy(() => import('./widgets/RegionMapWidget')),
    category: 'operations', label: 'Region Distribution', icon: Globe,
    description: 'Campaign target regions breakdown',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  // ── AudienceIQ ────────────────────────────────────────────
  'contributor-funnel': {
    component: lazy(() => import('./widgets/ContributorFunnelWidget')),
    category: 'audienceiq', label: 'Contributor Funnel', icon: Funnel,
    description: 'Clicks → signups → active → quality threshold conversion funnel',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
  'quality-by-channel': {
    component: lazy(() => import('./widgets/QualityByChannelWidget')),
    category: 'audienceiq', label: 'Quality by Channel', icon: Award,
    description: 'Average contributor quality score per UTM source',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'retention-curve': {
    component: lazy(() => import('./widgets/RetentionCurveWidget')),
    category: 'audienceiq', label: 'Retention Curve', icon: TrendingDown,
    description: 'Contributor retention by campaign over 30/60/90 days',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'skill-distribution': {
    component: lazy(() => import('./widgets/SkillDistributionWidget')),
    category: 'audienceiq', label: 'Skill Distribution', icon: Crosshair,
    description: 'Declared skills vs actual CRM contributor skills — divergence chart',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'targeting-vs-reality': {
    component: lazy(() => import('./widgets/TargetingVsRealityWidget')),
    category: 'audienceiq', label: 'Targeting vs Reality', icon: Target,
    description: 'Side-by-side: declared ICP regions/languages/skills vs CRM actuals',
    defaultSize: { w: 12, h: 5 }, minSize: { w: 6, h: 4 },
  },
  'drift-radar': {
    component: lazy(() => import('./widgets/DriftRadarWidget')),
    category: 'audienceiq', label: 'Drift Radar', icon: Radar,
    description: 'Four-ring audience drift visualization with severity indicators',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 },
  },
  'audience-health': {
    component: lazy(() => import('./widgets/AudienceHealthWidget')),
    category: 'audienceiq', label: 'Audience Health', icon: HeartPulse,
    description: 'Health score gauge (0-100) with actionable issue detection',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 },
  },
  'ga4-traffic': {
    component: lazy(() => import('./widgets/Ga4TrafficWidget')),
    category: 'audienceiq', label: 'GA4 Traffic', icon: BarChart3,
    description: 'Sessions, traffic sources, and device breakdown from Google Analytics',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'gsc-queries': {
    component: lazy(() => import('./widgets/GscQueriesWidget')),
    category: 'audienceiq', label: 'Search Queries', icon: Search,
    description: 'Top search queries driving traffic from Google Search Console',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  // ── HIE Behavioral ────────────────────────────────────────
  'hie-heatmap': {
    component: lazy(() => import('./widgets/HieHeatmapWidget')),
    category: 'audienceiq', label: 'HIE Heatmap', icon: MousePointerClick,
    description: 'Click density grid for tracked landing pages',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 },
  },
  'hie-scrollmap': {
    component: lazy(() => import('./widgets/HieScrollmapWidget')),
    category: 'audienceiq', label: 'HIE Scrollmap', icon: ListChecks,
    description: 'Scroll depth distribution with milestone annotations',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'hie-form-friction': {
    component: lazy(() => import('./widgets/HieFormFrictionWidget')),
    category: 'audienceiq', label: 'HIE Diagnostics', icon: AlertTriangle,
    description: 'CRO diagnostics — scroll cliffs, CTA weakness, form friction',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
  'platform-audiences': {
    component: lazy(() => import('./widgets/PlatformAudiencesWidget')),
    category: 'audienceiq', label: 'Platform Audiences', icon: Megaphone,
    description: 'Multi-platform ad audience overview — Google, Meta, LinkedIn, TikTok',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
  // ── Creative Gallery ──────────────────────────────────────
  'creative-gallery': {
    component: lazy(() => import('./widgets/CreativeGalleryWidget')),
    category: 'paid', label: 'Creative Gallery', icon: Image,
    description: "Ad creative images with performance metrics — see what's actually working",
    defaultSize: { w: 12, h: 8 }, minSize: { w: 6, h: 5 },
  },
  'category-breakdown': {
    component: lazy(() => import('./widgets/CategoryBreakdownWidget')),
    category: 'paid', label: 'Project Categories', icon: BarChart3,
    description: 'Performance by project type: Data Collection, Language, Evaluation, Onsite',
    defaultSize: { w: 12, h: 6 }, minSize: { w: 6, h: 4 },
  },
  'recruitment-attribution': {
    component: lazy(() => import('./widgets/RecruitmentAttributionWidget')),
    category: 'paid', label: 'Recruitment Attribution', icon: Funnel,
    description: 'Form completions by traffic source + city with W1 vs W2 and CPA trends',
    defaultSize: { w: 12, h: 8 }, minSize: { w: 6, h: 5 },
  },
  // ── Funnel (split widgets) ────────────────────────────────────
  'funnel-visualization': {
    component: lazy(() => import('./widgets/FunnelVisualizationWidget')),
    category: 'paid', label: 'Visual Funnel', icon: Funnel,
    description: 'Tapered funnel: sessions → sign-ups → completions with drop-off rates and CVR summary.',
    defaultSize: { w: 6, h: 8 }, minSize: { w: 4, h: 5 },
  },
  'channel-attribution': {
    component: lazy(() => import('./widgets/ChannelAttributionWidget')),
    category: 'paid', label: 'Channel Attribution', icon: BarChart3,
    description: 'Sessions, sign-ups, completions and CVR broken down by traffic source and medium.',
    defaultSize: { w: 6, h: 6 }, minSize: { w: 4, h: 4 },
  },
  'top-campaign-spend': {
    component: lazy(() => import('./widgets/TopCampaignSpendWidget')),
    category: 'paid', label: 'Top Campaigns', icon: ListChecks,
    description: 'Top 10 campaigns ranked by ad spend with impressions and clicks. Sortable.',
    defaultSize: { w: 6, h: 6 }, minSize: { w: 4, h: 4 },
  },
  // ── Campaign Funnel (legacy — keep for existing dashboards) ───
  'campaign-funnel': {
    component: lazy(() => import('./widgets/CampaignFunnelWidget')),
    category: 'paid', label: 'Campaign Funnel', icon: Funnel,
    description: 'Full funnel: ad spend → sessions → sign-ups → completions. Cross-channel, per campaign.',
    defaultSize: { w: 12, h: 8 }, minSize: { w: 6, h: 5 },
  },
  'organic-kpi': {
    component: lazy(() => import('./widgets/OrganicKpiWidget')),
    category: 'organic', label: 'Organic KPIs', icon: Rss,
    description: 'Impressions, reach, engagement, follower delta across all social platforms',
    defaultSize: { w: 12, h: 2 }, minSize: { w: 6, h: 2 },
  },
  'organic-platform-compare': {
    component: lazy(() => import('./widgets/OrganicPlatformCompareWidget')),
    category: 'organic', label: 'Platform Comparison', icon: BarChart3,
    description: 'Engagement by platform over time — Facebook, Instagram, LinkedIn, Reddit',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'organic-attribution': {
    component: lazy(() => import('./widgets/OrganicAttributionWidget')),
    category: 'organic', label: 'Pipeline vs Manual', icon: GitCompare,
    description: 'Compare AI-generated vs manually posted content performance',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'organic-account-growth': {
    component: lazy(() => import('./widgets/OrganicAccountGrowthWidget')),
    category: 'organic', label: 'Account Growth', icon: ArrowUpRight,
    description: 'Follower count trends per platform over time',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'organic-top-posts': {
    component: lazy(() => import('./widgets/OrganicTopPostsWidget')),
    category: 'organic', label: 'Top Posts', icon: Share2,
    description: 'Ranked list of posts by engagement with pipeline/manual attribution',
    defaultSize: { w: 12, h: 5 }, minSize: { w: 6, h: 3 },
  },
  'gsc-performance': {
    component: lazy(() => import('./widgets/GscPerformanceWidget')),
    category: 'organic', label: 'GSC Performance', icon: Search,
    description: 'Google Search Console queries, pages, and ranking trends',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 3 },
  },
  // ── Paid Media ────────────────────────────────────────────
  'paid-kpi': {
    component: lazy(() => import('./widgets/PaidKpiWidget')),
    category: 'paid', label: 'Paid KPIs', icon: Megaphone,
    description: 'Spend, impressions, clicks, conversions, CPA, CTR across all paid platforms',
    defaultSize: { w: 12, h: 2 }, minSize: { w: 6, h: 2 },
  },
  'paid-platform-compare': {
    component: lazy(() => import('./widgets/PaidPlatformCompareWidget')),
    category: 'paid', label: 'Paid Platform Comparison', icon: BarChart3,
    description: 'Spend by platform over time — Meta, Reddit, LinkedIn, Google, TikTok',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'paid-campaign-detail': {
    component: lazy(() => import('./widgets/PaidCampaignDetailWidget')),
    category: 'paid', label: 'Campaign Detail', icon: ListChecks,
    description: 'Campaign-level spend, impressions, clicks, conversions, CPA breakdown',
    defaultSize: { w: 12, h: 5 }, minSize: { w: 6, h: 3 },
  },
  'text-note': {
    component: lazy(() => import('./widgets/TextNoteWidget')),
    category: 'utility', label: 'Text Note', icon: StickyNote,
    description: 'Add custom text or notes',
    defaultSize: { w: 6, h: 3 }, minSize: { w: 3, h: 2 },
  },
};
