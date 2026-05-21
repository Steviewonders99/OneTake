# Channel Intelligence v2 — Design Spec

> **Status:** Implemented May 21, 2026. All infrastructure built. Some channels pending credential setup.

**Goal:** Single dashboard where you pick a channel and see everything — GA4 traffic, platform-native engagement, campaign performance, and project breakdowns — all filtered by project, country, and date range.

**Architecture:** Channel selector drives adaptive layout. Paid channels use NDM + Meta Ads API. Organic channels use GA4 first-touch attribution + platform APIs (Meta Graph, LinkedIn, Reddit). GSC pipeline built but awaiting auth.

---

## Data Flow

```
Channel Selector (20+ channels)
  ├── Paid path (meta_paid, google_paid, reddit)
  │   ├── NDM per project → Campaign Table (spend/imp/clicks/conv/CPA/verdict)
  │   ├── Meta Ads API cache → Adset-level drill-down
  │   └── GA4 project_country_performance → Country filter
  │
  └── Organic path (all others)
      ├── GA4 funnel per project → Source Breakdown + Project Breakdown
      ├── Meta Graph API → Post Performance Grid (IG: 212 posts, FB: 197 posts)
      ├── GSC API → Keywords Panel + Landing Pages (pending auth)
      ├── GA4 landing pages → Top Landing Pages (195 rows synced)
      └── LinkedIn/Reddit APIs → Post tables (pending credentials)
```

## Source Matching

Each channel slug maps to a precise GA4 source/medium matcher:

| Slug | Matches | Excludes |
|---|---|---|
| `google_organic` | source=google, medium=organic\|(none) | — |
| `meta_organic_fb` | facebook/fb/meta source | paid/cpc/paidsocial/paidmedia mediums |
| `meta_organic_ig` | instagram/l.instagram.com, or ig non-paid | paid mediums |
| `linkedin_organic` | linkedin/social source, non-paid/non-jobboard | job_board, paid mediums |
| `chatgpt` | source contains chatgpt | — |
| `indeed` / `handshake` | source contains name | — |

`PAID_MEDIUMS` exclusion list: `cpc, paid, paidsocial, paidmedia, paid_media, paid_meida` (typo in GA4 data)

## Proxy Endpoints

| Endpoint | Source Table | Data |
|---|---|---|
| `GET /meta/organic-posts?platform=` | `meta_organic_cache` | Posts + engagement + summary |
| `GET /meta/ads?level=campaign\|adset` | `meta_ads_cache` | Campaign/adset metrics + CPA/CTR |
| `GET /ga4/landing-pages?source=` | `ga4_organic_landing_pages` | Page path + sessions + conversions |
| `GET /gsc/keywords?start=&end=` | `gsc_daily_cache` | Query + clicks + impressions + CTR + position |
| `GET /gsc/pages?start=&end=` | `gsc_daily_cache` | Page + clicks + impressions |

## Adaptive Panels by Channel Type

| Channel Type | Panels Shown |
|---|---|
| **SEO** (google_organic) | GSC Keywords + Landing Pages (side-by-side), Source Breakdown, Project Breakdown |
| **Social Organic** (fb, linkedin, twitter, youtube) | Post Performance Grid, Source Breakdown, Project Breakdown |
| **Social IG** (instagram) | Post Performance Grid (IG-specific), Source Breakdown, Project Breakdown |
| **AI Referral** (chatgpt, gemini) | Source Breakdown, Project Breakdown |
| **Paid** (meta_paid, google_paid, reddit) | Campaign Table + Adset drill-down, Creative Gallery, Project Breakdown |
| **Job Board** (indeed, handshake, glassdoor) | Source Breakdown, Project Breakdown |

## Database Tables

| Table | Rows | Sync Method |
|---|---|---|
| `meta_organic_cache` | 409 | Meta Graph API via `meta_organic.py` |
| `meta_ads_cache` | 2,887 | Meta Marketing API via `meta-ads.ts` |
| `ga4_organic_landing_pages` | 195 | GA4 Data API via `sync_organic_landing_pages.py` |
| `gsc_daily_cache` | 0 | GSC API via `gsc_client.py` (auth blocked) |
| `linkedin_organic_cache` | 0 | LinkedIn API via `linkedin_organic.py` (no creds) |
| `reddit_organic_cache` | 0 | Reddit API via `reddit_organic.py` (env escaping) |

## Filters (All Verified Working)

- **Date Range:** 7d/14d/30d/90d/All — NDM date-filtered, GA4 date-filtered via ga4_organic_weekly
- **Project:** Single project → fetches only that project's data
- **Country:** Narrows project list via `project_country_performance` GA4 data

## Credential Gaps

1. **GSC:** Service account `onedata-mcp@project-a45aec68-9dbf-4c65-bcd.iam.gserviceaccount.com` needs to be added to Search Console. GCP org policy blocks new key creation — need admin to export existing key.
2. **LinkedIn:** Need `LI_ORG_ID` (OneForma company URN) and `LI_TOKEN` (OAuth with r_organization_social scope)
3. **Reddit:** `REDDIT_CLIENT_SECRET` and `REDDIT_PASSWORD` in worker/.env have shell escaping issues
4. **Facebook Engagement:** 197 posts in meta_organic_cache but all engagement metrics = 0. Page token may need refresh.

## Cron Pipeline

GSC sync added as Step 5 in `cron_sync_all.py`:
1. Seed WP projects
2. Sync locale links
3. Sync GA4 funnel
4. Link intakes
5. **Sync GSC** (new — skips if no credentials)
6. Refresh materialized view

Landing pages sync (`sync_organic_landing_pages.py`) runs independently.

## Files Modified/Created

- `src/components/insights/channel-intel/ChannelIntelClient.tsx` — Full rewrite with real data pipeline
- `src/components/insights/channel-intel/GSCKeywordsPanel.tsx` — Added "Connect GSC" empty state
- `src/components/insights/channel-intel/LandingPagesPanel.tsx` — Updated subtitle
- `worker/db_proxy.py` — 5 new endpoints (meta organic, meta ads, GA4 landing pages, GSC keywords, GSC pages)
- `worker/platforms/gsc_client.py` — Added ADC fallback auth
- `worker/scripts/cron_sync_all.py` — Added GSC sync step
- `worker/scripts/sync_organic_landing_pages.py` — New GA4 landing pages sync
- `src/app/api/meta/organic-posts/route.ts` — New
- `src/app/api/meta/ads/route.ts` — New
- `src/app/api/ga4/landing-pages/route.ts` — New
- `src/app/api/gsc/keywords/route.ts` — New
- `src/app/api/gsc/pages/route.ts` — New
