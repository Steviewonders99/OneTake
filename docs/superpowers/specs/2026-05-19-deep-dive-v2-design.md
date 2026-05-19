# Deep Dive V2 — The Most Important Dashboard in the Company

**Date:** 2026-05-19
**Author:** Steven Junop
**Status:** Approved
**Target:** Thursday May 22 L1 demo
**Route:** `/insights/(dashboard)/deep-dive` (replace existing)

---

## 7 Sections

### 1. Channel Acquisition
- Horizontal bars: traffic by channel (Meta Paid 94%, LinkedIn 3.8%, Job Boards 1.7%, Email 0.7%)
- UTM attribution table: source/medium → WP Entry → NDA → Workers
- Data: GA4 `firstUserSource` + `firstUserMedium` scoped to project's `firstUserCampaignName`

### 2. Funnel Waterfall (enhanced)
- Existing FunnelWaterfall component
- Add: stage-over-stage conversion rates between bars
- Add: click stage → expand by-source breakdown
- Add: biggest drop-off callout badge

### 3. Source Attribution (per-channel funnel comparison)
- Table: each channel's full funnel side-by-side
- Columns: Channel (with icon), Entry, Apply, NDA, Workers, Entry→NDA rate, Cost, Cost/Worker
- Insight callout: "LinkedIn organic has 9.9% CVR vs Meta Paid 7.7% — and costs €0"
- Data: `ga4_project_funnel.by_source`

### 4. Locale Performance
- Country tabs (click to filter entire dashboard)
- Table: locale, WP Entry, Apply, NDA, Workers, CVR, Status (ACTIVE/TOP/UNDERPERFORM)
- TOP = highest CVR, UNDERPERFORM = 0% CVR
- Data: `project_locale_links` + GA4 per-requestId queries (future)
- v1: show locales with status based on available data

### 5. Campaign & Creative (2-column)
- Left: CampaignTable (already built) — SCALE/HOLD/KILL verdicts
- Right: CreativeGallery (already built) — per-region creative cards
- Data: `meta_ads_cache` via channel links

### 6. Weekly Trends (Recharts)
- Dual-axis line chart: spend (bars) + CPA (line) over weeks
- Toggle tabs: Spend+CPA | Conversions | Funnel Rates
- Data: `project_weekly_summary` materialized view

### 7. AI Intelligence Brief
- Project-specific narrative with color-coded insights
- Action badges: INCREASE/PAUSE/POST MORE/OPTIMIZE
- Template-based v1, NIM-powered v2
- Data: aggregated from all sections above

## Components to Create/Modify

| Action | File |
|---|---|
| Rewrite | `src/components/insights/deep-dive/DeepDiveClient.tsx` |
| Create | `src/components/insights/deep-dive/ChannelAcquisition.tsx` |
| Create | `src/components/insights/deep-dive/SourceAttribution.tsx` |
| Create | `src/components/insights/deep-dive/WeeklyTrends.tsx` |
| Create | `src/components/insights/deep-dive/ProjectBrief.tsx` |
| Reuse | `FunnelWaterfall.tsx`, `CountrySelector.tsx`, `LocaleTable.tsx`, `PaidMetrics.tsx` |
| Reuse from channel-intel | `CampaignTable.tsx`, `CreativeGallery.tsx` |

## Master Selector Rule
The shared ProjectSearch combobox controls ALL 7 sections. No independent project changes.
