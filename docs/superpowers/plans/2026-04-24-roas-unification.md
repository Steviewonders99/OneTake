# ROAS Formula Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire OneForma's recruitment ROAS framework into the platform — calculator module, budget recommendations in intake wizard, ROAS API endpoint, auto-populated roas_config.

**Architecture:** Pure Python calculator module with all 8 ROAS formulas. Client-side budget recommendation in CountryQuotaTable (no API call needed). API endpoint reads roas_config + daily metrics for actuals. Intake auto-populates roas_config from country quotas.

**Tech Stack:** Python 3, TypeScript/React, PostgreSQL (Neon)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `migrations/2026-04-24-roas-columns.sql` | Create | Add recognition_rate + budget columns to roas_config |
| `worker/roas/__init__.py` | Create | Package init |
| `worker/roas/calculator.py` | Create | ROAS formula calculator (pure functions) |
| `worker/tests/test_roas_calculator.py` | Create | Calculator unit tests |
| `src/app/api/roas/[requestId]/route.ts` | Create | ROAS metrics API endpoint |
| `src/components/intake/CountryQuotaTable.tsx` | Modify | Add budget recommendation per country card |
| `src/app/api/intake/route.ts` | Modify | Auto-populate roas_config from country quotas |

---

### Task 1: SQL migration for roas_config columns

**Files:**
- Create: `migrations/2026-04-24-roas-columns.sql`

- [ ] **Step 1: Create the migration**

```sql
-- migrations/2026-04-24-roas-columns.sql
-- Add ROAS formula parameters to roas_config

ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS recognition_rate FLOAT DEFAULT 0.85;
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS cpa_target_pct FLOAT DEFAULT 0.20;
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS budget_multiplier FLOAT DEFAULT 6.0;
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS recommended_budget NUMERIC(14,2);
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS target_cpa NUMERIC(10,2);
```

- [ ] **Step 2: Run migration against Neon**

```python
import asyncio
async def run():
    from neon_client import _get_pool
    pool = await _get_pool()
    async with pool.acquire() as conn:
        with open('../migrations/2026-04-24-roas-columns.sql') as f:
            sql = f.read()
        for stmt in sql.split(';'):
            stmt = stmt.strip()
            if stmt and not stmt.startswith('--'):
                try:
                    await conn.execute(stmt)
                    print(f'OK: {stmt[:70]}')
                except Exception as e:
                    print(f'WARN: {e}')
asyncio.run(run())
```

Run from `worker/` directory.

- [ ] **Step 3: Commit**

```bash
git add migrations/2026-04-24-roas-columns.sql
git commit -m "feat: add ROAS formula columns to roas_config (recognition_rate, target_cpa, budget)"
```

---

### Task 2: Create ROAS calculator module + tests

**Files:**
- Create: `worker/roas/__init__.py`
- Create: `worker/roas/calculator.py`
- Create: `worker/tests/test_roas_calculator.py`

- [ ] **Step 1: Create package init**

```python
# worker/roas/__init__.py
"""OneForma ROAS Framework — recruitment-specific return on ad spend."""
```

- [ ] **Step 2: Create calculator module**

```python
"""ROAS calculator — recruitment-specific return on ad spend formulas.

Where the participant IS the product. Every metric flows from RPP
(Revenue Per Participant).

Business rules:
- Target CPA = 20% of RPP (participant revenue)
- Starting ad budget = 6x Target CPA per participant needed
- Recognition rate = 85% default (our share of contract value)
- Fulfillment rate = 65% default (% of completions that deliver usable data)
"""
from __future__ import annotations


def calculate_roas_metrics(
    rate: float,
    recognition_rate: float = 0.85,
    variable_cost: float = 0.0,
    fulfillment_rate: float = 0.65,
    cpa_target_pct: float = 0.20,
    budget_multiplier: float = 6.0,
    volume: int = 0,
    ad_spend: float | None = None,
    completions: int | None = None,
) -> dict:
    """Calculate all ROAS metrics for a campaign or country.

    Parameters
    ----------
    rate : float
        Locale rate / participant payment (e.g., $30.00).
    recognition_rate : float
        % of contract value recognized as revenue (default 85%).
    variable_cost : float
        Variable cost per participant (platform + ops costs).
    fulfillment_rate : float
        % of completed signups who deliver usable data.
    cpa_target_pct : float
        Target CPA as % of RPP (default 20%).
    budget_multiplier : float
        Starting budget = Target CPA × multiplier × volume (default 6x).
    volume : int
        Number of participants needed.
    ad_spend : float | None
        Actual ad spend (for calculating actuals). None = projections only.
    completions : int | None
        Actual acquired completions. None = projections only.

    Returns
    -------
    dict with projected metrics, and actual metrics if ad_spend + completions provided.
    """
    rpp = rate * recognition_rate
    net_rpp = rpp - variable_cost
    target_cpa = rpp * cpa_target_pct
    breakeven_cpa = net_rpp * fulfillment_rate if fulfillment_rate > 0 else 0
    recommended_budget = target_cpa * budget_multiplier * volume

    result = {
        "rpp": round(rpp, 2),
        "net_rpp": round(net_rpp, 2),
        "target_cpa": round(target_cpa, 2),
        "breakeven_cpa": round(breakeven_cpa, 2),
        "recommended_budget": round(recommended_budget, 2),
        "volume": volume,
        "rate": rate,
        "recognition_rate": recognition_rate,
        "fulfillment_rate": fulfillment_rate,
    }

    if ad_spend is not None and completions is not None and completions > 0:
        actual_cpa = ad_spend / completions
        effective_cpa = ad_spend / (completions * fulfillment_rate) if fulfillment_rate > 0 else 0
        roas = (completions * fulfillment_rate * net_rpp) / ad_spend if ad_spend > 0 else 0
        roi_pct = (roas - 1) * 100

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


def calculate_funnel_costs(
    ad_spend: float,
    lp_visitors: int = 0,
    signup_starts: int = 0,
    email_verified: int = 0,
    profile_completes: int = 0,
    fulfillment_rate: float = 0.65,
) -> dict:
    """Calculate cost at each funnel stage to find where money leaks."""
    def safe_div(a: float, b: int) -> float | None:
        return round(a / b, 2) if b > 0 else None

    return {
        "cost_per_lp_visitor": safe_div(ad_spend, lp_visitors),
        "cost_per_signup_start": safe_div(ad_spend, signup_starts),
        "cost_per_email_verified": safe_div(ad_spend, email_verified),
        "cost_per_profile_complete": safe_div(ad_spend, profile_completes),
        "cost_per_usable_participant": safe_div(ad_spend, int(profile_completes * fulfillment_rate)) if profile_completes > 0 else None,
    }
```

- [ ] **Step 3: Create tests**

```python
"""Tests for ROAS calculator — recruitment-specific formulas."""
from roas.calculator import calculate_funnel_costs, calculate_roas_metrics


class TestCalculateRoasMetrics:
    """Test all ROAS formula calculations."""

    def test_basic_rpp_calculation(self):
        """RPP = rate × recognition_rate."""
        result = calculate_roas_metrics(rate=30.0, recognition_rate=0.85)
        assert result["rpp"] == 25.50

    def test_net_rpp_with_variable_cost(self):
        """Net RPP = RPP - variable_cost."""
        result = calculate_roas_metrics(rate=30.0, variable_cost=12.0)
        assert result["net_rpp"] == 13.50  # 25.50 - 12.00

    def test_target_cpa_is_20_pct_of_rpp(self):
        """Target CPA = RPP × 0.20."""
        result = calculate_roas_metrics(rate=30.0)
        assert result["target_cpa"] == 5.10  # 25.50 × 0.20

    def test_recommended_budget_formula(self):
        """Recommended budget = Target CPA × 6 × volume."""
        result = calculate_roas_metrics(rate=30.0, volume=1000)
        assert result["recommended_budget"] == 30600.00  # 5.10 × 6 × 1000

    def test_breakeven_cpa(self):
        """Breakeven CPA = Net RPP × fulfillment_rate."""
        result = calculate_roas_metrics(rate=30.0, fulfillment_rate=0.65)
        assert result["breakeven_cpa"] == 16.58  # 25.50 × 0.65

    def test_breakeven_with_variable_cost(self):
        result = calculate_roas_metrics(rate=30.0, variable_cost=12.0, fulfillment_rate=0.65)
        assert result["breakeven_cpa"] == 8.78  # 13.50 × 0.65

    def test_morocco_rate(self):
        """Morocco at $17.50/person."""
        result = calculate_roas_metrics(rate=17.50, volume=500)
        assert result["rpp"] == 14.88  # 17.50 × 0.85
        assert result["target_cpa"] == 2.98  # 14.88 × 0.20
        assert result["recommended_budget"] == 8925.0  # 2.975 × 6 × 500 ≈ 8925

    def test_malaysia_cheapest_rate(self):
        """Malaysia at $10/person — cheapest in Centaurus."""
        result = calculate_roas_metrics(rate=10.0, volume=500)
        assert result["rpp"] == 8.50
        assert result["target_cpa"] == 1.70

    def test_canada_highest_rate(self):
        """Canada at $37.50/person — highest in Centaurus."""
        result = calculate_roas_metrics(rate=37.50, volume=600)
        assert result["rpp"] == 31.88  # 37.50 × 0.85
        assert result["target_cpa"] == 6.38  # 31.875 × 0.20

    def test_no_actuals_returns_projections_only(self):
        """Without ad_spend/completions, only projections returned."""
        result = calculate_roas_metrics(rate=30.0)
        assert "rpp" in result
        assert "target_cpa" in result
        assert "actual_cpa" not in result
        assert "roas" not in result
        assert "health" not in result

    def test_actuals_with_profitable_campaign(self):
        """CPA below target = excellent health."""
        result = calculate_roas_metrics(
            rate=30.0, ad_spend=1000, completions=300, volume=1000,
        )
        assert result["actual_cpa"] == 3.33  # 1000/300
        assert result["health"] == "excellent"  # 3.33 < 5.10 target
        assert result["roas"] > 1.0

    def test_actuals_with_acceptable_campaign(self):
        """CPA between target and breakeven = acceptable."""
        result = calculate_roas_metrics(
            rate=30.0, ad_spend=3000, completions=300, volume=1000,
        )
        assert result["actual_cpa"] == 10.0
        assert result["health"] == "acceptable"  # 5.10 < 10.0 < 16.58

    def test_actuals_with_unprofitable_campaign(self):
        """CPA above breakeven = unprofitable."""
        result = calculate_roas_metrics(
            rate=30.0, ad_spend=10000, completions=300, volume=1000,
        )
        assert result["actual_cpa"] == 33.33
        assert result["health"] == "unprofitable"  # 33.33 > 16.58

    def test_roas_calculation(self):
        """ROAS = (completions × FR × net_rpp) / ad_spend."""
        result = calculate_roas_metrics(
            rate=30.0, ad_spend=2000, completions=141, fulfillment_rate=0.65,
        )
        # 141 × 0.65 × 25.50 / 2000 = 1.168
        assert result["roas"] > 1.0
        assert result["roi_pct"] > 0

    def test_roi_percentage(self):
        """ROI% = (ROAS - 1) × 100."""
        result = calculate_roas_metrics(
            rate=30.0, ad_spend=1000, completions=200,
        )
        expected_roi = (result["roas"] - 1) * 100
        assert abs(result["roi_pct"] - round(expected_roi, 1)) < 0.2

    def test_zero_volume_budget_is_zero(self):
        result = calculate_roas_metrics(rate=30.0, volume=0)
        assert result["recommended_budget"] == 0

    def test_custom_recognition_rate(self):
        result = calculate_roas_metrics(rate=30.0, recognition_rate=0.90)
        assert result["rpp"] == 27.0  # 30 × 0.90

    def test_custom_budget_multiplier(self):
        result = calculate_roas_metrics(rate=30.0, budget_multiplier=10.0, volume=100)
        target_cpa = 30.0 * 0.85 * 0.20  # 5.10
        assert result["recommended_budget"] == round(target_cpa * 10 * 100, 2)


class TestFunnelCosts:
    """Test funnel cost breakdown calculations."""

    def test_full_funnel(self):
        result = calculate_funnel_costs(
            ad_spend=5000, lp_visitors=10000, signup_starts=1000,
            email_verified=500, profile_completes=141,
        )
        assert result["cost_per_lp_visitor"] == 0.50
        assert result["cost_per_signup_start"] == 5.00
        assert result["cost_per_email_verified"] == 10.00
        assert result["cost_per_profile_complete"] == 35.46

    def test_zero_visitors_returns_none(self):
        result = calculate_funnel_costs(ad_spend=5000, lp_visitors=0)
        assert result["cost_per_lp_visitor"] is None

    def test_usable_participant_cost(self):
        result = calculate_funnel_costs(
            ad_spend=5000, profile_completes=141, fulfillment_rate=0.65,
        )
        # 5000 / (141 × 0.65) = 5000 / 91 = 54.95
        assert result["cost_per_usable_participant"] is not None
        assert result["cost_per_usable_participant"] > result["cost_per_profile_complete"]
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -m pytest tests/test_roas_calculator.py -v`
Expected: All 20 tests pass

- [ ] **Step 5: Commit**

```bash
git add worker/roas/__init__.py worker/roas/calculator.py worker/tests/test_roas_calculator.py
git commit -m "feat: add ROAS calculator module — 8 formulas + target CPA + budget rec + 20 tests"
```

---

### Task 3: Add budget recommendation to CountryQuotaTable

**Files:**
- Modify: `src/components/intake/CountryQuotaTable.tsx`

- [ ] **Step 1: Add budget calculation constants and helper**

At the top of `CountryQuotaTable.tsx`, after the existing helpers, add:

```typescript
const RECOGNITION_RATE = 0.85;
const CPA_TARGET_PCT = 0.20;
const BUDGET_MULTIPLIER = 6;

function calculateBudgetRec(rate: number, volume: number) {
  const rpp = rate * RECOGNITION_RATE;
  const targetCPA = rpp * CPA_TARGET_PCT;
  const recBudget = targetCPA * BUDGET_MULTIPLIER * volume;
  return { rpp: Math.round(rpp * 100) / 100, targetCPA: Math.round(targetCPA * 100) / 100, recBudget: Math.round(recBudget) };
}
```

- [ ] **Step 2: Add budget recommendation display inside CountryCard**

In the `CountryCard` component, after the Volume/Rate/Locale row and before the Demographics section, add:

```tsx
{/* Budget Recommendation */}
{quota.rate > 0 && quota.total_volume > 0 && (
  <div style={{
    margin: "12px 0",
    padding: "10px 14px",
    background: "linear-gradient(135deg, rgba(3,72,178,0.04), rgba(170,24,141,0.04))",
    borderRadius: 8,
    border: "1px solid #E5E5E5",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
  }}>
    <div>
      <span style={{ color: "#737373" }}>Target CPA: </span>
      <span style={{ fontWeight: 700, color: "#1A1A1A" }}>
        ${calculateBudgetRec(quota.rate, quota.total_volume).targetCPA.toFixed(2)}
      </span>
    </div>
    <div>
      <span style={{ color: "#737373" }}>Rec. Budget: </span>
      <span style={{ fontWeight: 700, color: "#1A1A1A" }}>
        ${calculateBudgetRec(quota.rate, quota.total_volume).recBudget.toLocaleString()}
      </span>
    </div>
  </div>
)}
```

- [ ] **Step 3: Update summary footer with total recommended budget**

In the main component, update the summary footer to include total budget:

```typescript
const totalRecBudget = value.reduce((sum, q) => {
  if (q.rate > 0 && q.total_volume > 0) {
    return sum + calculateBudgetRec(q.rate, q.total_volume).recBudget;
  }
  return sum;
}, 0);
```

Add to the footer text:
```
{totalCountries} countries | {totalVolume} contributors | Avg rate: ${avgRate} | Rec. Budget: ${totalRecBudget.toLocaleString()}
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep "CountryQuota" | head -5`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/components/intake/CountryQuotaTable.tsx
git commit -m "feat: add per-country budget recommendation to intake wizard (Target CPA + Rec Budget)"
```

---

### Task 4: Auto-populate roas_config from country quotas

**Files:**
- Modify: `src/app/api/intake/route.ts`

- [ ] **Step 1: Add roas_config auto-population after intake creation**

In the POST handler, after `createIntakeRequest` and the auto-queue compute job block, add:

```typescript
    // Auto-populate roas_config from country quotas
    if (countryQuotas && countryQuotas.length > 0) {
      try {
        const { getDb } = await import('@/lib/db');
        const sql = getDb();
        for (const quota of countryQuotas) {
          if (!quota.rate || quota.rate <= 0) continue;
          const rpp = quota.rate * 0.85;
          const netRpp = rpp; // VCP defaults to 0
          const targetCpa = rpp * 0.20;
          const breakevenCpa = netRpp * 0.65;
          const recBudget = targetCpa * 6 * (quota.total_volume || 0);
          await sql`
            INSERT INTO roas_config (request_id, country, rpp, net_rpp, fulfillment_rate, recognition_rate, cpa_target_pct, budget_multiplier, target_cpa, breakeven_cpa, recommended_budget)
            VALUES (${intakeRequest.id}, ${quota.country}, ${rpp}, ${netRpp}, ${0.65}, ${0.85}, ${0.20}, ${6.0}, ${targetCpa}, ${breakevenCpa}, ${recBudget})
            ON CONFLICT (request_id, country) DO UPDATE SET
              rpp = EXCLUDED.rpp, net_rpp = EXCLUDED.net_rpp, target_cpa = EXCLUDED.target_cpa,
              breakeven_cpa = EXCLUDED.breakeven_cpa, recommended_budget = EXCLUDED.recommended_budget,
              updated_at = NOW()
          `;
        }
      } catch (err) {
        console.error('[api/intake] ROAS config auto-populate failed (non-fatal):', err);
      }
    }
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep "intake/route" | head -5`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/intake/route.ts"
git commit -m "feat: auto-populate roas_config from country quotas on intake submission"
```

---

### Task 5: Create ROAS API endpoint

**Files:**
- Create: `src/app/api/roas/[requestId]/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { requestId } = await params;
  const sql = getDb();

  // Get ROAS config per country
  const configs = await sql`
    SELECT country, rpp, net_rpp, fulfillment_rate, recognition_rate,
           cpa_target_pct, budget_multiplier, target_cpa, breakeven_cpa,
           recommended_budget, contract_value, required_participants,
           variable_cost_per_participant
    FROM roas_config
    WHERE request_id = ${requestId}
    ORDER BY country
  `;

  // Get actual metrics per country (if available)
  const metrics = await sql`
    SELECT country,
           SUM(spend) as total_spend,
           SUM(conversions) as total_conversions,
           SUM(signups) as total_signups,
           SUM(profile_completes) as total_completes
    FROM normalized_daily_metrics
    WHERE request_id = ${requestId}
    GROUP BY country
  `;

  const metricsMap = new Map(
    (metrics as any[]).map((m: any) => [m.country, m])
  );

  const countries = (configs as any[]).map((config: any) => {
    const actuals = metricsMap.get(config.country);
    const result: any = {
      country: config.country,
      rpp: Number(config.rpp),
      net_rpp: Number(config.net_rpp),
      target_cpa: Number(config.target_cpa),
      breakeven_cpa: Number(config.breakeven_cpa),
      recommended_budget: Number(config.recommended_budget),
      fulfillment_rate: Number(config.fulfillment_rate),
      recognition_rate: Number(config.recognition_rate),
    };

    if (actuals && Number(actuals.total_completes) > 0) {
      const spend = Number(actuals.total_spend);
      const completes = Number(actuals.total_completes);
      const fr = Number(config.fulfillment_rate);
      const netRpp = Number(config.net_rpp);

      result.actual_cpa = Math.round((spend / completes) * 100) / 100;
      result.effective_cpa = fr > 0 ? Math.round((spend / (completes * fr)) * 100) / 100 : null;
      result.roas = spend > 0 ? Math.round((completes * fr * netRpp / spend) * 10000) / 10000 : null;
      result.roi_pct = result.roas ? Math.round((result.roas - 1) * 1000) / 10 : null;
      result.ad_spend = spend;
      result.completions = completes;

      if (result.actual_cpa <= result.target_cpa) result.health = 'excellent';
      else if (result.actual_cpa <= result.breakeven_cpa) result.health = 'acceptable';
      else result.health = 'unprofitable';
    }

    return result;
  });

  return Response.json({ countries });
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep "roas" | head -5`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/roas/[requestId]/route.ts"
git commit -m "feat: add ROAS API endpoint — per-country metrics with CPA health indicator"
```

---

### Task 6: Lint + full test suite

- [ ] **Step 1: Run ruff**

Run: `cd /Users/stevenjunop/centric-intake && python3 -m ruff check worker/ --config worker/ruff.toml --fix`

- [ ] **Step 2: Run all Python tests**

Run: `cd worker && python3 -m pytest tests/ -v --tb=short 2>&1 | tail -5`
Expected: 220+ passed (201 existing + 20 new ROAS)

- [ ] **Step 3: Run TypeScript tests**

Run: `pnpm test -- --run 2>&1 | tail -5`
Expected: 413 passed

- [ ] **Step 4: Commit + push**

```bash
git add -A
git commit -m "fix: lint + verify all tests pass with ROAS calculator"
git push origin main
```
