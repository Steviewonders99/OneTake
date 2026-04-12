# Recruiter View Redesign — Design Spec

**Date:** 2026-04-12
**Author:** Steven Junop + Claude
**Status:** Approved
**Mockup:** `.superpowers/brainstorm/89475-1775994931/content/05-enterprise-v5.html`

## Overview

Redesign the recruiter portal from a functional-but-rough 5-component system into a polished, enterprise-grade experience. The recruiter view is per-campaign — recruiters land here after selecting a campaign from the dashboard.

**Current state:** 5 components (~1,100 lines), 3 tabs (Creatives / Performance / Overview). UTM link builder is a sticky footer bar tied to creative selection. Performance is a separate tab. Aesthetics are "vibe-coded."

**Target state:** Enterprise-grade 2-tab + Overview layout with standalone link builder, collapsible messaging briefing, deep-dive dashboard, and restrained OneForma design system.

## Design System — Enterprise OneForma

### Color Palette (Restrained)

| Token | Value | Usage |
|---|---|---|
| Background | `#FFFFFF` | Cards, panels |
| Page bg | `#F7F7F8` | Page background |
| Text | `#1A1A1A` | Primary text, stat numbers |
| Charcoal | `#32373C` | Buttons, tab underlines, bar chart fills |
| Muted text | `#8A8A8E` | Labels, secondary text |
| Border | `#E8E8EA` | Card borders, dividers |
| Purple (accent) | `#6D28D9` | ONLY: gradient bar, selected states, quote borders, crosslinks |
| Purple soft | `rgba(109,40,217,0.06)` | Selected card outer glow |

**Rule:** Purple is used in exactly 4 places — the 2px gradient bar at page top, selected creative card ring, messaging quote left-border, and "Dashboard →" crosslink text. Everything else is grayscale.

### Typography

- Font stack: `-apple-system, system-ui, "Segoe UI", Roboto, sans-serif`
- Monospace (URLs, slugs): `"SF Mono", "Fira Code", monospace`
- Labels: 10-11px, uppercase, `letter-spacing: 0.5px`, muted text color
- Stat numbers: 32px, `font-weight: 800`, `letter-spacing: -1px`
- Panel titles: 14px, `font-weight: 700`

### Components

- Buttons: `#32373C` charcoal, `border-radius: 9999px` (pill), white text
- Cards: `border-radius: 10px`, `border: 1px solid #E8E8EA`, no shadow by default, `box-shadow: 0 1px 3px rgba(0,0,0,0.06)` on hover
- Inputs: `border-radius: 8px`, `background: #FAFAFA`, `border: 1px solid #E8E8EA`
- Focus state: `border-color: #6D28D9`, `box-shadow: 0 0 0 2px rgba(109,40,217,0.06)`
- Icons: Lucide React only, muted gray by default, charcoal on hover

## Tab Structure

```
[Assets & Creatives]  [Dashboard]  [Overview]
        ↑ active           ↑ new       ↑ existing
```

- **Assets & Creatives** — default tab. Creative library + link builder + messaging accordion
- **Dashboard** — deep-dive analytics for all tracked links (replaces old Performance tab)
- **Overview** — existing `RecruiterOverviewTab` component, unchanged

Tab bar: sticky `top: 0`, white background, charcoal underline on active tab. Lucide icons: `Image` (Assets), `LayoutDashboard` (Dashboard), `FileText` (Overview).

## Page Header

Unchanged structure, visual polish:
- Back arrow (Lucide `ArrowLeft`) → campaign title + slug badge + status badge
- "Download All" charcoal pill button (right side)
- 2px gradient bar at very top of page (`linear-gradient(135deg, #7C3AED, #6D28D9)`)

## Stats Row

4 stat cards in a grid above the two-column layout. No colored icons, no gradient text — pure grayscale.

| Card | Label | Value source | Sub-text |
|---|---|---|---|
| Creatives | "Creatives" | `approvedAssets.length` | "Across N channels" |
| Links Created | "Links Created" | `summary.total_links` | "By N recruiters" |
| Total Clicks | "Total Clicks" | `summary.total_clicks` | "+N today" (delta from midnight) |
| Top Channel | "Top Channel" | `summary.best_channel.name` | "N clicks · N%" |

**Data source:** Stats require a combined fetch — creative count from `assets` prop, link stats from `GET /api/tracked-links?request_id=X`. The "today" delta requires a new field in the tracked-links response (`clicks_today`).

## Section A: Campaign Messaging (Accordion)

### Behavior
- **Collapsed by default** — single row showing "Campaign Messaging & Guidance" with chevron icon
- Click toggles open/closed with chevron rotation animation (`transform: rotate(90deg)`)
- State is local (not persisted) — resets to collapsed on page reload

### Content (when expanded)

5 sections stacked vertically with generous spacing:

1. **Key Message** — `brief.messaging_strategy.primary_message` rendered in a quote block with `border-left: 3px solid #6D28D9`, `background: #F7F7F8`, italic

2. **Tone & Voice + Target Audience** — two-column grid
   - Left: tone chips from `brief.messaging_strategy.tone` (array) as `#F7F7F8` pills with `#E8E8EA` border
   - Right: `brief.messaging_strategy.target_audience` as body text

3. **Value Propositions** — vertical list with Lucide `Check` icons (purple) per item. Source: `brief.messaging_strategy.value_propositions` (array of strings). Full sentences, not abbreviated pills.

4. **Do's and Don'ts** — two-column grid
   - Left column: Lucide `Check` icons (purple), positive guidance
   - Right column: Lucide `X` icons (red `#DC2626`), things to avoid
   - Source: `brief.messaging_strategy.dos` and `brief.messaging_strategy.donts` (arrays). If these fields don't exist in the brief, derive from the creative brief's compliance/guidelines fields, or hide the section.

5. **Channel-Specific Guidance** — 2x2 grid of cards
   - Each card: channel name (bold 12px) + guidance text (12px, #555)
   - Channels: LinkedIn, Facebook, Instagram, Job Boards
   - Source: `brief.messaging_strategy.channel_guidance` (object keyed by channel). If not present, generate sensible defaults based on channel type.

### Data Source

All messaging data comes from the `creative_briefs` table, specifically the `messaging_strategy` JSONB column. The component receives this via the existing `brief` prop.

**New fields needed in `messaging_strategy`:**
- `dos: string[]` — positive guidance for recruiters
- `donts: string[]` — things recruiters should avoid
- `channel_guidance: Record<string, string>` — per-channel posting advice

These fields should be generated by Stage 1 (intelligence) of the pipeline. Until then, the accordion gracefully hides sections with no data.

## Section B: Creative Library (Left Column)

### Channel Pills
- Horizontal pill bar below panel header, `#FAFAFA` background strip
- Active pill: `#32373C` charcoal fill, white text
- Inactive: white fill, `#E8E8EA` border, muted text
- Format: "LinkedIn · 12" (channel name + count)
- Sorted by `CHANNEL_ORDER` (existing logic)

### Creative Grid
- 3-column grid, `gap: 12px`
- Each card:
  - **Thumbnail:** `aspect-ratio: 1` with actual image or gray placeholder showing aspect ratio text (1:1, 4:5, 1.91:1)
  - **Format badge:** bottom-left overlay, dark translucent bg, white text (e.g., "1080 x 1080")
  - **Persona badge:** top-left overlay, white translucent bg, dark text (e.g., "Maria G.")
  - **Selected check:** top-right purple circle with checkmark (only on selected card)
  - **Info area:** headline (12px semibold) + two action buttons
  - **Actions:** "Copy" (copies caption to clipboard) + Download icon button

### Selection Behavior
- Click card → sets `selectedAssetId` → auto-attaches to Link Builder
- Selected card gets: `border-color: #6D28D9`, `box-shadow: 0 0 0 2px rgba(109,40,217,0.06)`
- Hover (non-selected): `translateY(-1px)`, subtle shadow

### Data Flow
- Receives `assets: GeneratedAsset[]` prop (pre-fetched server-side)
- Filters to `evaluation_passed === true && blob_url` exists
- Groups by `platform` (lowercase), filters by active channel pill

## Section C: Link Builder (Right Column — Sticky)

### Position
- `position: sticky; top: 60px` — stays visible while scrolling the creative grid
- Width: ~360px fixed column in the grid

### Panel Structure

**Header:** Link icon (muted gray) + "Link Builder" title + "Tracked links for any channel" subtitle

**Body — Form Fields:**

1. **Attached Creative** (Optional)
   - If a creative is selected: shows thumbnail + headline + "×" remove button
   - If no creative: shows dashed-border empty state "No creative attached"
   - Removing the creative does NOT prevent link generation — it just means `asset_id` is `null` in the tracked link

2. **Source** (dropdown) — 5 options from `SOURCE_OPTIONS`: Social, Job Board, Email, Internal, Influencer

3. **Platform** (dropdown) — filtered by source via `getContentOptionsForSource()`. Searchable for sources with many options (job_board has 19 options)

4. **Your Tag** (text input) — auto-filled with recruiter initials from `/api/auth/me`. Slugified on blur.

5. **Destination** (dropdown) — landing page URLs fetched from `/api/intake/[id]/landing-pages`. Options: Landing Page, Job Posting, ADA Form. Polls every 10s if no URLs available.

**URL Preview Bar:** Dark `#1A1A1A` rounded bar showing `nova-intake.vercel.app/r/Xk9mP2` with green dot indicator.

**Generate & Copy Link Button:** Full-width charcoal button. On click: POST to `/api/tracked-links` → copies short URL to clipboard → toast notification.

**Readiness Gate:** If no landing page URLs exist yet, the entire form is replaced with an amber warning banner (existing behavior, preserved).

### Recent Links Section

Below the form, separated by a border:
- Title: "Recent Links" + "Dashboard →" crosslink (purple text)
- Shows last 3 tracked links created by this recruiter for this campaign
- Each row: thumbnail (or link icon if no creative), monospace short URL, channel + time ago, click count
- Click count: charcoal if >0, light gray if 0

### Smart Defaults
- Source auto-selects based on active channel tab (LinkedIn → Social)
- Platform auto-selects the channel-specific default (LinkedIn → "LinkedIn Post")
- These only change when source is "social" — non-social selections are preserved

### Data Flow
- `requestId`, `campaignSlug`, `activeChannel`, `selectedAsset`, `recruiterInitials` as props
- Fetches landing pages on mount
- POST creates tracked link, returns short URL
- Recent links: new fetch from `GET /api/tracked-links?request_id=X&limit=3&utm_term=SJ` (filter by recruiter's tag, needs new `limit` and `utm_term` query params on the existing endpoint)

## Section D: Dashboard Tab

### Purpose
Deep-dive analytics for campaigns with 90+ tracked links. Replaces the old `PerformanceTab` with a much richer view.

### Stats Row (5 cards)
| Stat | Source |
|---|---|
| Total Links | `summary.total_links` |
| Total Clicks | `summary.total_clicks` |
| Avg Clicks/Link | `total_clicks / total_links` |
| Recruiters | Count distinct `utm_term` values |
| Channels | Count distinct `utm_source` values |

### Clicks by Channel (horizontal bar chart)
- Pure CSS bars — no chart library needed
- Charcoal → progressively lighter gray for lower-ranked channels
- Shows percentage inside bar + absolute count to the right
- Source: aggregate from `links` array grouped by `utm_source`

### Top 5 Performers (leaderboard)
- Ranked list with numbered circles (#1 gets gold background)
- Shows: short URL (mono), channel + recruiter tag + creative name, click count (large bold)
- Source: `links` array sorted by `click_count` desc, take 5

### Full Links Table
- **8 columns:** Short URL, Channel, Platform, Recruiter, Creative, Clicks, Created, Actions
- **Search:** filters across URL, channel, platform, recruiter fields (client-side)
- **Filters button:** dropdown with checkboxes for channel, source, recruiter (future enhancement — can ship as just the search first)
- **Export CSV:** client-side CSV generation from current filtered data, triggers download
- **Pagination:** 20 per page, numbered page buttons
- **Auto-refresh:** every 30s (existing behavior)
- **Actions per row:** Copy short URL button, Open in new tab button

### Data Source
`GET /api/tracked-links?request_id=X` — existing endpoint. Returns `{ links: TrackedLinkWithAsset[], summary: TrackedLinksSummary }`.

**New fields needed in summary response:**
- `clicks_today: number` — clicks since midnight UTC
- `recruiter_count: number` — distinct recruiters
- `channel_count: number` — distinct channels

## Components to Create/Modify

### New Components
| Component | Lines (est.) | Purpose |
|---|---|---|
| `MessagingAccordion.tsx` | ~120 | Collapsible campaign messaging briefing |
| `DashboardTab.tsx` | ~300 | Full analytics dashboard (replaces PerformanceTab) |
| `ChannelBarChart.tsx` | ~60 | CSS-only horizontal bar chart |
| `TopPerformers.tsx` | ~80 | Top 5 leaderboard |
| `LinksTable.tsx` | ~200 | Searchable, paginated links table with export |

### Modified Components
| Component | Changes |
|---|---|
| `RecruiterWorkspace.tsx` | Rename tabs, swap PerformanceTab → DashboardTab, add stats row, add MessagingAccordion |
| `CreativeLibrary.tsx` | Move into left column of 2-col grid, remove `pb-32` bottom padding |
| `CreativeGrid.tsx` | Enterprise card styling, remove purple ring color (use deep purple) |
| `LinkBuilderBar.tsx` | Transform from sticky footer → sticky side panel, add optional creative attachment, add recent links section |

### Deleted Components
| Component | Reason |
|---|---|
| `PerformanceTab.tsx` | Replaced by DashboardTab |

### API Changes
| Endpoint | Change |
|---|---|
| `GET /api/tracked-links` | Add `clicks_today`, `recruiter_count`, `channel_count` to summary response. Add optional `limit` and `recruiter` query params. |

### Pipeline Changes
| Stage | Change |
|---|---|
| Stage 1 (Intelligence) | Add `dos`, `donts`, `channel_guidance` fields to `messaging_strategy` output. |

**Note:** Pipeline changes are additive — the accordion gracefully hides sections when fields are absent, so existing campaigns work without re-running Stage 1.

## Migration Notes

- **No database schema changes** — all new data lives in existing JSONB columns
- **No breaking API changes** — new summary fields are additive
- **PerformanceTab.tsx deletion** — ensure no imports reference it after replacement
- **Existing tracked links** — all work as-is, no migration needed

## File Count Estimate

- ~5 new component files
- ~4 modified component files
- ~1 deleted component file
- ~1 API route modification
- **Total:** ~10 files, ~800-1000 new lines, ~300 removed lines
