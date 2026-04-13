# Organic Carousel Content — Design Spec

**Date:** 2026-04-13
**Author:** Steven Junop + Claude
**Status:** Approved

## Overview

Generate 12 organic carousels per campaign (3 personas × 2 platforms × 2 variations) using the existing carousel engine with guardrails. Captions are written in recruiter voice (first person, "we're hiring..."). Displayed in a clean platform-tabbed UI with authentic LinkedIn/IG post preview mockups. No persona data exposed to recruiters — just ready-to-post content.

## Guardrails

| Constraint | Value |
|---|---|
| Platforms | LinkedIn + Instagram only (for now) |
| Carousels per persona per platform | 2 (variety enforced via different hook angles) |
| Total per campaign | 12 (3 personas × 2 platforms × 2 variations) |
| Asset type | `organic_carousel` (new, separate from paid `carousel_panel`) |
| Distribution | Organic only — carousels are NOT used for paid media |

## Carousel Generation

### Reuse Existing Engine

The carousel engine (`worker/pipeline/stage4_carousel.py`, 506 lines) already handles LinkedIn and IG with platform-specific structures:

- **LinkedIn:** 1080×1080, 6-8 slides, text-first authority format
- **Instagram:** 1080×1350 (4:5), 5-7 slides, visual story with actor cutouts

### Variety Between Variations

Each persona gets 2 carousels per platform. Variety is enforced by using different Stage 3 copy pillars:

| Variation | Hook Source | Angle |
|---|---|---|
| Carousel 1 | Primary pillar copy | Lead benefit / opportunity framing |
| Carousel 2 | Secondary pillar copy | Social proof / impact framing |

This ensures the two carousels per persona per platform feel distinct, not duplicated.

## Caption Copy — Recruiter Voice

### Tone

This is NOT the OneForma brand account posting. This is a **recruiter** (Maria, Ahmed, etc.) sharing a job opportunity on their personal LinkedIn/IG. The voice is:

- First person: "We're looking for...", "I'm hiring..."
- Peer-to-peer: talking to potential candidates as equals
- Casual-professional: warm but credible
- Action-oriented: "tag someone", "DM me", "link in bio"

### Platform Formats

**LinkedIn caption:**
- 3-5 sentences, professional storytelling
- Open with the hook (who we're looking for)
- Mention key details: remote/onsite, compensation, flexibility
- Close with "tag someone" or "DM me" CTA
- No hashtags (LinkedIn algorithm penalizes them in 2026)
- Include "link in comments 👇" (NOT link in post body)

**Instagram caption:**
- 2-3 punchy lines with emoji
- Key details: role, pay, work mode
- "Swipe for details →" on carousel posts
- "Link in bio ✨" CTA
- 5-8 relevant hashtags at the end
- No walls of text

### Generation

- Gemma 4 31B generates captions
- Input: Stage 3 copy (headline, body, CTA) + job requirements (compensation, quals, work mode)
- Output: platform-specific caption text
- Hard facts (compensation, qualifications) injected — never rewritten by LLM

## Recruiter UI — Organic Tab

### Tab Structure

New "Organic" tab in `RecruiterWorkspace`, alongside existing tabs. Uses channel sub-tabs for future scalability:

```
Organic Tab
├── LinkedIn tab     (6 carousels — 3 personas × 2 variations)
├── Instagram tab    (6 carousels — 3 personas × 2 variations)
├── Job Boards tab   (future — grayed out)
├── Email tab        (future — grayed out)
└── Flyers tab       (future — grayed out)
```

### Carousel Preview Card (Platform-Authentic)

Each carousel displayed as a realistic platform post mockup:

**LinkedIn preview card:**
- LinkedIn blue header with real LinkedIn logo
- Recruiter profile row: avatar placeholder + name + "Recruiter at OneForma · Just now"
- Caption text (full, as it would appear on LinkedIn)
- Carousel slide preview: first slide visible, swipeable (or dot indicators)
- Action bar: 👍 Like · 💬 Comment · 🔁 Repost · 📩 Send
- **"Copy Caption"** button (copies caption text to clipboard)
- **"Download Slides"** button (downloads all slides as ZIP)

**Instagram preview card:**
- IG-style header with real Instagram logo
- Profile row: gradient ring avatar + handle + "OneForma"
- Carousel slide in 4:5 aspect ratio
- Dot indicators for slide count
- Action row: ❤️ 💬 📤 🔖
- Caption with bold handle prefix
- **"Copy Caption"** button
- **"Download Slides"** button

### No Persona Data

The recruiter sees:
- Platform tab (LinkedIn / Instagram)
- Grid of carousel preview cards (3 per row)
- Each card has slides + caption + action buttons

The recruiter does NOT see:
- Persona names or archetype labels
- Psychology profiles or targeting data
- Variation numbers or pillar labels
- Any pipeline/stage terminology

### Default State

- LinkedIn tab active by default
- 6 cards in a 3×2 grid
- No expand/collapse needed — 6 cards is manageable
- Switch to Instagram tab → same 3×2 grid

## Database

### New Asset Type

```sql
ALTER TABLE generated_assets
DROP CONSTRAINT IF EXISTS generated_assets_asset_type_check;

ALTER TABLE generated_assets
ADD CONSTRAINT generated_assets_asset_type_check
CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel', 'landing_page', 'organic_carousel'));
```

### Content JSONB Structure

```json
{
  "persona_key": "gig_worker_flex",
  "platform": "linkedin_carousel",
  "variation": 1,
  "distribution": "organic",
  "caption": "We're looking for native Finnish speakers...",
  "slide_count": 6,
  "slide_urls": ["blob://slide1.png", "blob://slide2.png", ...],
  "hook_angle": "primary_pillar",
  "language": "English"
}
```

### Querying

```sql
-- Get organic carousels for recruiter view
SELECT * FROM generated_assets
WHERE request_id = $1
  AND asset_type = 'organic_carousel'
  AND evaluation_passed = true
ORDER BY content->>'platform', content->>'variation';
```

## Pipeline Integration

### Where It Runs

After Stage 4 composition (which generates the paid creatives). The organic carousel step:

1. Loads existing Stage 3 copy + Stage 2 actor images
2. Calls the existing carousel engine with platform configs (LinkedIn + IG only)
3. Caps at 2 per persona per platform
4. Generates recruiter-voice captions via Gemma 4
5. Saves as `organic_carousel` asset type

### NOT a Separate Stage

This runs as part of Stage 4, not a new stage. The carousel engine is already called from the orchestrator — we just add organic generation after the existing carousel step.

## New Files

| File | Purpose | Lines (est.) |
|---|---|---|
| `worker/prompts/organic_caption_copy.py` | Gemma 4 recruiter-voice caption prompt (LinkedIn + IG formats) | ~100 |
| `worker/pipeline/stage4_organic_carousel.py` | Orchestrator: enforce 12-cap, variety via pillars, generate captions, save assets | ~200 |
| `src/components/recruiter/OrganicTab.tsx` | Platform-tabbed UI with authentic preview cards | ~300 |
| `src/components/recruiter/CarouselPreviewCard.tsx` | Single carousel mockup (LinkedIn or IG frame) with copy/download buttons | ~200 |

### Modified Files

| File | Changes |
|---|---|
| `worker/pipeline/orchestrator.py` | Call organic carousel generation after existing Stage 4 carousel step |
| `src/lib/db/schema.ts` | Add `'organic_carousel'` to asset_type CHECK |
| `src/components/recruiter/RecruiterWorkspace.tsx` | Add Organic tab |

## Designer View — Organic vs Paid Separation

### Priority: Organic First

Organic content has higher precedence than paid — it's seen directly by real people on feeds, not filtered through an ad platform. A bad organic carousel reflects directly on the recruiter who posted it.

### Designer Dashboard — Distribution Split

The workboard splits into two priority sections. Organic always appears FIRST:

```
Designer Dashboard
├── Organic (higher priority — pink accent bar)
│   ├── Needs Attention (3)
│   ├── In Progress (1)
│   └── Completed (2)
│
└── Paid (standard priority — charcoal accent bar)
    ├── Needs Attention (5)
    ├── In Progress (2)
    └── Completed (8)
```

- Organic section: pink left-border accent (`#E84BA5`)
- Paid section: charcoal left-border accent (`#32373C`)
- Organic campaigns always sort above paid in each status group
- Work items show a distribution badge: `ORGANIC` (pink pill) or `PAID` (charcoal pill)

### Designer Gallery — Top-Level Tabs

```
Designer Gallery
├── [Organic] tab (default when organic assets exist)
│   ├── Persona tabs (context cards, psychology)
│   ├── LinkedIn carousel versions
│   └── IG carousel versions
│
└── [Paid] tab
    ├── Persona tabs
    ├── Version accordions V1-V5
    └── Format cards per platform
```

- Top-level `Organic` | `Paid` tabs above the persona tabs
- When organic assets exist, `Organic` tab is active by default (higher priority)
- Same edit tools available: Quick Edit (Flux 2), Graphic Editor, Regenerate
- Same lightbox, design notes, VQA scores

### Figma Export — Page Separation

```
Figma File
├── Page: Organic
│   ├── Frame: LinkedIn Carousels
│   │   ├── Nova_{Persona}_V1_linkedin_carousel_1080x1080
│   │   └── Nova_{Persona}_V2_linkedin_carousel_1080x1080
│   └── Frame: IG Carousels
│       ├── Nova_{Persona}_V1_ig_carousel_1080x1350
│       └── Nova_{Persona}_V2_ig_carousel_1080x1350
│
└── Page: Paid
    ├── Frame: Meta
    ├── Frame: LinkedIn
    └── Frame: TikTok
```

- Separate Figma pages for organic vs paid
- Frame naming includes platform and distribution context
- Each carousel's slides grouped in a single frame

### Figma Push — Distribution-Aware

The 3-level push adds a distribution dimension:

| Push Option | What Gets Pushed |
|---|---|
| Push All Organic | All organic carousel slides → Organic page |
| Push All Paid | All composed creatives → Paid page |
| Push by Persona | Both organic + paid for one persona |
| Push Single Version | One specific carousel or creative |

### New/Modified Files (Designer)

| File | Changes |
|---|---|
| `src/components/designer/dashboard/DesignerDashboard.tsx` | Split work items by distribution (organic first), add accent bars |
| `src/components/designer/dashboard/WorkItemRow.tsx` | Add ORGANIC/PAID badge pill |
| `src/components/designer/gallery/DesignerGallery.tsx` | Add top-level Organic/Paid tabs |
| `src/components/designer/figma/FigmaExportButton.tsx` | Separate exports by distribution → Figma pages |
| `src/components/designer/figma/PushToFigmaButton.tsx` | Add "Push All Organic" / "Push All Paid" options |

## Future Channels (Not in v1)

The tab system is designed to scale. Future additions follow the same pattern:

| Channel | Content Type | Asset Type |
|---|---|---|
| Job Boards | Formatted job post + banner image | `job_board_post` |
| Email | HTML email template + subject line | `email_template` |
| Flyers | Print-ready A4 PDF | `flyer` |
| Posters | Print-ready A3 PDF | `poster` |
| TikTok | Vertical carousel (9:16) | `organic_carousel` (platform = tiktok) |

Each gets a tab in the Organic view, same card-based UI, same copy/download pattern.

## Out of Scope (v1)

- TikTok carousels (existing engine supports it, but not in organic v1)
- Flyers, posters, email templates
- Direct posting to LinkedIn/IG (copy + manual post for now)
- A/B testing between carousel variations
- Recruiter avatar customization (uses placeholder)
- Carousel slide editing in the UI
