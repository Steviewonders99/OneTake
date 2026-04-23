/**
 * Widget Registry — 17 widgets across 5 categories.
 * Ported from VYRA, adapted for recruitment pipeline + UTM tracking.
 */

import { lazy, type ComponentType } from 'react';
import {
  BarChart3, Activity, Clock, Image, MousePointerClick, Cpu, Timer,
  Globe, AlertTriangle, ListChecks, StickyNote, GitCompare, Trophy,
  Palette, TrendingUp, Grid3x3, Link2,
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
  'text-note': {
    component: lazy(() => import('./widgets/TextNoteWidget')),
    category: 'utility', label: 'Text Note', icon: StickyNote,
    description: 'Add custom text or notes',
    defaultSize: { w: 6, h: 3 }, minSize: { w: 3, h: 2 },
  },
};
