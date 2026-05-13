# AI Dashboard Intelligence — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the AI Dashboard Composer hero page (natural language → instant custom dashboard) and basic auto-insights on KPI widgets for the Friday demo.

**Architecture:** User types a question → `POST /api/insights/ai/compose` sends prompt + widget registry to Kimi K2.5 via `callNIM()` → LLM returns `DashboardLayoutData` JSON → `createDashboard()` inserts it → redirect to `/insights/{id}`. Auto-insights use a context packet (widget data already on page) sent to LLM for one-line summaries.

**Tech Stack:** callNIM (Kimi K2.5 via NVIDIA NIM / OpenRouter fallback), existing WIDGET_REGISTRY, createDashboard(), React

**Spec:** `docs/superpowers/specs/2026-05-13-ai-dashboard-intelligence-design.md` (Phase 1 only)

---

### Task 1: AI Compose API Endpoint

**Files:**
- Create: `src/app/api/insights/ai/compose/route.ts`

- [ ] **Step 1: Create the compose endpoint**

This endpoint receives a natural language prompt, sends it to the LLM with the widget registry, and creates a dashboard from the response.

```typescript
// src/app/api/insights/ai/compose/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { callNIM } from '@/lib/nim';
import { createDashboard } from '@/lib/db/dashboards';
import { getDb } from '@/lib/db';
import type { DashboardLayoutData, WidgetType } from '@/components/insights/types';

// Simplified widget catalog for the LLM (no component references)
const WIDGET_CATALOG = [
  { type: 'paid-kpi', label: 'Paid KPIs', description: 'Spend, impressions, clicks, conversions, CPA, CTR', config: '{ days: number }', size: '12x2' },
  { type: 'organic-kpi', label: 'Organic KPIs', description: 'Impressions, reach, engagement, clicks, followers, eng rate', config: '{ days: number }', size: '12x2' },
  { type: 'campaign-funnel', label: 'Campaign Funnel', description: 'Full funnel: spend → sessions → signups → completions with CVR and channel breakdown', config: '{ days: number, campaign?: string }', size: '12x8' },
  { type: 'paid-platform-compare', label: 'Paid Platform Comparison', description: 'Spend by platform over time (Meta, Reddit, LinkedIn, Google, TikTok)', config: '{ days: number }', size: '6x4' },
  { type: 'organic-platform-compare', label: 'Organic Platform Comparison', description: 'Engagement by platform over time (Facebook, Instagram, LinkedIn, Reddit)', config: '{ days: number }', size: '6x4' },
  { type: 'paid-campaign-detail', label: 'Campaign Detail Table', description: 'Campaign-level spend, impressions, clicks, conversions, CPA', config: '{ days: number, platform?: string }', size: '12x5' },
  { type: 'organic-top-posts', label: 'Top Organic Posts', description: 'Ranked posts by engagement with pipeline/manual attribution', config: '{ days: number, platform?: string }', size: '12x5' },
  { type: 'organic-attribution', label: 'Pipeline vs Manual', description: 'AI-generated vs manually posted content performance comparison', config: '{ days: number }', size: '6x4' },
  { type: 'organic-account-growth', label: 'Account Growth', description: 'Follower count trends per platform', config: '{ days: number }', size: '6x4' },
  { type: 'gsc-performance', label: 'GSC Performance', description: 'Search queries, pages, clicks, impressions, position trends', config: '{ days: number }', size: '6x5' },
  { type: 'campaign-roi', label: 'Campaign Link ROI', description: 'Per-campaign tracked links and click performance', config: '{ days: number }', size: '6x4' },
  { type: 'utm-funnel', label: 'UTM Funnel', description: 'Clicks by source, medium, and campaign from tracked links', config: '{ days: number }', size: '6x4' },
  { type: 'recruiter-leaderboard', label: 'Recruiter Leaderboard', description: 'Ranked recruiters by clicks and active campaigns', config: '{ days: number }', size: '6x4' },
  { type: 'kpi-cards', label: 'Pipeline KPIs', description: 'Total campaigns, approved, generating, sent to agency', config: '{}', size: '12x2' },
  { type: 'pipeline-overview', label: 'Pipeline Status', description: 'Campaign distribution by pipeline stage', config: '{}', size: '6x4' },
  { type: 'campaign-timeline', label: 'Campaign Timeline', description: 'Recent campaigns with status and progress', config: '{}', size: '12x4' },
  { type: 'ga4-traffic', label: 'GA4 Traffic', description: 'Sessions, traffic sources, device breakdown', config: '{ days: number }', size: '6x4' },
];

const SYSTEM_PROMPT = `You are a dashboard composer for OneForma's marketing analytics platform.

Given a user's question in natural language, select the most relevant widgets and arrange them into a dashboard layout.

Available widgets:
${WIDGET_CATALOG.map(w => `- ${w.type}: ${w.label} — ${w.description} (size: ${w.size}, config: ${w.config})`).join('\n')}

Rules:
1. Select 3-8 widgets that best answer the user's question
2. Start with a KPI widget (paid-kpi or organic-kpi) for the headline numbers
3. Use campaign-funnel for any funnel/conversion questions
4. Use side-by-side widgets (w:6) for comparisons
5. Use full-width widgets (w:12) for detail views and funnels
6. If a campaign name is mentioned, set it in the config: { campaign: "name" }
7. If a platform is mentioned, set it in the config: { platform: "name" }
8. Default days to 30 unless the user specifies a timeframe

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "title": "Dashboard title (short, descriptive)",
  "description": "One-line description of what this dashboard shows",
  "widgets": [
    { "id": "unique-id", "type": "widget-type", "title": "Widget Title", "config": { ... } }
  ],
  "gridLayouts": {
    "lg": [
      { "i": "unique-id", "x": 0, "y": 0, "w": 12, "h": 2, "minW": 4, "minH": 2 }
    ]
  }
}

Grid: 12 columns, y increments by widget height. Side-by-side: left x=0 w=6, right x=6 w=6.
md layout: full-width w=8, side-by-side w=4 (x=0 and x=4).
sm layout: everything w=4, x=0, y stacked.`;

export async function POST(request: NextRequest) {
  const { userId } = await requireAuth();
  const body = await request.json();
  const prompt = body.prompt as string;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  // Get available campaigns for context
  const sql = getDb();
  const campaigns = await sql`
    SELECT DISTINCT campaign, SUM(event_count)::int as total
    FROM ga4_funnel_events
    WHERE campaign NOT IN ('(direct)', '(organic)', '(referral)', '(not set)', '')
    GROUP BY campaign ORDER BY total DESC LIMIT 20
  `;
  const campaignList = campaigns.map((c: any) => c.campaign).join(', ');

  const userPrompt = `Active campaigns: ${campaignList || 'none detected'}

User question: ${prompt}`;

  try {
    const raw = await callNIM(SYSTEM_PROMPT, userPrompt);

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = raw.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const layout = JSON.parse(jsonStr) as {
      title: string;
      description: string;
      widgets: { id: string; type: string; title: string; config: Record<string, unknown> }[];
      gridLayouts: { lg: any[]; md?: any[]; sm?: any[] };
    };

    // Validate widget types
    const validTypes = new Set(WIDGET_CATALOG.map(w => w.type));
    layout.widgets = layout.widgets.filter(w => validTypes.has(w.type));

    if (layout.widgets.length === 0) {
      return NextResponse.json({ error: 'Could not determine relevant widgets for your question' }, { status: 422 });
    }

    // Generate md/sm layouts if LLM didn't provide them
    if (!layout.gridLayouts.md) {
      layout.gridLayouts.md = layout.gridLayouts.lg.map(item => ({
        ...item, w: item.w >= 12 ? 8 : 4, x: item.w >= 12 ? 0 : (item.x >= 6 ? 4 : 0),
      }));
    }
    if (!layout.gridLayouts.sm) {
      let smY = 0;
      layout.gridLayouts.sm = layout.gridLayouts.lg.map(item => {
        const smItem = { ...item, w: 4, x: 0, y: smY };
        smY += item.h;
        return smItem;
      });
    }

    const layoutData: DashboardLayoutData = {
      widgets: layout.widgets.map(w => ({
        id: w.id,
        type: w.type as WidgetType,
        title: w.title,
        config: w.config || {},
      })),
      gridLayouts: layout.gridLayouts as any,
    };

    // Create the dashboard
    const dashboard = await createDashboard(
      layout.title || 'AI Dashboard',
      userId,
      layoutData,
      layout.description || 'AI-generated dashboard',
    );

    return NextResponse.json({ id: dashboard.id, title: dashboard.title });
  } catch (err) {
    console.error('[AI Compose] Error:', err);
    return NextResponse.json({ error: 'Failed to generate dashboard. Please try rephrasing your question.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add src/app/api/insights/ai/compose/route.ts
git commit -m "feat: AI compose endpoint — natural language to dashboard via Kimi K2.5"
```

---

### Task 2: AI Composer Hero Component

**Files:**
- Create: `src/components/insights/AiComposerHero.tsx`

- [ ] **Step 1: Create the hero component**

This is the premium input experience — ambient glow orbs, auto-resize textarea, suggestion pills, loading state with thinking animation.

```tsx
// src/components/insights/AiComposerHero.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2, Command, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const SUGGESTIONS = [
  'Campaign performance overview',
  'Humus full funnel by channel',
  'Lumina vs Milky Way CVR',
  'Reddit vs Meta efficiency',
  'Weekly organic growth report',
];

export function AiComposerHero() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingTags, setThinkingTags] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '60px';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  const handleSubmit = async (prompt?: string) => {
    const text = (prompt || value).trim();
    if (!text || isLoading) return;

    setIsLoading(true);
    setThinkingTags([]);

    // Simulate thinking tags appearing
    const tags = ['Analyzing question...', 'Selecting widgets...', 'Arranging layout...'];
    tags.forEach((tag, i) => {
      setTimeout(() => setThinkingTags(prev => [...prev, tag]), (i + 1) * 600);
    });

    try {
      const res = await fetch('/api/insights/ai/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate');
      }

      const data = await res.json();
      toast.success(`Dashboard created: ${data.title}`);
      router.push(`/insights/${data.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setIsLoading(false);
      setThinkingTags([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative py-16 px-6 overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[rgba(6,147,227,0.04)] blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-5%] right-[15%] w-[400px] h-[400px] rounded-full bg-[rgba(155,81,224,0.03)] blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '700ms' }} />
        <div className="absolute top-[30%] right-[30%] w-[300px] h-[300px] rounded-full bg-[rgba(34,197,94,0.03)] blur-[96px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto text-center">
        {/* Title */}
        <h1 className="text-[28px] font-medium tracking-tight mb-2" style={{ background: 'linear-gradient(135deg, #1a1a1a 40%, #a3a3a3 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          What do you want to analyze?
        </h1>
        <p className="text-[13px] text-[#a3a3a3] mb-3">
          Describe what you're looking for — I'll build the dashboard
        </p>
        <div className="w-20 h-px bg-gradient-to-r from-transparent via-[#e5e5e5] to-transparent mx-auto mb-8" />

        {/* Input card */}
        <div className="bg-white border border-[#e5e5e5] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] transition-all focus-within:border-[#d4d4d4] focus-within:shadow-[0_8px_40px_rgba(0,0,0,0.06),0_0_0_4px_rgba(6,147,227,0.06)] overflow-hidden">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="How did the Humus LinkedIn post perform organically vs paid?"
            disabled={isLoading}
            className="w-full px-6 pt-5 pb-3 text-[15px] text-[#1a1a1a] placeholder-[#d4d4d4] bg-transparent border-none outline-none resize-none disabled:opacity-60"
            rows={2}
            style={{ minHeight: '60px' }}
          />

          {/* Loading state: thinking tags */}
          {isLoading && thinkingTags.length > 0 && (
            <div className="px-6 pb-3 flex flex-wrap gap-2">
              {thinkingTags.map((tag, i) => (
                <span key={i} className="text-[10px] px-2 py-1 rounded-md bg-[#f0f9ff] text-[#3b82f6] animate-fadeIn" style={{ animationDelay: `${i * 200}ms` }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#f5f5f5] flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button className="w-9 h-9 rounded-lg flex items-center justify-center text-[#d4d4d4] hover:text-[#a855f7] hover:bg-[#f5f5f5] transition-colors cursor-pointer">
                <Sparkles className="w-4 h-4" />
              </button>
              <button className="w-9 h-9 rounded-lg flex items-center justify-center text-[#d4d4d4] hover:text-[#525252] hover:bg-[#f5f5f5] transition-colors cursor-pointer">
                <Command className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => handleSubmit()}
              disabled={!value.trim() || isLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                value.trim() && !isLoading
                  ? 'bg-[#1a1a1a] text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
                  : 'bg-[#f5f5f5] text-[#d4d4d4]'
              }`}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isLoading ? 'Building...' : 'Send'}</span>
            </button>
          </div>
        </div>

        {/* Suggestion pills */}
        {!isLoading && (
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => { setValue(s); setTimeout(() => handleSubmit(s), 100); }}
                className="px-3.5 py-2 bg-white border border-[#f0f0f0] rounded-lg text-[12px] text-[#a3a3a3] hover:text-[#525252] hover:border-[#e5e5e5] hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:-translate-y-px transition-all cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `animate-fadeIn` to globals.css**

In `src/app/globals.css`, add:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
```

- [ ] **Step 3: Commit**
```bash
git add src/components/insights/AiComposerHero.tsx src/app/globals.css
git commit -m "feat: AiComposerHero — premium input with ambient glow, suggestion pills, thinking state"
```

---

### Task 3: Wire Hero into Insights List Page

**Files:**
- Modify: `src/app/insights/(dashboard)/InsightsDashboardList.tsx`

- [ ] **Step 1: Add the hero above the dashboard grid**

Import the hero component and add it above the "Your Dashboards" section. Also add "AI Generated" badge support.

At the top of the file, add:
```tsx
import { AiComposerHero } from '@/components/insights/AiComposerHero';
```

Replace the current header section and wrap everything:
```tsx
return (
  <div className="max-w-6xl mx-auto">
    {/* AI Composer Hero */}
    <AiComposerHero />

    {/* Dashboard list */}
    <div className="px-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em]">
          Your Dashboards
        </div>
        {isAdmin && (
          <button onClick={handleCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#525252] bg-[#f5f5f5] hover:bg-[#ebebeb] cursor-pointer transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Dashboard
          </button>
        )}
      </div>

      {dashboards.length === 0 ? (
        // ... existing empty state
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map(d => (
            <DashboardCard key={d.id} dashboard={d} onDuplicate={handleDuplicate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  </div>
);
```

Remove the old `<h1>Insights</h1>` header and the old "New Dashboard" button placement — the hero replaces the header, and the "New Dashboard" button moves to the section subheader.

- [ ] **Step 2: Commit**
```bash
git add src/app/insights/\\(dashboard\\)/InsightsDashboardList.tsx
git commit -m "feat: wire AiComposerHero into insights list page"
```

---

### Task 4: Auto-Insights API + Widget Integration

**Files:**
- Create: `src/app/api/insights/ai/auto-insights/route.ts`
- Create: `src/components/insights/AiInsightLine.tsx`
- Modify: `src/components/insights/WidgetRenderer.tsx`

- [ ] **Step 1: Create the auto-insights endpoint**

```typescript
// src/app/api/insights/ai/auto-insights/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { callNIM } from '@/lib/nim';

const SYSTEM_PROMPT = `You are a concise marketing analytics advisor for OneForma (a data annotation company).

Given a set of widget data from a dashboard, generate ONE short insight per widget.

Rules:
1. Each insight is ONE sentence, max 120 characters
2. Focus on: what changed, why it matters, what to do about it
3. Classify each as: info (neutral observation), positive (good news), warning (needs attention), alert (urgent action needed)
4. Use specific numbers from the data, not vague statements
5. Never say "the data shows" — just state the insight directly

Respond with ONLY a JSON object:
{
  "widget-id-1": { "text": "insight text here", "type": "positive" },
  "widget-id-2": { "text": "insight text here", "type": "warning" }
}`;

export async function POST(request: NextRequest) {
  await requireAuth();
  const body = await request.json();
  const widgetData = body.widgets as Record<string, { type: string; title: string; summary: string }>;

  if (!widgetData || Object.keys(widgetData).length === 0) {
    return NextResponse.json({ insights: {} });
  }

  const userPrompt = Object.entries(widgetData)
    .map(([id, w]) => `Widget "${w.title}" (${w.type}):\n${w.summary}`)
    .join('\n\n');

  try {
    const raw = await callNIM(SYSTEM_PROMPT, userPrompt);
    let jsonStr = raw.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const insights = JSON.parse(jsonStr);
    return NextResponse.json({ insights });
  } catch (err) {
    console.error('[Auto-Insights] Error:', err);
    return NextResponse.json({ insights: {} });
  }
}
```

- [ ] **Step 2: Create the AiInsightLine component**

```tsx
// src/components/insights/AiInsightLine.tsx
"use client";

interface AiInsightLineProps {
  text: string;
  type: 'info' | 'positive' | 'warning' | 'alert';
}

const DOT_COLOR = {
  info: '#3b82f6',
  positive: '#22c55e',
  warning: '#f97316',
  alert: '#ef4444',
};

export function AiInsightLine({ text, type }: AiInsightLineProps) {
  return (
    <div className="mt-2 pt-2 border-t border-[#f5f5f5] flex items-start gap-1.5">
      <div
        className="w-[5px] h-[5px] rounded-full mt-[5px] shrink-0"
        style={{ backgroundColor: DOT_COLOR[type] }}
      />
      <span className="text-[11px] text-[#525252] leading-relaxed">{text}</span>
    </div>
  );
}
```

- [ ] **Step 3: Add insight rendering to WidgetRenderer**

In `src/components/insights/WidgetRenderer.tsx`, the insight line will be passed as a prop from the parent (DashboardGrid via a context or prop drilling). For Phase 1, we'll add a simple static integration point.

Add the import at top:
```tsx
import { AiInsightLine } from './AiInsightLine';
```

Add an optional `insight` prop to `WidgetRendererProps`:
```tsx
interface WidgetRendererProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
  isSelected?: boolean;
  onSelect?: (widgetId: string | null) => void;
  onRemove?: (widgetId: string) => void;
  insight?: { text: string; type: 'info' | 'positive' | 'warning' | 'alert' };
}
```

After the `</WidgetErrorBoundary>`, before the closing `</div>` of the content area, add:
```tsx
{insight && <AiInsightLine text={insight.text} type={insight.type} />}
```

- [ ] **Step 4: Commit**
```bash
git add src/app/api/insights/ai/auto-insights/route.ts src/components/insights/AiInsightLine.tsx src/components/insights/WidgetRenderer.tsx
git commit -m "feat: auto-insights API + AiInsightLine component + WidgetRenderer integration"
```

---

### Task 5: DashboardCard AI Badge

**Files:**
- Modify: `src/components/insights/DashboardCard.tsx`

- [ ] **Step 1: Add AI Generated badge**

Read the file first. In the card component, check if `dashboard.created_by === 'system'` for pre-built badge, or if the description contains "AI" for AI-generated badge.

Add after the dashboard title/description:
```tsx
{dashboard.description?.toLowerCase().includes('ai-generated') ? (
  <span className="inline-flex text-[9px] font-medium px-2 py-0.5 rounded bg-[#f0f9ff] text-[#3b82f6] mt-1">
    AI Generated
  </span>
) : dashboard.created_by === 'system' ? (
  <span className="inline-flex text-[9px] font-medium px-2 py-0.5 rounded bg-[#f5f5f5] text-[#a3a3a3] mt-1">
    Pre-built
  </span>
) : null}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/insights/DashboardCard.tsx
git commit -m "feat: AI Generated + Pre-built badges on dashboard cards"
```

---

### Task 6: Verify + Deploy

- [ ] **Step 1: TypeScript check**
```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 2: Deploy**
```bash
vercel --prod
vercel alias <url> nova-intake.vercel.app
```
