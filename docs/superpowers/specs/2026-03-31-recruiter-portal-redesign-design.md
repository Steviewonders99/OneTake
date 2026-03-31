# Recruiter Portal Redesign — Design Spec

## Goal

Transform the recruiter experience from a minimal status-tracking view into a Campaign Briefing Portal where recruiters can track request progress with human-readable statuses and — once approved — access all creatives, messaging themes, and audience personas needed to brief their ad agency.

## Architecture

Two components are redesigned: the **dashboard card grid** (list of campaigns) and the **campaign detail page** (single campaign view). Both reuse existing API endpoints and data — no new database tables or backend routes required.

The recruiter sidebar stays minimal: Dashboard + New Request only.

## Tech Stack

- Existing Next.js components, Tailwind CSS, Lucide icons
- Existing API endpoints: `/api/intake`, `/api/generate/[id]/brief`, `/api/generate/[id]/images`, `/api/generate/[id]/actors`
- No new database tables or migrations
- No new API routes (existing ones return all needed data)

---

## Component 1: Recruiter Dashboard Cards

**File:** `src/components/IntakeCard.tsx` (modify existing) or new `RecruiterIntakeCard.tsx`

### Status Mapping

The existing `Status` type maps to recruiter-friendly labels:

| Technical Status | Recruiter Label | Color | Border Color | Description |
|---|---|---|---|---|
| `draft` | **Submitted** | Gray bg/text | `#a1a1aa` | "Your request has been received" |
| `generating` | **Creating Assets** | Blue bg/text | `#3b82f6` | "Marketing is generating creative options" |
| `review` | **Marketing Review** | Yellow bg/text | `#f59e0b` | "Marketing team is reviewing creatives" |
| `approved` | **Ready for Download** | Green bg/text | `#22c55e` | "Approved! Download your campaign package" |
| `sent` | **Delivered** | Cyan bg/text | `#06b6d4` | "Package sent to ad agency" |
| `rejected` | **Changes Needed** | Red bg/text | `#ef4444` | "Marketing requested changes to your request" |

### Card Layout — Rich Status Cards

Each card shows:
- **Left border** color-coded by status (3px solid, uses border color from table above)
- **Title** — campaign title (full, not truncated)
- **Subtitle** — task type, regions, languages
- **Status badge** — pill with recruiter-friendly label
- **Description line** — human-readable next-step message (from table above)
- **Asset thumbnails** (approved/sent only) — 2-3 small preview squares + "+N" count, right-aligned
- **Asset counts** (approved/sent only) — "14 creatives, 9 images, 3 videos"

### Layout Constraints
- Full viewport width utilization — cards should breathe, not be squished
- Single column on mobile, 2-column on tablet, 3-column on desktop (matching current grid)
- Generous padding: `p-5` on cards, `gap-4` between cards
- `max-w-[1600px]` container with responsive horizontal padding

---

## Component 2: Recruiter Campaign Detail Page

**File:** `src/components/RecruiterDetailView.tsx` (rewrite existing)

### Page Structure (top to bottom)

#### 1. Header Bar (sticky)
- Back arrow + Campaign title + subtitle (task type, region, date)
- Status badge (recruiter-friendly label)
- "Download All" button (approved/sent only, charcoal pill)

#### 2. Campaign Summary Card
- Brief summary text (from `brief_data.summary`)
- Inline metadata: regions, languages, asset counts
- Colored dots + labels for each metadata item

#### 3. Status-Specific Content

**If status = draft/generating/review:**
- Status message card with icon + human-readable description
- Pipeline progress bar (existing `PipelineProgress` component) for `generating` only
- Request Details card (expanded)

**If status = approved/sent:**
- All sections below render

#### 4. Messaging Themes Card
- Core message (from `brief_data.messaging_strategy.primary_message`)
- Value propositions as colored tag pills (green, blue, purple, yellow)
- Tone description (from `brief_data.messaging_strategy.tone`)

Data source: `GET /api/generate/[id]/brief` → `brief_data.messaging_strategy`, `brief_data.value_props`

#### 5. Approved Creatives Grid
- **Platform filter pills** — All, Facebook, Instagram, LinkedIn, Telegram, TikTok (dynamically populated from asset platforms)
- **3-column grid** (2 on tablet, 1 on mobile) of asset cards
- Each card shows:
  - Asset image (`blob_url`)
  - Platform badge (top-right overlay)
  - Headline text
  - Description/copy text
  - Individual "Download" link
- Only shows assets where `evaluation_passed === true`

Data source: `GET /api/generate/[id]/images` → filter `evaluation_passed === true`

#### 6. Target Personas Card
- 3-column grid (1 on mobile) of persona cards
- Each persona: name, demographic description, primary pain point/motivation
- Colored accent for the pain point tag

Data source: `GET /api/generate/[id]/brief` → `brief_data.personas` (array with `name`, `demographics`, `pain_point`)

#### 7. Request Details Card (collapsed by default)
- Expandable section showing original form data
- Languages, regions, volume, compensation, urgency, task type, creation date
- Uses existing `RequestDetailsFormatted` component or simplified version

### Layout Constraints
- Full viewport width — `max-w-[1100px]` centered container for content
- Generous vertical spacing: `space-y-6` between sections
- Cards use `rounded-xl` (12px), `p-5` or `p-6` padding
- Mobile: single column, `px-4` horizontal padding
- Desktop: breathable layout with proper content hierarchy
- Asset grid fills available width — no cramped thumbnails

---

## What Recruiters Do NOT See

These remain admin-only (existing behavior, no changes needed):
- Cultural guardrails and research data
- Evaluation scores and VQA metrics
- Design direction and HTML templates
- Revision modal and model routing
- Pipeline stage details (only progress bar, not stage-by-stage)
- Channel research raw data
- Actor profile cards with face_lock JSON

---

## Data Flow

```
Recruiter loads /intake/[id]
  → role check returns "recruiter"
  → page.tsx renders RecruiterDetailView (existing gate, line 306-316)
  → RecruiterDetailView fetches:
      1. Request data (passed as prop from parent)
      2. Brief data → GET /api/generate/[id]/brief
      3. Assets → GET /api/generate/[id]/images (filter evaluation_passed)
      4. Actors → GET /api/generate/[id]/actors (for personas)
  → Renders based on status:
      - draft/generating/review → status card + progress
      - approved/sent → full Campaign Briefing Page
```

Note: The parent `intake/[id]/page.tsx` already fetches brief, actors, and assets and passes them to `RecruiterDetailView`. We extend the props interface to include `brief` data.

---

## Files to Modify

| File | Change |
|---|---|
| `src/components/RecruiterDetailView.tsx` | Full rewrite — Campaign Briefing Page |
| `src/components/IntakeCard.tsx` | Add recruiter-friendly status label mapping |
| `src/app/page.tsx` | Use recruiter card variant when role === "recruiter" |
| `src/app/intake/[id]/page.tsx` | Pass `brief` prop to RecruiterDetailView |
| `src/lib/format.ts` | Add `getRecruiterStatus()` helper function |

## Files NOT Modified

- No database migrations
- No new API routes
- No changes to admin or designer views
- No changes to the worker pipeline
