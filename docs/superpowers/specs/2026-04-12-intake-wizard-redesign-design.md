# Intake Form Wizard Redesign — Design Spec

**Date:** 2026-04-12
**Author:** Steven Junop + Claude
**Status:** Approved
**Mockup:** `.superpowers/brainstorm/1078-1776004525/content/03-wizard-full-v3.html`

## Overview

Replace the single-page intake form with a 5-step wizard that feels psychologically effortless. Each step has 3-6 fields max. AI pre-fills from RFP/paste in Step 1. Task type and mode are visual card selections. The form progresses from broad choices → specific details → verification → review.

**Current state:** Single-page form at 1100px max-width with all fields visible at once. Schema-driven via `DynamicForm.tsx` + `task_type_schemas` table.

**Target state:** Multi-step wizard at 1600px max-width. Step 1 is RFP upload/paste. Steps 2-4 progressively reveal fields. Step 5 is review & submit. ADA form conditionally required for onsite data collection.

## Design System

Same enterprise OneForma tokens used throughout the session:
- Charcoal `#32373C`, Muted `#8A8A8E`, Border `#E8E8EA`, Purple `#6D28D9`
- All inline styles, Lucide icons, 1600px max-width, 48px horizontal padding

## 5-Step Wizard Structure

### Step 1: Start — Upload or Paste
**Purpose:** Get the raw job brief into the system so AI can pre-fill everything.

**Two options (visual cards):**
1. **Upload RFP** — drag & drop PDF/Word/text file
2. **Paste Job Description** — textarea for copy-paste

**Behavior:**
- Selecting "Paste" reveals a large textarea with placeholder showing example format
- On submit ("Extract & Continue"), calls `/api/extract/paste` or `/api/extract/rfp`
- Shows "Gemma 4 is reading your brief..." spinner during extraction
- "Skip — fill manually" link bypasses AI and goes to Step 2 with empty fields
- Extraction result auto-selects task type and mode in Step 2, pre-fills all subsequent fields

**Fields:** 0 (just the paste/upload action)

### Step 2: Task & Mode
**Purpose:** Two visual selections — what type of task + onsite vs remote.

**Task Type (5 cards in a row):**
- Annotation — "Label, tag, or classify data"
- Data Collection — "Gather new data from people"
- Judging — "Rate, rank, or evaluate"
- Transcription — "Audio/video to text"
- Translation — "Translate or localize"

Each card: icon (Lucide), name, description. Selected state: purple border + checkmark.

**Mode (2 cards side by side):**
- **Onsite Data Collection** — "Physical location — clinic, lab, field site. ADA screening required." Tags: In-person, Supervised, ADA Required
- **Remote / Digital Recruitment** — "Web platform, mobile app, or email. No physical presence." Tags: Web-based, App-based, Self-paced

**AI pre-selection:** If Step 1 extracted a task type and mode, they're pre-selected with purple rings. Recruiter confirms or changes.

**Fields:** 2 (both are visual card selections)

### Step 3: Project Details
**Purpose:** Core project information + compensation + budget.

**Fields (2-column grid):**
1. Project Title (text, full-width, required, AI-extracted)
2. Urgency (button group: Urgent / Standard / Pipeline, required)
3. Contributors Needed (number, required, AI-extracted)
4. Target Regions (multi-select tags, required)
5. Target Languages (multi-select tags, required)

**Compensation & Budget sub-section** (3-column grid, separated by border-top):
6. Compensation Model (select: Per Task / Per Hour / Per Unit / Fixed Project / TBD, required)
7. Rate / Amount (number with `$` prefix, required)
8. Monthly Ad Budget (number with `$` prefix, required)

**Fields:** 8 total

### Step 4: Requirements & Qualifications
**Purpose:** AI pre-filled candidate requirements — recruiter verifies.

**Verify banner:** Purple "Gemma 4 pre-filled these fields — please verify" at top.

**Fields (2-column grid):**
1. Required Qualifications (textarea, full-width, required, "Verify" badge)
2. Preferred Qualifications (textarea, full-width, optional, "Inferred" badge)
3. Engagement Model (textarea, half-width, required, "Verify" badge) — hours, schedule, duration
4. Language Requirements (textarea, half-width, required, "Extracted" badge)
5. Location & Work Setup (textarea, full-width, required, "Verify" badge)

**ADA Compliance section** (conditional — only if Mode = Onsite in Step 2):
- Red-tinted card at bottom of step
- Explanation banner: "Onsite data collection requires ADA compliance screening"
- ADA Screener URL (text input, required)

**Fields:** 5-6 (mostly verification of AI pre-fills)

### Step 5: Review & Submit
**Purpose:** Read-only summary with edit links per section.

**3 review sections** with "Edit" link on each:
1. **Task & Mode** — task type + mode (2 values)
2. **Project Details** — title, urgency, volume, regions, languages, compensation, budget
3. **Requirements** — qualifications, engagement, languages, location, ADA URL

ADA screener shows red warning if URL not yet provided.

**Green "Submit Request" button** replaces the charcoal "Continue" button.

**Fields:** 0 (read-only)

## Progress Bar

Sticky top bar showing 5 steps with:
- **Done:** green circle with checkmark, green label
- **Active:** charcoal circle with number, dark label
- **Pending:** gray circle with number, muted label
- Lines between steps: green (done) or gray (pending)
- Max-width 1600px, 48px horizontal padding

## Layout Constants

- **Max-width:** 1600px (all steps, progress bar, nav)
- **Card padding:** 48px horizontal, 32-36px vertical
- **Step area padding:** 40px all sides
- **Field grid gap:** 20px vertical, 28px horizontal
- **Border radius:** 16px (step cards), 14px (selection cards), 10px (inputs)

## Bottom Navigation

Sticky bottom bar with:
- Left: "Step N of 5" text
- Right: Back button (charcoal outline) + Next/Continue button (charcoal fill)
- Step 1: "Skip — fill manually" text button + "Extract & Continue"
- Step 5: Green "Submit Request" button instead of charcoal

## New Fields to Add

| Field | Key | Type | Required | Where |
|---|---|---|---|---|
| Ad Budget | `ad_budget` | number | Yes (all tasks) | Step 3 — Compensation section |
| Rate/Amount | `compensation_rate` | number | Yes (all tasks) | Step 3 — Compensation section |
| ADA Form URL | `ada_form_url` | text | Conditional (onsite only) | Step 4 — ADA section |
| Work Mode | `work_mode` | enum (onsite/remote) | Yes | Step 2 — stored in form_data |

## Data Flow

1. **Step 1 → API:** POST to `/api/extract/paste` or `/api/extract/rfp` with raw text/file
2. **API → Steps 2-4:** Extraction result populates `formData` state with pre-fills + confidence flags
3. **Steps 2-4 → State:** Each step updates the shared `formData` + `wizardState` (current step, selections)
4. **Step 5 → API:** POST to `/api/intake` with complete form data + `work_mode` + `ad_budget` + `compensation_rate` + `ada_form_url`
5. **Validation:** Each step validates its own fields before allowing "Continue". Step 5 re-validates everything.

## Components

### New Components
| Component | Purpose |
|---|---|
| `src/components/intake/IntakeWizard.tsx` | Main wizard orchestrator — manages step state, navigation, data |
| `src/components/intake/WizardProgress.tsx` | 5-step progress bar |
| `src/components/intake/WizardNav.tsx` | Bottom navigation (Back/Next/Submit) |
| `src/components/intake/StepStart.tsx` | Step 1: Upload/Paste with AI extraction |
| `src/components/intake/StepTaskMode.tsx` | Step 2: Task type cards + mode selection |
| `src/components/intake/StepDetails.tsx` | Step 3: Project details + compensation |
| `src/components/intake/StepRequirements.tsx` | Step 4: AI pre-filled requirements + ADA |
| `src/components/intake/StepReview.tsx` | Step 5: Read-only summary with edit links |

### Modified Files
| File | Changes |
|---|---|
| `src/app/intake/new/page.tsx` | Replace DynamicForm render with IntakeWizard component |
| `src/lib/seed-schemas.ts` | Add `ad_budget`, `compensation_rate` to base_fields |

### Preserved
- `DynamicForm.tsx` — not deleted, still used by admin schema editor
- `/api/extract/paste` and `/api/extract/rfp` — unchanged, still return `ExtractionResult`
- `/api/intake` POST — unchanged, receives `form_data` JSONB
- `task_type_schemas` table — unchanged, wizard maps to same schema structure
- Confidence tracking (`manuallyEditedKeys`) — preserved in wizard state

## File Count Estimate
- ~8 new component files
- ~2 modified files
- **Total:** ~10 files, ~1500-2000 new lines
