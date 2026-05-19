# Channel Intelligence Dashboard — Design Spec

**Date:** 2026-05-19
**Author:** Steven Junop
**Status:** Approved
**Target:** Post-Thursday iteration (foundation can ship Thursday)
**Route:** `/insights/(dashboard)/channel-intel`

---

## Overview

Dashboard 3 flips the axis — start from the CHANNEL, drill into projects + countries. Answers "How is THIS channel performing across all projects?" vs. Dashboards 1+2 which start from projects.

## Three Dashboards — Complete System

| Dashboard | Route | Primary Axis | Question |
|---|---|---|---|
| Command Center | `/command-center` | All projects × all channels | "How's the portfolio?" |
| Deep Dive | `/deep-dive` | One project × all channels | "How's THIS project?" |
| **Channel Intel** | `/channel-intel` | **One channel × all projects** | **"How's THIS channel?"** |

## Critical UX Rule

**The master project selector controls ALL views.** No widget, table, creative gallery, or UTM link panel may independently change which project is displayed. The shared `ProjectSearch` combobox is the single source of truth. All child components receive `projectId` as a prop.

## Three-Layer Filter

1. **Channel** (primary, purple border) — searchable combobox with hierarchical groups
2. **Project** (secondary) — shared `ProjectSearch` combobox, controls everything
3. **Country** (tertiary) — dropdown from `project_locale_links`
4. **Date range** — 7d / 30d / 90d / All pills

## Channel Hierarchy

### Parent Groups (in channel selector dropdown)
| Parent | Children |
|---|---|
| Meta | Facebook Organic, Instagram Organic, Meta Paid (FB+IG) |
| LinkedIn | LinkedIn Organic, LinkedIn Jobs |
| Google | Google Organic (SEO + GSC), Google Ads |
| AI Referral | ChatGPT, Gemini |
| Job Boards | Indeed, Handshake, Glassdoor, Monster |
| Other | Twitter/X, YouTube, Reddit, Brevo Email |

### Independent Channels (separate section)
| Channel | Special View |
|---|---|
| Recruiter Direct | Per-recruiter UTM performance table |
| Physical Flyers | QR-tracked link performance |
| QR Posters | Same |
| Telegram | Community sharing metrics |

## Adaptive Content Per Channel Type

### Google Organic (SEO + GSC)
- Hero: sessions, conversions, CVR, landing pages count, €0 cost
- **GSC Keywords table**: query, clicks, impressions, CTR, position
- **Landing Pages table**: page (normalized via `normalize_page_path()`), sessions, conversions, CVR
- **Project Breakdown**: which `/jobs/*` pages get organic traffic

### LinkedIn Organic
- Hero: sessions, conversions, CVR, posts (from LinkedIn API when available)
- **Top campaigns by sessions** (utm_campaign = Milkyway_LI, Nexa, etc.)
- **Landing page performance** (normalized names)
- **Project breakdown**: which projects get LinkedIn traffic

### Instagram Organic
- Hero: 616 sessions, 24 conversions, 112 posts
- **Post performance grid**: cards with engagement, likes, comments, GA4 sessions, KILL/FIX/KEEP
- **Content type breakdown**: Job Alert / KYC / Holiday / Story with % and verdict
- **GA4 cross-reference**: match `post_url` → GA4 `l.instagram.com` referral

### ChatGPT / Gemini (AI Referral)
- Hero: 67K sessions, 26.5K conversions, 39% CVR, €0
- **Landing pages LLMs send traffic to** (normalized)
- **Conversion funnel from AI referral**

### Meta Paid / Google Ads / Reddit Paid
- Hero: spend, impressions, clicks, conversions, CPA
- **Campaign table**: campaign name, spend, clicks, conv, CPA, SCALE/HOLD/KILL verdict
- **Creative Gallery per region**: region tabs (adsets = regions), creative cards with image + CPA
- **Top performer highlighted**

### Recruiter Direct
- Hero: total recruiter-driven sessions, signups, NDAs
- **Recruiter performance table**: recruiter ID, source (linkedin_inmail/handshake/flyer), platform, WP visits, apply clicks, signups, NDA, CVR
- **Filters**: project + recruiter + source
- **Data source**: GA4 `firstUserManualTerm` + `firstUserManualAdContent`

## Page Path Normalization

All landing page displays use `normalize_page_path()`:
- Lookup table first (37 entries, custom overrides)
- Pattern matching: `/join/*` → "LP:", `/jobs/*` → "Job Page:", etc.
- Proxy endpoint: `POST /pages/normalize`

## Data Sources

| Source | Endpoints | What It Provides |
|---|---|---|
| GA4 Analytics MCP | `run_report` | Sessions, users, conversions by source/medium/campaign/pagePath/country |
| GSC | `gsc_daily_cache` | Keywords, pages, impressions, clicks, CTR, position |
| Meta Organic API | `meta_organic_cache` | Post-level engagement (210 posts) |
| Meta Ads API | `meta_ads_cache` | Campaign/ad-level spend, clicks, conversions (2,887 rows) |
| Reddit Ads | `reddit_ads_cache` | Campaign-level metrics |
| Page Normalizer | `normalize_page_path()` | Human-readable page names |
| Channel Definitions | `channel_definitions` | 20 channels with category for grouping |

## File Map

| Action | File |
|---|---|
| Create | `src/components/insights/channel-intel/ChannelIntelClient.tsx` |
| Create | `src/components/insights/channel-intel/ChannelSearch.tsx` |
| Create | `src/components/insights/channel-intel/ChannelHeroMetrics.tsx` |
| Create | `src/components/insights/channel-intel/GSCKeywordsPanel.tsx` |
| Create | `src/components/insights/channel-intel/LandingPagesPanel.tsx` |
| Create | `src/components/insights/channel-intel/PostPerformanceGrid.tsx` |
| Create | `src/components/insights/channel-intel/CampaignTable.tsx` |
| Create | `src/components/insights/channel-intel/CreativeGallery.tsx` |
| Create | `src/components/insights/channel-intel/RecruiterTable.tsx` |
| Create | `src/components/insights/channel-intel/ProjectBreakdown.tsx` |
| Create | `src/app/insights/(dashboard)/channel-intel/page.tsx` |
| Modify | `src/components/insights/dashboard-meta.ts` |
| Modify | `worker/db_proxy.py` — add `/pages/normalize` endpoint (done) |

## Implementation Priority

**Phase 1 (Thursday):** Channel selector + hero metrics + landing pages panel + project breakdown. Works for all channels with GA4 data.

**Phase 2 (post-Thursday):** GSC keywords panel, post performance grid (IG audit), creative gallery per region, recruiter self-service table.

**Phase 3 (when APIs arrive):** LinkedIn Content API post retrieval, YouTube Data API video metrics.
