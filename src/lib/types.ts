// ============================================================
// FIELD DEFINITION TYPES (Schema-driven forms)
// ============================================================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'button_group'
  | 'checkbox_group'
  | 'toggle'
  | 'toggle_with_text'
  | 'tags'
  | 'file'
  | 'range'
  | 'date'
  | 'divider'
  | 'heading';

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface ShowWhenCondition {
  field: string;
  equals?: unknown;
  contains?: string;
  not_equals?: unknown;
  greater_than?: number;
  is_truthy?: boolean;
}

export interface FieldValidation {
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
  pattern?: string;
  custom_message?: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  default_value?: unknown;
  options?: FieldOption[];
  options_source?: string;
  show_when?: ShowWhenCondition;
  validation?: FieldValidation;
  width?: 'full' | 'half';
  group?: string;
  toggle_label?: string;
  text_placeholder?: string;
  // ─── AI pre-fill metadata (Phase A — 2026-04-08) ───
  ai_help?: string;
  prefill_guidance?: string;
  rows?: number;
}

export interface TaskTypeSchema {
  id: string;
  task_type: string;
  display_name: string;
  icon: string;
  description: string;
  schema: {
    base_fields: FieldDefinition[];
    task_fields: FieldDefinition[];
    conditional_fields: FieldDefinition[];
    common_fields: FieldDefinition[];
  };
  version: number;
  is_active: boolean;
  sort_order: number;
}

export interface OptionRegistryItem {
  id: string;
  registry_name: string;
  option_value: string;
  option_label: string;
  metadata?: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
}

// ============================================================
// INTAKE REQUEST TYPES
// ============================================================

export type Status = 'draft' | 'generating' | 'review' | 'approved' | 'sent' | 'rejected';
export type Urgency = 'urgent' | 'standard' | 'pipeline';

export interface IntakeRequest {
  id: string;
  title: string;
  task_type: string;
  urgency: Urgency;
  target_languages: string[];
  target_regions: string[];
  volume_needed: number | null;
  status: Status;
  created_by: string;
  form_data: Record<string, unknown>;
  campaign_slug: string | null;
  schema_version: number;
  created_at: string;
  updated_at: string;
  // ─── Job Requirements (Phase A — 2026-04-08) ──────────────────
  qualifications_required: string | null;
  qualifications_preferred: string | null;
  location_scope: string | null;
  language_requirements: string | null;
  engagement_model: string | null;
  technical_requirements: string | null;
  context_notes: string | null;
}

// ============================================================
// ATTACHMENT TYPES
// ============================================================

export interface Attachment {
  id: string;
  request_id: string;
  file_name: string;
  file_type: string;
  blob_url: string;
  extracted_text: string | null;
  extraction_data: Record<string, unknown> | null;
  is_rfp: boolean;
  created_at: string;
}

// ─── Derived Requirements (Stage 1 brief output) ─────────────────
// Phase A of intake schema refactor (2026-04-08)

export type BrandPillar = "earn" | "grow" | "shape";

export interface DerivedRequirements {
  credential_summary: string;
  pillar_weighting: {
    primary: BrandPillar;
    secondary: BrandPillar;
    reasoning: string;
  };
  visual_direction: {
    work_environment: string;
    wardrobe: string;
    visible_tools: string[];
    emotional_tone: string;
    cultural_adaptations: string;
  };
  persona_constraints: {
    minimum_credentials: string;
    acceptable_tiers: string[];
    age_range_hint: string;
    excluded_archetypes: string[];
  };
  narrative_angle: string;
}

// ============================================================
// CREATIVE BRIEF TYPES
// ============================================================

export interface CreativeBrief {
  id: string;
  request_id: string;
  brief_data: Record<string, unknown>;
  channel_research: Record<string, unknown> | null;
  design_direction: Record<string, unknown> | null;
  content_languages: string[];
  evaluation_score: number | null;
  evaluation_data: Record<string, unknown> | null;
  version: number;
  created_at: string;
  pillar_primary: BrandPillar | null;
  pillar_secondary: BrandPillar | null;
  derived_requirements: DerivedRequirements | null;
}

// ============================================================
// ACTOR PROFILE TYPES
// ============================================================

export interface ActorProfile {
  id: string;
  request_id: string;
  name: string;
  face_lock: Record<string, unknown>;
  prompt_seed: string;
  outfit_variations: Record<string, unknown> | null;
  signature_accessory: string | null;
  backdrops: string[];
  country: string | null;
  created_at: string;
}

// ============================================================
// GENERATED ASSET TYPES
// ============================================================

export type AssetType = 'base_image' | 'composed_creative' | 'carousel_panel' | 'landing_page' | 'organic_carousel' | 'copy' | 'video';

export interface GeneratedAsset {
  id: string;
  request_id: string;
  actor_id: string | null;
  asset_type: AssetType;
  platform: string;
  format: string;
  language: string;
  country: string | null;
  content: Record<string, unknown> | null;
  copy_data: Record<string, unknown> | null;
  blob_url: string | null;
  evaluation_score: number | null;
  evaluation_data: Record<string, unknown> | null;
  evaluation_passed: boolean;
  stage: number;
  version: number;
  created_at: string;
}

// ============================================================
// APPROVAL TYPES
// ============================================================

export type ApprovalStatus = 'approved' | 'changes_requested' | 'rejected';

export interface Approval {
  id: string;
  request_id: string;
  approved_by: string;
  status: ApprovalStatus;
  notes: string | null;
  created_at: string;
}

// ============================================================
// CAMPAIGN LANDING PAGES
// ============================================================

export interface CampaignLandingPages {
  id: string;
  request_id: string;
  job_posting_url: string | null;
  landing_page_url: string | null;
  ada_form_url: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LandingPageField = 'job_posting_url' | 'landing_page_url' | 'ada_form_url';

// ============================================================
// MAGIC LINK TYPES
// ============================================================

export interface MagicLink {
  id: string;
  request_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// ============================================================
// NOTIFICATION TYPES
// ============================================================

export type NotificationChannel = 'slack' | 'outlook' | 'teams';
export type NotificationStatus = 'sent' | 'delivered' | 'failed';

export interface Notification {
  id: string;
  request_id: string;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationStatus;
  payload: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================
// PIPELINE RUN TYPES
// ============================================================

export type PipelineStageStatus = 'running' | 'passed' | 'failed' | 'retrying';

export interface PipelineRun {
  id: string;
  request_id: string;
  stage: number;
  stage_name: string;
  status: PipelineStageStatus;
  attempt: number;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  evaluation_data: Record<string, unknown> | null;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

// ============================================================
// RFP EXTRACTION TYPES
// ============================================================

export interface ExtractionResult {
  detected_task_type: string;
  base_fields: Record<string, unknown>;
  task_fields: Record<string, unknown>;
  confidence_flags: {
    fields_confidently_extracted: string[];
    fields_inferred: string[];
    fields_missing: string[];
    notes: string;
  };
  extracted_details?: {
    client_name?: string;
    project_deadline?: string;
    quality_requirements?: string;
    training_required?: string;
    equipment_needed?: string;
    data_sensitivity?: string;
  };
}

// ============================================================
// VYRA API TYPES
// ============================================================

export interface VyraGenerateRequest {
  platform: string;
  campaign_name: string;
  product: string;
  target_audience: string;
  goals: string;
  cta_text?: string;
  hero_image_url?: string;
  headline?: string;
  num_variants?: number;
  client_dna?: Record<string, unknown>;
}

export interface VyraGenerateResponse {
  success: boolean;
  variants: Array<{
    image_url: string;
    html: string;
    headline: string;
    cta_text: string;
    template: string;
    platform: string;
    evaluation_score: number;
    evaluation_passed: boolean;
  }>;
  seedream_image_url: string;
  errors: string[];
}

export interface VyraCarouselRequest {
  platform: string;
  panels: Array<{
    panel_type: string;
    headline: string;
    subheadline?: string;
    cta_text?: string;
    proof_badge?: string;
  }>;
  seedream_image_url: string;
}

// ============================================================
// FORM VALIDATION TYPES
// ============================================================

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

// ============================================================
// COMPUTE JOB TYPES
// ============================================================

export type ComputeJobType = 'generate' | 'generate_country' | 'regenerate' | 'regenerate_stage' | 'regenerate_asset';
export type ComputeJobStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface ComputeJob {
  id: string;
  request_id: string;
  job_type: ComputeJobType;
  status: ComputeJobStatus;
  country: string | null;
  stage_target: number | null;
  asset_id: string | null;
  feedback: string | null;
  feedback_data: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ============================================================
// USER ROLE TYPES
// ============================================================

export type UserRole = 'admin' | 'recruiter' | 'designer' | 'viewer';

export interface UserRoleRecord {
  id: string;
  clerk_id: string;
  email: string;
  name: string | null;
  role: UserRole;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Tracked Links ────────────────────────────────────────────────────────────

export interface TrackedLink {
  id: string;
  slug: string;
  request_id: string;
  asset_id: string | null;
  recruiter_clerk_id: string;
  destination_url: string;
  base_url: string;
  utm_campaign: string;
  utm_source: string;
  utm_medium: string;
  utm_term: string;
  utm_content: string;
  click_count: number;
  last_clicked_at: string | null;
  created_at: string;
}

export interface TrackedLinkWithAsset extends TrackedLink {
  short_url: string;
  asset_thumbnail: string | null;
  asset_platform: string | null;
}

export interface TrackedLinksSummary {
  total_clicks: number;
  total_links: number;
  best_channel: { name: string; clicks: number; pct: number } | null;
  top_creative: { name: string; clicks: number; asset_id: string | null } | null;
  clicks_today: number;
  recruiter_count: number;
  channel_count: number;
}

export interface TrackedLinksResponse {
  links: TrackedLinkWithAsset[];
  summary: TrackedLinksSummary;
}

export interface DemographicQuota {
  category: string;
  value: string;
  percentage: number;
  volume: number;
}

export interface CountryQuota {
  country: string;
  locale: string;
  total_volume: number;
  rate: number;
  currency: string;
  url?: string;
  demographics: DemographicQuota[];
}
