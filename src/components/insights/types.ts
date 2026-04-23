/**
 * Types for the Insights dashboard builder.
 * Ported from VYRA dashboard builder, adapted for recruitment pipeline + UTM tracking.
 */

export type WidgetType =
  // Pipeline
  | 'kpi-cards'
  | 'pipeline-overview'
  | 'campaign-timeline'
  | 'urgency-breakdown'
  | 'recent-activity'
  // Assets & Creative
  | 'asset-gallery'
  | 'creative-performance'
  // UTM & Analytics
  | 'click-analytics'
  | 'utm-funnel'
  | 'recruiter-leaderboard'
  | 'campaign-roi'
  | 'source-heatmap'
  | 'link-builder'
  // Operations
  | 'worker-health'
  | 'pipeline-performance'
  | 'region-map'
  // AudienceIQ
  | 'contributor-funnel'
  | 'quality-by-channel'
  | 'retention-curve'
  | 'skill-distribution'
  | 'targeting-vs-reality'
  | 'drift-radar'
  | 'audience-health'
  // Utility
  | 'text-note';

export type WidgetCategory =
  | 'pipeline'
  | 'assets'
  | 'utm'
  | 'operations'
  | 'audienceiq'
  | 'utility';

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  title: string;
  config: Record<string, unknown>;
}

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface DashboardLayoutData {
  widgets: WidgetInstance[];
  gridLayouts: {
    lg: GridLayoutItem[];
    md: GridLayoutItem[];
    sm: GridLayoutItem[];
  };
}

export interface Dashboard {
  id: string;
  title: string;
  description: string | null;
  layout_data: DashboardLayoutData;
  created_by: string;
  is_template: boolean;
  is_shared: boolean;
  share_token: string | null;
  password_hash: string | null;
  expires_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
