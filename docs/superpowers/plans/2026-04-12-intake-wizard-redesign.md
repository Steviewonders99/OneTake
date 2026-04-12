# Intake Wizard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-page intake form with a 5-step wizard (Start → Task & Mode → Details → Requirements → Review) at 1600px width, with pipeline wiring fixes for `monthly_budget`, `demographic` inference, and `task_description` standardization.

**Architecture:** New `IntakeWizard` component manages wizard state (current step, formData, extraction). Each step is a standalone component receiving shared state via props. The existing `/api/intake` POST and `/api/extract/*` endpoints are unchanged — the wizard maps to the same data shape. Pipeline fix is a 3-line change in `stage1_intelligence.py`.

**Tech Stack:** Next.js App Router, React client components, Lucide React icons, inline styles (enterprise OneForma), existing extraction API.

**Spec:** `docs/superpowers/specs/2026-04-12-intake-wizard-redesign-design.md`
**Mockup:** `.superpowers/brainstorm/1078-1776004525/content/03-wizard-full-v3.html`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/components/intake/IntakeWizard.tsx` | Main orchestrator — step state, formData, navigation, submission |
| `src/components/intake/WizardProgress.tsx` | 5-step progress bar with done/active/pending states |
| `src/components/intake/WizardNav.tsx` | Bottom nav — Back/Next/Submit/Skip buttons |
| `src/components/intake/StepStart.tsx` | Step 1: Upload RFP or Paste JD |
| `src/components/intake/StepTaskMode.tsx` | Step 2: 5 task type cards + onsite/remote mode |
| `src/components/intake/StepDetails.tsx` | Step 3: Title, urgency, volume, regions, languages, compensation, budget |
| `src/components/intake/StepRequirements.tsx` | Step 4: AI pre-filled qualifications + ADA form |
| `src/components/intake/StepReview.tsx` | Step 5: Read-only summary with edit links |

### Modified Files
| File | Changes |
|---|---|
| `src/app/intake/new/page.tsx` | Replace DynamicForm with IntakeWizard, keep AppShell wrapper |
| `worker/pipeline/stage1_intelligence.py` | Fix demographic inference + `description` → `task_description` key |

---

## Task 1: Pipeline Wiring Fix (Worker)

**Files:**
- Modify: `worker/pipeline/stage1_intelligence.py`

- [ ] **Step 1: Fix demographic inference fallback**

In `worker/pipeline/stage1_intelligence.py`, find line 88:
```python
demographic=form_data.get("demographic", "young adults 18-35"),
```

Replace with:
```python
demographic=form_data.get("demographic") or _infer_demographic(form_data, request),
```

Add this helper function before `run_stage1()`:
```python
def _infer_demographic(form_data: dict, request: dict) -> str:
    """Infer target demographic from task type, qualifications, and location when not provided."""
    task_type = request.get("task_type", "")
    quals = request.get("qualifications_required", "") or ""
    location = request.get("location_scope", "") or ""

    # Professional/credentialed signals
    pro_signals = ["licensed", "certified", "degree", "experience", "professional", "nurse", "doctor", "engineer"]
    if any(s in quals.lower() for s in pro_signals):
        return "working professionals 28-55"

    # Student/university signals
    student_signals = ["student", "university", "college", "campus", "intern"]
    if any(s in quals.lower() for s in student_signals) or any(s in location.lower() for s in student_signals):
        return "university students 18-25"

    # Task-type based defaults
    type_demographics = {
        "transcription": "young professionals 22-40",
        "translation": "bilingual professionals 25-45",
        "annotation": "tech-savvy adults 20-35",
        "judging": "diverse adults 25-55",
        "data_collection": "general population 18-45",
    }
    if task_type in type_demographics:
        return type_demographics[task_type]

    return "adults 18-45"
```

- [ ] **Step 2: Fix task_description key mismatch**

Find line 229:
```python
task_description=form_data.get("description", ""),
```

Replace with:
```python
task_description=form_data.get("task_description") or form_data.get("description", ""),
```

- [ ] **Step 3: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('worker/pipeline/stage1_intelligence.py').read()); print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/stage1_intelligence.py
git commit -m "fix(pipeline): infer demographic from qualifications/task when not provided, standardize task_description key"
```

---

## Task 2: WizardProgress + WizardNav Components

**Files:**
- Create: `src/components/intake/WizardProgress.tsx`
- Create: `src/components/intake/WizardNav.tsx`

- [ ] **Step 1: Create WizardProgress**

```tsx
"use client";

const STEPS = [
  { key: "start", label: "Start" },
  { key: "task_mode", label: "Task & Mode" },
  { key: "details", label: "Details" },
  { key: "requirements", label: "Requirements" },
  { key: "review", label: "Review" },
];

interface WizardProgressProps {
  currentStep: number; // 0-indexed
}

export default function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E8E8EA", padding: "0 40px" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "16px 48px", display: "flex", alignItems: "center" }}>
        {STEPS.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          return (
            <div key={step.key} style={{ display: "contents" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isDone ? "#dcfce7" : isActive ? "#32373C" : "#F7F7F8",
                    color: isDone ? "#15803d" : isActive ? "white" : "#8A8A8E",
                    border: !isDone && !isActive ? "1px solid #E8E8EA" : "none",
                  }}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                <span
                  style={{
                    fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                    color: isDone ? "#15803d" : isActive ? "#32373C" : "#8A8A8E",
                  }}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, margin: "0 12px", minWidth: 20, background: isDone ? "#bbf7d0" : "#E8E8EA" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create WizardNav**

```tsx
"use client";

import { ChevronLeft, ChevronRight, Check } from "lucide-react";

interface WizardNavProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
  isSubmit?: boolean;
}

export default function WizardNav({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
  showSkip = false,
  onSkip,
  isSubmit = false,
}: WizardNavProps) {
  const label = nextLabel || (isSubmit ? "Submit Request" : "Continue");
  return (
    <div style={{ background: "#FFFFFF", borderTop: "1px solid #E8E8EA", padding: "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 12, color: "#8A8A8E" }}>Step {currentStep + 1} of {totalSteps}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {showSkip && onSkip && (
          <button onClick={onSkip} style={{ padding: "10px 20px", borderRadius: 9999, fontSize: 13, fontWeight: 600, border: "none", background: "none", color: "#8A8A8E", cursor: "pointer", fontFamily: "inherit" }}>
            Skip — fill manually
          </button>
        )}
        {currentStep > 0 && (
          <button onClick={onBack} style={{ padding: "10px 24px", borderRadius: 9999, fontSize: 13, fontWeight: 600, border: "1px solid #E8E8EA", background: "white", color: "#8A8A8E", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
            <ChevronLeft size={12} /> Back
          </button>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          style={{
            padding: "10px 28px", borderRadius: 9999, fontSize: 14, fontWeight: 700,
            border: "none", background: isSubmit ? "#15803d" : nextDisabled ? "#E8E8EA" : "#32373C",
            color: nextDisabled ? "#8A8A8E" : "white",
            cursor: nextDisabled ? "not-allowed" : "pointer",
            fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {isSubmit && <Check size={14} />}
          {label}
          {!isSubmit && <ChevronRight size={14} />}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "WizardProgress|WizardNav"
git add src/components/intake/WizardProgress.tsx src/components/intake/WizardNav.tsx
git commit -m "feat(intake): add WizardProgress + WizardNav — step indicator + bottom navigation"
```

---

## Task 3: StepStart Component (Upload/Paste)

**Files:**
- Create: `src/components/intake/StepStart.tsx`

- [ ] **Step 1: Create StepStart**

A "use client" component with two choice cards (Upload RFP / Paste JD). Shows dropzone or textarea based on selection. Calls extraction API and returns results via callback.

Props:
```tsx
interface StepStartProps {
  onExtracted: (result: ExtractionResult) => void;
  onSkip: () => void;
}
```

The component manages its own local state for `entryMode`, `pasteText`, `extracting`. On extraction success, calls `onExtracted(result)`. The "Skip" button calls `onSkip()`.

Key elements:
- Two choice cards (Upload RFP / Paste JD) as large dashed-border cards
- Paste mode: textarea with placeholder example text
- Upload mode: drag-drop zone accepting PDF/Word/txt
- "Gemma 4 is reading your brief..." spinner during extraction
- API calls: POST `/api/extract/paste` with `{ text }` or POST `/api/extract/rfp` with FormData
- Import `ExtractionResult` from `@/lib/types`

Card styling: `padding: 32px 28px`, `borderRadius: 14`, `border: 2px dashed #E8E8EA`, centered icon + name + description. Selected state: `border-color: #6D28D9`, `border-style: solid`.

Step card wrapper: 1600px max-width, 48px padding (matching mockup).

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep StepStart
git add src/components/intake/StepStart.tsx
git commit -m "feat(intake): add StepStart — Upload RFP or Paste JD with AI extraction"
```

---

## Task 4: StepTaskMode Component

**Files:**
- Create: `src/components/intake/StepTaskMode.tsx`

- [ ] **Step 1: Create StepTaskMode**

Props:
```tsx
interface StepTaskModeProps {
  taskType: string | null;
  workMode: "onsite" | "remote" | null;
  onTaskTypeChange: (type: string) => void;
  onWorkModeChange: (mode: "onsite" | "remote") => void;
}
```

5 task type cards in a grid row:
```tsx
const TASK_TYPES = [
  { key: "annotation", name: "Annotation", desc: "Label, tag, or classify data", icon: "Edit3" },
  { key: "data_collection", name: "Data Collection", desc: "Gather new data from people", icon: "Upload" },
  { key: "judging", name: "Judging", desc: "Rate, rank, or evaluate", icon: "Star" },
  { key: "transcription", name: "Transcription", desc: "Audio/video to text", icon: "Mic" },
  { key: "translation", name: "Translation", desc: "Translate or localize", icon: "Languages" },
];
```

2 mode cards below:
- Onsite Data Collection: icon Home, tags "In-person", "Supervised", "ADA Required"
- Remote / Digital Recruitment: icon Monitor, tags "Web-based", "App-based", "Self-paced"

Card styling: `border: 2px solid #E8E8EA`, selected: `border-color: #6D28D9` + purple checkmark. 1600px max-width, 48px padding.

Import Lucide icons: `Edit3, Upload, Star, Mic, Languages, Home, Monitor, Check`

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep StepTaskMode
git add src/components/intake/StepTaskMode.tsx
git commit -m "feat(intake): add StepTaskMode — 5 task type cards + onsite/remote mode selection"
```

---

## Task 5: StepDetails Component

**Files:**
- Create: `src/components/intake/StepDetails.tsx`

- [ ] **Step 1: Create StepDetails**

Props:
```tsx
interface StepDetailsProps {
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  confidenceFlags: Record<string, string>;
}
```

Fields (2-column grid, 1600px width, 48px padding):
1. Project Title (full-width text, required)
2. Urgency (button group: Urgent/Standard/Pipeline)
3. Contributors Needed (number)
4. Target Regions (multi-select tags via SearchableDropdown or simple tags input)
5. Target Languages (multi-select tags)
6. Task Description (textarea, optional, full-width) — stores as `form_data.task_description`
7. Target Demographic (text, optional) — stores as `form_data.demographic`, placeholder "e.g. working professionals 28-55 — leave blank to auto-detect"

Compensation sub-section (3-column grid, separated by border-top):
8. Compensation Model (select)
9. Rate/Amount (number with $ prefix) — stores as `form_data.compensation_rate`
10. Monthly Ad Budget (number with $ prefix) — stores as `form_data.monthly_budget`

Confidence badges next to AI-extracted fields.

For multi-select tags: use a simplified inline tag input (text input + Enter to add + click tag to remove). Don't import the full DynamicForm machinery — keep this self-contained.

Each field calls `onChange({...formData, [key]: value})` on change.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep StepDetails
git add src/components/intake/StepDetails.tsx
git commit -m "feat(intake): add StepDetails — project info, compensation, budget fields"
```

---

## Task 6: StepRequirements Component

**Files:**
- Create: `src/components/intake/StepRequirements.tsx`

- [ ] **Step 1: Create StepRequirements**

Props:
```tsx
interface StepRequirementsProps {
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  confidenceFlags: Record<string, string>;
  workMode: "onsite" | "remote" | null;
}
```

Purple verify banner at top: "Gemma 4 pre-filled these fields — please verify"

Fields (2-column grid):
1. Required Qualifications (textarea, full-width, required) — `qualifications_required`
2. Preferred Qualifications (textarea, full-width) — `qualifications_preferred`
3. Engagement Model (textarea, half-width, required) — `engagement_model`
4. Language Requirements (textarea, half-width, required) — `language_requirements`
5. Location & Work Setup (textarea, full-width, required) — `location_scope`

ADA section (conditional — only if `workMode === "onsite"`):
- Red-tinted card with explanation banner
- ADA Screener URL (text input, required) — `ada_form_url`

Confidence badges on each field from `confidenceFlags`.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep StepRequirements
git add src/components/intake/StepRequirements.tsx
git commit -m "feat(intake): add StepRequirements — AI pre-filled qualifications + conditional ADA form"
```

---

## Task 7: StepReview Component

**Files:**
- Create: `src/components/intake/StepReview.tsx`

- [ ] **Step 1: Create StepReview**

Props:
```tsx
interface StepReviewProps {
  formData: Record<string, unknown>;
  taskType: string | null;
  workMode: "onsite" | "remote" | null;
  onEditStep: (step: number) => void;
}
```

3 review sections, each with "Edit" link that calls `onEditStep(stepIndex)`:

1. **Task & Mode** — task type + work mode
2. **Project Details** — title, urgency, volume, regions, languages, compensation model + rate, ad budget, demographic (if set), task description (if set)
3. **Requirements** — qualifications, engagement model, language requirements, location, ADA URL (red warning if missing for onsite)

Each section: header with title + "Edit" link, then 2-column grid of label/value pairs.

Styling: `borderBottom: 1px solid #E8E8EA` between sections. Review labels: 10px uppercase muted. Review values: 13px normal text.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep StepReview
git add src/components/intake/StepReview.tsx
git commit -m "feat(intake): add StepReview — read-only summary with edit links per section"
```

---

## Task 8: IntakeWizard Orchestrator

**Files:**
- Create: `src/components/intake/IntakeWizard.tsx`

- [ ] **Step 1: Create IntakeWizard**

The main orchestrator component managing:
- `currentStep: number` (0-4)
- `formData: Record<string, unknown>` — shared across all steps
- `taskType: string | null`
- `workMode: "onsite" | "remote" | null`
- `extraction: ExtractionResult | null`
- `confidenceFlags: Record<string, string>`
- `isSubmitting: boolean`

**Step navigation logic:**
- `handleNext()`: validates current step, advances
- `handleBack()`: goes back one step
- `handleSkip()`: skips Step 1, goes to Step 2 with empty data
- `handleExtracted(result)`: merges extraction into formData, sets confidenceFlags, auto-advances to Step 2
- `handleEditStep(step)`: jumps to that step from review
- `handleSubmit()`: POST to `/api/intake` with the same payload shape as current form

**Submission payload** (same as current — maps wizard state to existing API):
```tsx
{
  title: formData.title,
  task_type: taskType,
  urgency: formData.urgency || "standard",
  target_languages: formData.target_languages || [],
  target_regions: formData.target_regions || [],
  volume_needed: formData.volume_needed || null,
  form_data: formData, // includes monthly_budget, demographic, task_description, work_mode, ada_form_url, compensation_rate
  schema_version: 1,
}
```

**Post-submit:** If `workMode === "onsite"` and `formData.ada_form_url`, PATCH to `/api/intake/[id]/landing-pages` with `{ ada_form_url }`.

**Layout:** Full viewport height flex column — top bar + WizardProgress + step content (flex:1) + WizardNav.

**Top bar:** Back arrow, "New Recruitment Request" title, auto-save indicator.

Renders the appropriate step component based on `currentStep`.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/intake/IntakeWizard.tsx
git commit -m "feat(intake): add IntakeWizard orchestrator — 5-step wizard with shared state + submission"
```

---

## Task 9: Wire IntakeWizard into Page

**Files:**
- Modify: `src/app/intake/new/page.tsx`

- [ ] **Step 1: Replace DynamicForm with IntakeWizard**

Read the current `src/app/intake/new/page.tsx`. Replace the entire component body with a simple wrapper that renders `IntakeWizard` inside `AppShell`.

The new page component is minimal — all logic lives in IntakeWizard:

```tsx
"use client";

import AppShell from "@/components/AppShell";
import IntakeWizard from "@/components/intake/IntakeWizard";

export default function NewIntakePage() {
  return (
    <AppShell>
      <IntakeWizard />
    </AppShell>
  );
}
```

Keep the existing `AppShell` wrapper. All the state management, extraction, task type selection, and submission logic has moved into `IntakeWizard`.

**Important:** Do NOT delete `DynamicForm.tsx` or `TaskTypePicker.tsx` — they're still used by the admin schema editor.

- [ ] **Step 2: Verify full build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/intake/new/page.tsx
git commit -m "feat(intake): wire IntakeWizard into new intake page — replaces single-page DynamicForm"
```
