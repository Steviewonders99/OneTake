# Country Quotas & Demographic Requirements — Design Spec

> Feature: Structured per-country volume, rates, and demographic quota management in the intake wizard.
> Date: 2026-04-22
> Status: Approved
> Scope: Phase 1 (Intake Wizard), Phase 2 (Persona + Research Engine — separate spec)

---

## Problem

Recruitment campaigns have per-country requirements that vary on three dimensions:

1. **Volume** — Different countries need different numbers of contributors (e.g., 1,000 in the US, 500 in Malaysia)
2. **Rate** — Pay rates differ by locale (e.g., $30 in the US, $10 in Malaysia)
3. **Demographics** — Clients specify quotas by ethnicity, age, skin color, gender, or other categories that vary per project

Currently the intake wizard has:
- A single `volume_needed` field (one number for the whole campaign)
- A single `compensation_rate` field (one rate for the whole campaign)
- A single freetext `demographic` field ("working professionals 28-55")
- `locale_links` with a string `rate` field (disconnected from compensation)

This means the campaign splitter, persona engine, and ROAS calculations have no structured per-country data to work with.

## Solution

A unified **Country Quota Table** in StepDetails that combines country, volume, rate, and demographic quotas into one editable interface. Three input methods: auto-populate from target regions, manual entry, or Excel upload.

---

## Data Model

### Core Types

```typescript
interface CountryQuota {
  country: string;           // "United States"
  locale: string;            // "en_US" (optional, from locale_links)
  total_volume: number;      // 1000
  rate: number;              // 30.00
  currency: string;          // "USD" (default)
  url?: string;              // OneForma job posting URL (from locale_links)
  demographics: DemographicQuota[];
}

interface DemographicQuota {
  category: string;          // freetext: "Ethnicity", "Age Range", "Skin Color"
  value: string;             // freetext: "Middle Eastern", "18-35", "Light"
  percentage: number;        // 0-100
  volume: number;            // auto-derived: total_volume * percentage / 100
}
```

### Storage

- **Primary:** `intake_requests.form_data.country_quotas: CountryQuota[]`
- **Backwards compat:** `intake_requests.volume_needed` = sum of all `total_volume` across countries (auto-calculated on save)
- **Legacy field:** `form_data.demographic` (single freetext) remains as a general notes field, not the structured data source

### Relationship to Existing Fields

| Existing Field | New Behavior |
|---|---|
| `volume_needed` | Auto-calculated as sum of all country quotas. Read-only when quotas exist. |
| `compensation_rate` | Becomes the default rate for new country rows. Per-country rates override. |
| `target_regions` | Auto-populates country quota cards. Adding a region tag creates a quota card. |
| `locale_links` | If uploaded, rates and locales merge into matching country quota cards. |
| `demographic` | Stays as freetext general notes. Structured data lives in `CountryQuota.demographics`. |

---

## Intake Wizard UI

### Placement

New sub-section in **StepDetails** (`src/components/intake/StepDetails.tsx`), below the existing Compensation & Budget section.

### Layout

**Section header:**
```
Country Quotas & Demographics
"Per-country volume, rates, and demographic requirements"
[+ Add Country]  [Upload Excel]
```

**Per-country card (collapsible):**
```
┌─────────────────────────────────────────────────────┐
│ ▼ United States                          [Remove]   │
│                                                     │
│  Volume: [1,000]   Rate: [$30.00]   Locale: [en_US] │
│                                                     │
│  Demographics:                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ Category      Value             %     Volume  │  │
│  │ [Ethnicity  ] [Middle Eastern ] [50]  500     │  │
│  │ [Ethnicity  ] [Hispanic/Latino] [30]  300     │  │
│  │ [Age Range  ] [18-35          ] [60]  600     │  │
│  │ [+ Add Requirement]                           │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Total: 1,000 contributors | $30.00/person          │
└─────────────────────────────────────────────────────┘
```

**Summary footer:**
```
16 countries | 12,400 total contributors | Avg rate: $24.69
```

### Component: `CountryQuotaTable`

New file: `src/components/intake/CountryQuotaTable.tsx`

**Props:**
```typescript
interface CountryQuotaTableProps {
  value: CountryQuota[];
  onChange: (quotas: CountryQuota[]) => void;
  targetRegions: string[];       // auto-populate from StepDetails tags
  localeLinks?: LocaleLink[];    // merge rates/locales if available
  defaultRate?: number;          // from compensation_rate field
  confidenceFlags: Record<string, string>;
}
```

### Behaviors

**Auto-population from target regions:**
- When a recruiter adds a region tag in StepDetails (e.g., "Morocco"), a new `CountryQuota` card appears automatically with `country: "Morocco"`, `total_volume: 0`, `rate: defaultRate`, empty demographics
- Removing a region tag removes the corresponding quota card (with confirmation if data was entered)

**Locale links merge:**
- If `locale_links` are uploaded in StepRequirements, matching countries get their `rate`, `locale`, and `url` fields auto-filled
- Match by country name derived from locale code (e.g., `bg_BG` → "Bulgaria")

**Collapse/expand:**
- Cards are collapsible — collapsed state shows one line: `Morocco | 500 contributors | $17.50/person | 2 demographic rules`
- All collapsed by default when 6+ countries exist
- "Expand All" / "Collapse All" toggle in section header

**Demographic validation:**
- Percentages within the same category warn (yellow border) if they exceed 100%
- Does NOT block submission — some quotas intentionally overlap (e.g., age AND ethnicity are independent axes)
- Volume column auto-calculates: `Math.round(total_volume * percentage / 100)`

**Excel upload:**
- Button opens file picker for `.xlsx` / `.csv`
- Parser expects columns: Country, Volume, Rate, Category, Value, Percentage
- Multiple rows per country (one per demographic requirement)
- Parsed data populates `CountryQuota[]`, merging with any existing cards

### Styling

Uses existing OneForma design system:
- Cards: `border-radius: 12px`, `border: 1px solid #E5E5E5`, `box-shadow: 0 2px 8px rgba(0,0,0,0.08)`
- Inputs: `border-radius: 10px`, `border: 1px solid #E5E5E5`, `font-size: 13px`
- Buttons: `btn-primary` (charcoal pill) for Add Country, `btn-secondary` for Upload Excel
- Labels: 11px uppercase gray (`#737373`)
- Summary footer: `background: #F5F5F5`, `border-radius: 10px`, centered text

---

## AI Extraction Enhancement

### Extraction Prompt Update

File: `src/lib/extraction-prompt.ts`

Add guidance for Gemma 4 to detect per-locale rate tables and demographic quota requirements in RFPs:

```
When extracting from the document, look for:
- Per-country or per-locale compensation/rate tables (columns like: locale, language, rate/pay)
- Demographic requirements or quotas (e.g., "50% female", "ages 18-35", "Middle Eastern descent")
- Volume requirements per country or locale
- Skin color, ethnicity, age range, or gender specifications tied to participant counts

Structure these as country_quotas: an array of objects with country, total_volume, rate, and demographics (category, value, percentage).
```

### Confidence Badges

- Rate tables clearly stated in a table format → `extracted`
- Demographic requirements mentioned in prose ("we need diverse participants") → `inferred`
- No volume/rate/demographic data found → `verify` badge on the Country Quotas section header

---

## Persona & Actor Scaling Rule

The number of personas and actors per country scales inversely with the number of countries to keep total asset volume manageable:

| Countries | Personas per Country | Actors per Persona | Total Actors per Country |
|---|---|---|---|
| 1 | 2 | 2 | 4 |
| 2 | 2 | 2 | 4 |
| 3+ | 1 | 1 | 1 |

**Rationale:** Single and dual-country campaigns get 2 personas with 2 actors each — enough creative variety for meaningful A/B testing without excess. At 3+ countries, scaling down to 1 persona / 1 actor per country keeps total output proportional regardless of campaign size.

**Implementation:** The splitter sets `form_data.persona_count` and `form_data.actors_per_persona` on each child campaign (or the parent if no split). Stage 1 (persona generation) and Stage 2 (image generation) read these values instead of hardcoding 3/3.

```python
PERSONA_SCALING = {
    1: {"personas": 2, "actors_per_persona": 2},
    2: {"personas": 2, "actors_per_persona": 2},
}
PERSONA_SCALING_DEFAULT = {"personas": 1, "actors_per_persona": 1}  # 3+ countries
```

---

## Data Flow

### Intake → Campaign Splitter

File: `worker/pipeline/campaign_splitter.py`

When splitting a multi-country campaign:
1. Read `form_data.country_quotas` instead of just `target_regions`
2. Determine persona/actor scaling based on total country count
3. Each child campaign inherits its specific `CountryQuota` object:
   - `child.volume_needed` = `quota.total_volume`
   - `child.form_data.locale_rate` = `{ amount: quota.rate, currency: quota.currency }`
   - `child.form_data.demographics` = `quota.demographics`
   - `child.form_data.locale` = `quota.locale`
   - `child.form_data.job_posting_url` = `quota.url`
   - `child.form_data.persona_count` = scaling rule based on total country count
   - `child.form_data.actors_per_persona` = scaling rule based on total country count
4. If no `country_quotas` exist, fall back to current behavior (split by `target_regions` with no rate/demographic data)

### Intake → ROAS (Command Center)

Per-country rate becomes RPP (Revenue Per Participant):
```
Net RPP = locale_rate - variable_cost_per_participant
ROAS = (completions × fulfillment_rate × net_RPP) / ad_spend
Breakeven CPA = net_RPP × fulfillment_rate
```

Each child campaign's strategy row in `campaign_strategies` can reference its inherited rate for per-country ROAS calculations.

### Intake → Persona Engine (Phase 2 — separate spec)

Demographics inform downstream generation:
- Persona generation uses demographic quotas to ensure representation matches client requirements
- Actor identity cards reflect the demographic mix (e.g., if 50% Middle Eastern, actors should reflect that)
- Copy angles adapt to resonate with specified demographic segments
- Image generation visual direction influenced by demographic composition

This integration is **out of scope for this spec** and will be covered in a Phase 2 design.

---

## Files to Create / Modify

### New Files

| File | Purpose |
|---|---|
| `src/components/intake/CountryQuotaTable.tsx` | Country quota + demographics table component |

### Modified Files

| File | Change |
|---|---|
| `src/components/intake/StepDetails.tsx` | Add CountryQuotaTable section below Compensation & Budget |
| `src/components/intake/StepReview.tsx` | Render country quota summary (countries, volumes, rates, demographic rules) |
| `src/lib/types.ts` | Add `CountryQuota` and `DemographicQuota` interfaces |
| `src/lib/extraction-prompt.ts` | Add country quota + demographic extraction guidance |
| `src/app/api/intake/route.ts` | Auto-calculate `volume_needed` from country quota sum |
| `worker/pipeline/campaign_splitter.py` | Read `country_quotas` for per-child volume, rate, demographics |

### Modified Files (Scaling Rule)

| File | Change |
|---|---|
| `worker/pipeline/campaign_splitter.py` | Apply persona/actor scaling rule based on country count |
| `worker/pipeline/stage1_intelligence.py` | Read `persona_count` from form_data instead of hardcoded 3 |
| `worker/pipeline/stage2_images.py` | Read `actors_per_persona` from form_data instead of hardcoded 3 |

### Not Modified (Phase 2)

| File | Reason |
|---|---|
| `worker/pipeline/stage1_intelligence.py` | Persona engine demographic integration is Phase 2 (scaling rule is Phase 1) |
| `worker/pipeline/stage2_images.py` | Actor demographic representation is Phase 2 (scaling rule is Phase 1) |
| `worker/pipeline/stage3_copy.py` | Copy demographic targeting is Phase 2 |

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| No country quotas entered | Falls back to `volume_needed` and `compensation_rate` (current behavior) |
| Country quota exists but no demographics | Valid — not all campaigns have demographic requirements |
| Demographics percentages exceed 100% in a category | Yellow warning, does not block submission (quotas can overlap across categories) |
| Region tag added but no quota data filled | Card appears with zero volume, default rate — submission warns "incomplete quotas" |
| Region tag removed that has quota data | Confirmation dialog before deleting |
| locale_links uploaded after quotas entered | Merge rates/locales into existing cards, don't overwrite manually entered rates |
| Excel upload when cards already exist | Merge by country name, overwrite matching countries, add new ones |
| 30+ countries | All cards collapsed by default, summary footer visible, "Expand All" available |

---

## Out of Scope

- Phase 2: Persona engine demographic integration (actors, copy, images reflect demographic mix)
- Phase 2: Demographic tracking at conversion (tag manager MCP capturing demographic data)
- Phase 2: Per-demographic ROAS in Command Center
- Database schema changes — all data stored in existing `form_data` JSONB column
