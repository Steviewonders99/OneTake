# AI Dashboard Intelligence — Design Spec

**Date:** 2026-05-13
**Status:** Design
**Author:** Steven Junop + Claude

## Problem

The dashboards display data but don't explain it. Leadership sees "34.7% CVR" but doesn't know why. Recruiters see "CPA $16.46" but don't know if that's good. Users can't ask questions, get recommendations, or build custom views without knowing which widgets exist. The data is rich — 35K+ rows, 117 campaigns, full funnel — but the insight layer is missing.

## Solution

Three-layer AI intelligence system + an AI Dashboard Composer that lets users build custom dashboards in natural language.

## Architecture Overview

```
Layer 1: Auto-Insights     → Widget-level, generated on load, zero user effort
Layer 2: Chat Panel         → Correlations-style FAB, resizable, context-aware
Layer 3: Proactive Alerts   → Worker-side anomaly detection, FAB pulses
Composer: AI Dashboard Builder → Natural language → widget selection → instant dashboard
```

Data access model: **Context Packet + Sandboxed API** (Option D). The AI never touches the database directly.

---

## Layer 1: Auto-Insights

Every widget shows a one-line AI-generated insight at the bottom.

**How it works:**
1. On dashboard load, a single API call sends all widget data as a "context packet" to the LLM
2. LLM returns one insight per widget (keyed by widget ID)
3. Each widget renders the insight as a subtle line at the bottom with a color-coded dot

**Insight line design:**
- Border-top: `1px solid #f5f5f5`
- Padding-top: `8px`, margin-top: `8px`
- Font: `text-[11px] text-[#525252]`
- Color dot: `w-[5px] h-[5px] rounded-full` — blue (info), green (positive), orange (warning), red (alert)
- "Ask more >" link at right — opens Layer 2 chat with this insight as context

**API endpoint:** `POST /api/insights/ai/auto-insights`
- Body: `{ dashboard_id, widget_data: Record<widgetId, { type, config, data_summary }>, date_range }`
- Returns: `{ insights: Record<widgetId, { text: string, type: 'info'|'positive'|'warning'|'alert' }> }`
- LLM: Kimi K2.5 via NVIDIA NIM (already in worker config)
- Prompt includes: widget type, metric values, period deltas, campaign context

**Caching:** Insights cached per dashboard + date range combo. Invalidated on filter change.

---

## Layer 2: Chat Panel

Floating AI chat panel — ported from Correlations repo, adapted to light OneForma theme.

**UX:**
- FAB: fixed bottom-right, 48px circle, charcoal `#1a1a1a`, chat icon
- Click FAB → panel slides up (360px wide, 480px tall default)
- Panel is resizable: top handle, left handle, top-left corner handle (same as Correlations)
- Min: 320x360, Max: viewport - 48px
- Header: green dot + "Dashboard Analyst" + model badge + close X
- Messages: user right-aligned (#f5f5f5 bg), assistant left-aligned (#fafafa bg, 1px border)
- Input: textarea with auto-resize + send button
- Welcome message adapts to current dashboard: "I can see the Executive Overview with 30-day data."

**Context passing:**
- Every chat message includes: `{ messages, dashboard_id, active_filters, date_range, widget_data_summary }`
- The AI sees what the user sees — same data, same filters, same date range
- "Ask more >" from Layer 1 pre-populates the chat with: "Tell me more about: [insight text]"

**Data access (Option D):**
- Context packet: widget data summaries (what's already fetched by widgets)
- Sandboxed API: AI can request data from the same API endpoints widgets use
- Tool calling: LLM can call `campaign-funnel`, `organic-overview`, `paid-overview`, `kpi-trends` with parameters
- Never raw SQL, never direct DB access

**API endpoint:** `POST /api/insights/ai/chat`
- Body: `{ messages[], dashboard_context: { id, filters, date_range, widget_summaries } }`
- Returns: `{ content: string, sources?: string[] }`
- Streaming: SSE for real-time token delivery (feels responsive)

**Markdown rendering:** Bold, italic, bullet points, inline code. Same as Correlations `formatMsg()`.

---

## Layer 3: Proactive Alerts

The AI notices anomalies before the user asks.

**How it works:**
1. Worker runs anomaly detection on a schedule (every 6 hours, alongside organic_sync)
2. Compares current period vs previous period for all campaigns
3. Flags: spend spikes >30%, CVR drops >20%, CPA increases >25%, new campaign launches
4. Stores alerts in a `dashboard_alerts` table
5. Frontend polls for unread alerts — FAB shows a subtle green pulse when there are new ones
6. Opening the chat panel shows the most recent alert as the first message

**Alert types:**
- `spend_spike` — "Reddit spend increased 45% today"
- `cvr_drop` — "Humus CVR dropped from 8.2% to 5.1% this week"
- `cpa_alert` — "Lumina CPA exceeded breakeven threshold ($22.50 vs $18.00 target)"
- `new_campaign` — "New campaign detected: MoonBrush (launched 2h ago)"
- `positive` — "Lumina hit 34.7% CVR — highest in portfolio history"

**Table:** `dashboard_alerts`
```sql
CREATE TABLE IF NOT EXISTS dashboard_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',  -- info, warning, critical
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  campaign TEXT,
  platform TEXT,
  metric_value FLOAT,
  metric_previous FLOAT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## AI Dashboard Composer

Natural language → instant custom dashboard from existing widgets.

**Entry point:** Hero section at the top of `/insights` list page.

**UX design (premium — inspired by HextaUI animated chat):**
- Full-width hero with ambient glow orbs (soft blue/purple/green floating blurs)
- Title: "What do you want to analyze?" (gradient text, 32px, medium weight)
- Subtitle: "Describe what you're looking for — I'll build the dashboard"
- Premium input card: white, 16px radius, subtle shadow, focus ring glow
- Auto-resize textarea placeholder: "How did the Humus LinkedIn post perform organically vs paid?"
- Footer: paperclip (attach) + command palette icon (purple) + Cmd+K hint + Send button
- Suggestion pills below: 5 contextual prompts based on active campaigns
- Command palette: type `/` to see commands (/compare, /funnel, /trend)

**How it works technically:**
1. User types natural language prompt
2. `POST /api/insights/ai/compose` sends: `{ prompt, available_widgets: WIDGET_REGISTRY, available_campaigns: [...] }`
3. LLM receives the widget registry (types, descriptions, config schemas) + campaign list
4. LLM outputs: `{ title, description, widgets: WidgetInstance[], gridLayouts: { lg, md, sm } }` — a complete `DashboardLayoutData`
5. System calls `createDashboard(title, userId, layoutData, description)` — same function as manual creation
6. Redirect to `/insights/{new_id}` — widgets render with real data instantly
7. Dashboard tagged with `"AI Generated"` badge

**The AI is a composer, not an analyst.** It selects widgets + sets their configs. Widgets fetch their own data through existing API routes. The AI never touches the database.

**Widget selection logic (in the LLM prompt):**
- Campaign comparison → `organic-kpi` + `paid-kpi` filtered to campaign
- Funnel breakdown → `campaign-funnel` with campaign filter
- Channel comparison → `organic-platform-compare` + `paid-platform-compare`
- Post performance → `organic-top-posts` filtered to platform
- Attribution → `organic-attribution`
- Growth trends → `organic-account-growth`
- Search visibility → `gsc-performance`

**Layout rules (in the LLM prompt):**
- KPI widgets: full width (w=12, h=2) at top
- Comparison widgets: side by side (w=6 each)
- Detail widgets: full width (w=12, h=5)
- Max 8 widgets per generated dashboard
- Always include a relevant KPI widget first (story starts with the headline)

---

## Suggestion Pills

5 contextual suggestions shown below the input bar. Generated from:
1. Active campaigns (from `ga4_funnel_events` distinct campaigns)
2. Recent anomalies (from `dashboard_alerts`)
3. Hardcoded templates for common questions

Examples:
- "Campaign performance overview"
- "Humus full funnel by channel"
- "Lumina vs Milky Way CVR"
- "Reddit vs Meta efficiency"
- "Weekly organic growth report"

---

## Data Privacy & Integrity

**Principle:** The AI sees what the user sees. Nothing more.

| Layer | Data Source | Risk | Mitigation |
|---|---|---|---|
| Auto-insights (L1) | Context packet (widget data already in browser) | Zero | No new data access |
| Chat panel (L2) | Context packet + sandboxed API calls | Low | Same endpoints as widgets, same auth |
| Proactive alerts (L3) | Worker-side (server, not user-facing) | Zero | Pre-computed, stored as text |
| Composer | Widget registry + campaign list | Zero | No data access, only widget selection |

**What the AI CANNOT do:**
- Run arbitrary SQL queries
- Access tables not exposed through API routes (user_roles, magic_links, etc.)
- See data outside the user's role permissions (recruiter sees own campaigns only)
- Modify any data (all AI interactions are read-only)
- Access PII (names, emails, tokens) — API routes return aggregated metrics only

**GraphRAG integration:** The existing GraphRAG interest database (1,054 interests) can be exposed as a read-only context for the chat panel when discussing audience targeting. This is already aggregated data with no PII.

---

## Implementation Phases

**Phase 1 (Friday demo):** AI Dashboard Composer hero page + basic auto-insights
- Hero input on /insights page (the premium UX)
- `POST /api/insights/ai/compose` → LLM selects widgets → creates dashboard
- Basic auto-insights on KPI widgets (context packet approach)

**Phase 2 (Week 7):** Chat panel + full auto-insights
- Port Correlations chat panel to light theme
- Wire context passing (dashboard + filters + date range)
- Auto-insights on all widget types
- Streaming responses via SSE

**Phase 3 (Week 8):** Proactive alerts + refinement
- Worker-side anomaly detection
- `dashboard_alerts` table
- FAB pulse indicator
- Alert → chat panel bridge

---

## File Inventory

### New Files

| File | Purpose |
|---|---|
| `src/components/insights/AiComposerHero.tsx` | Hero input section for /insights list page |
| `src/components/insights/AiChatPanel.tsx` | Floating chat panel (ported from Correlations) |
| `src/components/insights/AiInsightLine.tsx` | Auto-insight line component for widgets |
| `src/app/api/insights/ai/compose/route.ts` | LLM dashboard composition endpoint |
| `src/app/api/insights/ai/chat/route.ts` | Chat endpoint with context passing |
| `src/app/api/insights/ai/auto-insights/route.ts` | Batch auto-insight generation |
| `src/app/api/insights/ai/alerts/route.ts` | Proactive alerts read endpoint |

### Modified Files

| File | Change |
|---|---|
| `src/app/insights/(dashboard)/page.tsx` | Add AiComposerHero above dashboard list |
| `src/app/insights/(dashboard)/InsightsDashboardList.tsx` | "AI Generated" badge on composer-created dashboards |
| `src/app/insights/(dashboard)/[id]/BuilderClient.tsx` | Add AiChatPanel FAB + wire context |
| `src/components/insights/WidgetRenderer.tsx` | Add AiInsightLine below widget content |
| `src/lib/db/dashboards.ts` | Add `is_ai_generated` flag support |
| `worker/pipeline/stage_anomaly_detection.py` | Anomaly detection for proactive alerts |
