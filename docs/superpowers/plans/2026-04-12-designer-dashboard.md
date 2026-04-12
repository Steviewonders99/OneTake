# Designer Dashboard (Workboard) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ HIGH-STAKES:** This is part of the designer portal overhaul. Platinum-level execution required.

**Goal:** Replace the designer dashboard's sidebar+panel layout with a Linear-style workboard — time-based greeting, collapsible sidebar, status-grouped campaign list with priority bars, VQA scores, persona chips, and progress indicators.

**Architecture:** 4 new components in `src/components/designer/dashboard/`. `DesignerDashboard` is the orchestrator that fetches campaigns, groups by status, manages sidebar state. `DashboardSidebar` handles collapse/expand. `StatusGroup` renders collapsible sections. `WorkItemRow` renders each campaign row. The page file becomes a thin wrapper.

**Tech Stack:** Next.js App Router, React client components, Lucide icons, inline styles using gallery design tokens (dark/light), existing `/api/intake` endpoint for campaign data.

**Spec:** `docs/superpowers/specs/2026-04-12-designer-portal-redesign-design.md` (Designer Dashboard section)
**Mockup:** `.superpowers/brainstorm/19266-1776029970/content/03-designer-workboard-v3.html`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/components/designer/dashboard/DashboardSidebar.tsx` | Collapsible sidebar (48px → 220px on hover) with nav + stats |
| `src/components/designer/dashboard/StatusGroup.tsx` | Collapsible status section header (amber/green/purple dot) |
| `src/components/designer/dashboard/WorkItemRow.tsx` | Single campaign row with priority, personas, VQA, progress |
| `src/components/designer/dashboard/DesignerDashboard.tsx` | Main orchestrator — fetches data, groups by status, greeting |

### Modified Files
| File | Changes |
|---|---|
| `src/app/designer/page.tsx` | Replace current layout with DesignerDashboard |

---

## Task 1: DashboardSidebar

**Files:**
- Create: `src/components/designer/dashboard/DashboardSidebar.tsx`

- [ ] **Step 1: Create DashboardSidebar**

"use client" component. Collapses to 48px, expands to 220px on hover with smooth 200ms transition. Text fades in after expansion.

**Props:**
```tsx
interface DashboardSidebarProps {
  theme: Theme;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  stats: { active: number; creatives: number; avgVqa: number; pendingReview: number };
}
```

Import `Theme, FONT` from `../gallery/tokens`. Import Lucide icons: `LayoutDashboard, AlertCircle, CheckCircle2, Star, RefreshCw, Image as ImageIcon`.

**Sidebar structure:**
- Workspace section: My Work (with count), Needs Review (with count), Completed
- Divider
- Filters section: High Priority, Recently Updated, All Campaigns
- Divider
- Quick Stats: Active, Creatives, Avg VQA (green), Pending review (amber)

**Collapse behavior:** Use CSS `width` transition on the outer div. When not hovered, labels and counts get `opacity: 0`. On hover, width expands and labels fade in with 150ms delay.

Use `onMouseEnter`/`onMouseLeave` with state `isExpanded` to control the width. Apply `overflow: hidden` always.

**Nav items:** Each is a button with icon + label + optional count badge. Active item has `background: theme.card`, `fontWeight: 600`. Active count badge uses purple (`#A78BFA` on `rgba(109,40,217,0.12)`).

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep DashboardSidebar
git add src/components/designer/dashboard/DashboardSidebar.tsx
git commit -m "feat(designer): add DashboardSidebar — collapsible 48→220px with nav, filters, stats"
```

---

## Task 2: StatusGroup + WorkItemRow

**Files:**
- Create: `src/components/designer/dashboard/StatusGroup.tsx`
- Create: `src/components/designer/dashboard/WorkItemRow.tsx`

- [ ] **Step 1: Create StatusGroup**

"use client" component. Collapsible section header with status dot + name + count.

**Props:**
```tsx
interface StatusGroupProps {
  status: "review" | "approved" | "generating" | "sent";
  label: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  theme: Theme;
  children: React.ReactNode;
}
```

Renders: chevron (rotates on expand) + colored dot + label + count. Children (WorkItemRows) shown/hidden based on `isExpanded`.

Dot colors: review=#f59e0b, approved=#22c55e, generating=#A78BFA (pulsing animation), sent=#22d3ee.

- [ ] **Step 2: Create WorkItemRow**

"use client" component. Single campaign row in the workboard.

**Props:**
```tsx
interface WorkItemRowProps {
  campaign: IntakeRequest;
  creativeCount: number;
  personaCount: number;
  personas: Array<{ name: string; initial: string; color: string }>;
  avgVqa: number;
  progress: number; // 0-100
  priority: "urgent" | "high" | "medium" | "low";
  theme: Theme;
  onClick: () => void;
  dimmed?: boolean; // for approved/generating rows
}
```

**Grid columns:** `24px 1fr 120px 80px 80px 100px 130px 40px`

Elements:
1. Priority bar (4px wide, 28px tall, colored by priority: red/amber/blue/gray)
2. Campaign info: title (15px bold, ellipsis) + meta (12px muted: slug · channels)
3. Persona chips: overlapping avatar circles with initials
4. Creative count: number with image icon
5. VQA score: colored percentage (green/amber/red)
6. Created date: neutral gray, clock icon
7. Progress bar: track (#2A2A2E) + fill (colored by completion) + percentage text
8. Arrow icon (muted, brighter on hover)

`dimmed` prop applies `opacity: 0.6` for approved/generating rows.

Row hover: `background: theme.surface`.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "StatusGroup|WorkItemRow"
git add src/components/designer/dashboard/StatusGroup.tsx src/components/designer/dashboard/WorkItemRow.tsx
git commit -m "feat(designer): add StatusGroup + WorkItemRow — status-grouped list with priority, VQA, progress"
```

---

## Task 3: DesignerDashboard Orchestrator

**Files:**
- Create: `src/components/designer/dashboard/DesignerDashboard.tsx`

- [ ] **Step 1: Create DesignerDashboard**

"use client" component. Main orchestrator — fetches campaigns, computes stats, groups by status, renders greeting + sidebar + workboard.

**Props:** None — fetches its own data.

**State:**
```tsx
const [theme, setTheme] = useState<Theme>(() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("nova-designer-theme") === "light" ? LIGHT : DARK;
  }
  return DARK;
});
const [campaigns, setCampaigns] = useState<IntakeRequest[]>([]);
const [loading, setLoading] = useState(true);
const [activeFilter, setActiveFilter] = useState("all");
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["review"])); // review expanded by default
const [userName, setUserName] = useState("Designer");
```

**Data fetching:**
```tsx
useEffect(() => {
  Promise.all([
    fetch("/api/intake").then(r => r.ok ? r.json() : []),
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null),
  ]).then(([camps, user]) => {
    setCampaigns(camps.filter((c: any) => c.status !== "draft"));
    if (user?.firstName) setUserName(user.firstName);
    setLoading(false);
  }).catch(() => setLoading(false));
}, []);
```

**Time-based greeting:**
```tsx
const hour = new Date().getHours();
const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
```

**Status grouping:**
```tsx
const grouped = useMemo(() => ({
  review: campaigns.filter(c => c.status === "review" || c.status === "approved"), // needs designer review
  approved: campaigns.filter(c => c.status === "sent"),
  generating: campaigns.filter(c => c.status === "generating"),
}), [campaigns]);
```

Note: Map statuses appropriately — "review" and "approved" (pre-agency-send) both need designer attention. "sent" means fully delivered. Adjust the grouping logic based on actual status values in the system.

**Stats computation:**
```tsx
const stats = useMemo(() => ({
  active: campaigns.length,
  creatives: 0, // would need asset count API — placeholder for now
  avgVqa: 0, // would need aggregate — placeholder
  pendingReview: grouped.review.length,
}), [campaigns, grouped]);
```

**Layout:**
```tsx
<div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: FONT.sans, display: "flex", flexDirection: "column", transition: "background 0.2s ease, color 0.2s ease" }}>
  {/* Top bar */}
  {/* Sidebar + Main in flex row */}
  <div style={{ display: "flex", flex: 1 }}>
    <DashboardSidebar theme={theme} ... />
    <div style={{ flex: 1, overflowY: "auto" }}>
      {/* Greeting header */}
      {/* Column headers (sticky) */}
      {/* StatusGroup sections */}
    </div>
  </div>
</div>
```

**Top bar:** Nova logo + "Creative Studio" + divider + theme toggle (sun/moon) + user avatar with initial.

**Column headers:** Sticky row with: (blank) | Campaign | Personas | Creatives | VQA | Created | Progress | (blank). `fontSize: 12px`, uppercase, `color: theme.textDim`.

**Campaign click handler:** `router.push(\`/designer/\${campaign.id}\`)` — navigates to the gallery view.

**Persona data:** For the initial version, derive from campaign title or use placeholder initials. Full persona data would require a brief fetch per campaign — defer to future enhancement. Use first letter of campaign title + colored gradient as placeholder.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/designer/dashboard/DesignerDashboard.tsx
git commit -m "feat(designer): add DesignerDashboard — time greeting, status-grouped workboard, theme toggle"
```

---

## Task 4: Wire Dashboard into Page

**Files:**
- Modify: `src/app/designer/page.tsx`

- [ ] **Step 1: Replace current layout with DesignerDashboard**

Read `src/app/designer/page.tsx`. Replace the entire component with:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import DesignerDashboard from "@/components/designer/dashboard/DesignerDashboard";

export default function DesignerPortal() {
  const router = useRouter();

  // Auth gate — redirect non-designers
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.role && !["designer", "admin"].includes(data.role)) {
          router.push("/");
        }
      })
      .catch(() => {});
  }, [router]);

  return <DesignerDashboard />;
}
```

Note: NO `AppShell` wrapper — the dashboard has its own full-viewport layout with custom top bar and sidebar. AppShell would add a conflicting nav.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -10
pnpm test 2>&1 | tail -5
git add src/app/designer/page.tsx
git commit -m "feat(designer): wire DesignerDashboard into /designer page — Linear-style workboard"
```
