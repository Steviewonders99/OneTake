# Project Deep Dive Dashboard — Design Spec

**Date:** 2026-05-19
**Author:** Steven Junop
**Status:** Approved
**Target:** L1 Leadership Presentation — Thursday May 22, 2026
**Route:** `/insights/(dashboard)/deep-dive`

---

## Overview

Single-page deep dive for one project at a time. Controlled by a shared searchable project selector (same component as Command Center). Shows the full 9-stage acquisition funnel, source breakdown, paid campaign metrics, locale performance, and weekly trends.

## Components

### 1. Searchable Project Selector (shared with Command Center)

Replaces the dropdown. Combobox with:
- Text input with search icon
- Filters projects by codename or display_name as you type
- Dropdown shows matching results with locale count + channel count
- Selected project controls the entire page
- Shared component: `src/components/insights/command-center/ProjectSearch.tsx`

### 2. Project Header

Dynamic based on selected project:
- Codename (bold) + display name
- Countries, locale count, channel count, active since date
- Date range pills (7d / 14d / 30d / All)

### 3. 9-Stage Funnel Waterfall

Horizontal bar chart showing the full journey:

| Stage | GA4 Path | Description |
|---|---|---|
| WP Entry | `/jobs/{slug}` | First exposure |
| Signup | `/center/signup` | Account created |
| MFA Setup | `/center/mfa/setup` | Security verified |
| Profile Created | `/crowd/profile-setup` | 7 steps deep |
| NDA Signed | `/crowd/nda` | Legal commitment |
| Certification | `/crowd/cert*` | Project certification |
| Applied | `/webapp/dataCollection/signup` | Locale-specific apply (cross-domain) |
| Viewing Jobs | `/crowd/jobs/{id}` | On the platform browsing work |
| Doing Tasks | `/crowd/task` | Actually working |

Each bar:
- Width proportional to % of WP Entry
- Gradient color (deep blue → purple → pink as funnel narrows)
- Number label inside bar
- Percentage label to the right
- Drop-off callout badges for major drops (>50%)

### 4. Source Breakdown Panel

Left card: NDA signers by source (bar chart or list with colored dots)
- facebook / paid: 1,525 (93.7%)
- social / referral: 79 (4.9%)
- job_board / referral: 22 (1.4%)
- email / referral: 2 (0.1%)

### 5. Paid Campaign Metrics Panel

Right card with 6 KPI boxes:
- Total Spend, CPA (per NDA), Impressions, Clicks, CTR, Cost per Active Worker

### 6. Locale Performance Table

Table showing per-language data:
- Language, platform requestId, status (active/removed)
- Expandable to show all locales

### 7. Weekly Trend Chart

Recharts line chart showing WoW progression of key metrics for this project:
- Conversions, spend, CPA over time

## Data Sources

All via proxy (`DB_PROXY_URL`):
- `GET /projects/:id` — project info
- `GET /projects/:id/ga4-funnel` — 9-stage funnel with source breakdown
- `GET /projects/:id/funnel?view=weekly` — weekly trends
- `GET /projects/:id/channels` — channel links
- `GET /projects/:id/locales` — locale links with requestIds

## File Map

| Action | File |
|---|---|
| Create | `src/components/insights/command-center/ProjectSearch.tsx` |
| Create | `src/components/insights/deep-dive/DeepDiveClient.tsx` |
| Create | `src/components/insights/deep-dive/FunnelWaterfall.tsx` |
| Create | `src/components/insights/deep-dive/SourceBreakdown.tsx` |
| Create | `src/components/insights/deep-dive/PaidMetrics.tsx` |
| Create | `src/components/insights/deep-dive/LocaleTable.tsx` |
| Create | `src/app/insights/(dashboard)/deep-dive/page.tsx` |
| Modify | `src/components/insights/dashboard-meta.ts` |
