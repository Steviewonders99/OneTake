# ROAS Formula Unification + Budget Recommendations — Design Spec

> Feature: Wire OneForma's recruitment ROAS framework into the platform. Auto-calculate target CPA and recommended budget per country in the intake wizard. Provide ROAS metrics API for the Command Center.
> Date: 2026-04-24
> Status: Approved

---

## Problem

The ROAS framework exists as a standalone document (`/Oneformadata/roas_framework.md`) but isn't wired into the platform. Recruiters set ad budgets by guessing. There's no target CPA benchmark, no budget recommendation, and no way to calculate ROAS per country. The `roas_config` table exists but has no calculator or API.

## Solution

1. **ROAS Calculator module** — pure Python functions implementing all 8 formulas from the framework
2. **Budget Recommendation in intake wizard** — auto-calculated per country from rate + volume
3. **ROAS API endpoint** — reads roas_config + daily metrics, returns calculated ROAS per country
4. **Auto-populate roas_config** — when country quotas exist, create roas_config rows from rates

---

## Business Rules

### Core Formulas

```
RPP             = (Contract Value × Recognition Rate) / Required Participants
                  OR simply: locale_rate × recognition_rate (when using per-country rates)
Net RPP         = RPP - Variable Cost Per Participant
Target CPA      = RPP × 0.20                    (20% of participant revenue)
Starting Budget = Target CPA × 6 × volume       (6x multiplier per participant needed)
Breakeven CPA   = Net RPP × Fulfillment Rate
CPA             = Ad Spend / Acquired Completions
Effective CPA   = Ad Spend / (Completions × Fulfillment Rate)
ROAS            = (Completions × FR × Net RPP) / Ad Spend
ROI %           = (ROAS - 1) × 100
```

### Configurable Defaults

| Parameter | Default | Description |
|---|---|---|
| `recognition_rate` | 0.85 | % of contract value recognized as revenue |
| `cpa_target_pct` | 0.20 | Target CPA as % of RPP |
| `budget_multiplier` | 6 | Starting budget = Target CPA × multiplier × volume |
| `fulfillment_rate` | 0.65 | % of completions that deliver usable data |
| `variable_cost_per_participant` | 0 | Platform + ops cost per participant |

### CPA Health Indicator

| Status | Condition | Color |
|---|---|---|
| Excellent | Actual CPA < Target CPA | Green |
| Acceptable | Target CPA < Actual CPA < Breakeven CPA | Yellow |
| Unprofitable | Actual CPA > Breakeven CPA | Red |

---

## Schema Change

Add `recognition_rate` and budget parameters to `roas_config`:

```sql
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS recognition_rate FLOAT DEFAULT 0.85;
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS cpa_target_pct FLOAT DEFAULT 0.20;
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS budget_multiplier FLOAT DEFAULT 6.0;
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS recommended_budget NUMERIC(14,2);
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS target_cpa NUMERIC(10,2);
```

---

## Implementation

### 1. ROAS Calculator (Python)

New file: `worker/roas/calculator.py`

```python
def calculate_roas_metrics(
    rate: float,                    # locale rate (e.g., $30.00)
    recognition_rate: float = 0.85,
    variable_cost: float = 0.0,
    fulfillment_rate: float = 0.65,
    cpa_target_pct: float = 0.20,
    budget_multiplier: float = 6.0,
    volume: int = 0,
    ad_spend: float | None = None,
    completions: int | None = None,
) -> dict:
    rpp = rate * recognition_rate
    net_rpp = rpp - variable_cost
    target_cpa = rpp * cpa_target_pct
    breakeven_cpa = net_rpp * fulfillment_rate
    recommended_budget = target_cpa * budget_multiplier * volume

    result = {
        "rpp": round(rpp, 2),
        "net_rpp": round(net_rpp, 2),
        "target_cpa": round(target_cpa, 2),
        "breakeven_cpa": round(breakeven_cpa, 2),
        "recommended_budget": round(recommended_budget, 2),
    }

    # If actual campaign data available, calculate actuals
    if ad_spend and completions and completions > 0:
        actual_cpa = ad_spend / completions
        effective_cpa = ad_spend / (completions * fulfillment_rate)
        roas = (completions * fulfillment_rate * net_rpp) / ad_spend if ad_spend > 0 else 0
        roi_pct = (roas - 1) * 100

        # Health indicator
        if actual_cpa <= target_cpa:
            health = "excellent"
        elif actual_cpa <= breakeven_cpa:
            health = "acceptable"
        else:
            health = "unprofitable"

        result.update({
            "actual_cpa": round(actual_cpa, 2),
            "effective_cpa": round(effective_cpa, 2),
            "roas": round(roas, 4),
            "roi_pct": round(roi_pct, 1),
            "health": health,
        })

    return result
```

### 2. Intake Wizard — Budget Recommendation Per Country

In `CountryQuotaTable.tsx`, add a computed budget recommendation row to each country card. **No API call — pure client-side math:**

```typescript
const RECOGNITION_RATE = 0.85;
const CPA_TARGET_PCT = 0.20;
const BUDGET_MULTIPLIER = 6;

function calculateBudgetRec(rate: number, volume: number) {
  const rpp = rate * RECOGNITION_RATE;
  const targetCPA = rpp * CPA_TARGET_PCT;
  const recBudget = targetCPA * BUDGET_MULTIPLIER * volume;
  return { targetCPA, recBudget };
}
```

Displayed inside each country card below the Volume/Rate/Locale row:

```
┌─── Budget Recommendation ───────────────────┐
│  Target CPA: $5.10  |  Rec. Budget: $30,600 │
└─────────────────────────────────────────────┘
```

Summary footer updated to show total recommended budget across all countries.

### 3. ROAS API Endpoint

New file: `src/app/api/roas/[requestId]/route.ts`

```typescript
GET /api/roas/[requestId]
// Returns per-country ROAS metrics
// Reads: roas_config + normalized_daily_metrics + country_quotas
// Response: { countries: [{ country, rpp, net_rpp, target_cpa, breakeven_cpa,
//              recommended_budget, actual_cpa?, roas?, health? }] }
```

### 4. Auto-populate roas_config from country quotas

In the intake API (`POST /api/intake`), when `country_quotas` exist, create `roas_config` rows:

```typescript
for (const quota of countryQuotas) {
  const rpp = quota.rate * 0.85;
  await createRoasConfig({
    request_id: intakeRequest.id,
    country: quota.country,
    rpp,
    net_rpp: rpp,  // VCP defaults to 0
    fulfillment_rate: 0.65,
    recognition_rate: 0.85,
    cpa_target_pct: 0.20,
    budget_multiplier: 6.0,
    target_cpa: rpp * 0.20,
    breakeven_cpa: rpp * 0.65,
    recommended_budget: rpp * 0.20 * 6 * quota.total_volume,
  });
}
```

---

## Files to Create / Modify

### New Files

| File | Purpose |
|---|---|
| `worker/roas/__init__.py` | Package init |
| `worker/roas/calculator.py` | ROAS formula calculator (pure functions) |
| `src/app/api/roas/[requestId]/route.ts` | ROAS metrics API endpoint |
| `migrations/2026-04-24-roas-columns.sql` | Add recognition_rate + budget columns to roas_config |
| `worker/tests/test_roas_calculator.py` | Calculator unit tests |

### Modified Files

| File | Change |
|---|---|
| `src/components/intake/CountryQuotaTable.tsx` | Add budget recommendation display per country |
| `src/app/api/intake/route.ts` | Auto-populate roas_config from country quotas |
| `src/lib/types.ts` | Add RoasMetrics interface |

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| No rate on country quota | Skip budget recommendation, show "Set rate to see budget" |
| Volume is 0 | Target CPA still calculates, budget shows $0 |
| No ad spend data yet | Show projected metrics only (target CPA, budget rec), no actuals |
| VCP unknown | Default to 0, Net RPP = RPP |
| Recognition rate varies by project | Configurable per roas_config row, defaults to 85% |

---

## Out of Scope

- Command Center ROAS dashboard UI (separate spec — uses this API)
- RevBrain budget shift recommendations (depends on multi-period data)
- Funnel cost breakdown (cost per LP visitor, per signup, etc.)
- Ad platform spend sync (requires Meta/Google API — AudienceIQ Phase 5)
