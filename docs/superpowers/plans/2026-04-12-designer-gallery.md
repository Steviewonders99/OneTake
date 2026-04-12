# Designer Gallery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ CRITICAL: This is a HIGH-STAKES ship.** The designer who will use this has incredibly high standards and hates AI slop. Every pixel matters. Every interaction must feel hand-crafted. Every empty state must have a specific message. NO generic UI patterns, NO placeholder text, NO rough edges. This is the component that earns or loses the designer's trust.

**Goal:** Replace the designer's flat asset grid with a platinum-level dark-canvas gallery organized by persona → version → format, with true aspect ratio previews, VQA scores, curated design notes, and quick actions.

**Architecture:** 8 focused components compose the gallery. `DesignerGallery` is the orchestrator. `PersonaTab` renders per-persona content. `VersionGroup` handles accordion expand/collapse. `FormatCard` renders each format at true aspect ratio. `AssetLightbox` provides fullscreen preview. `DesignNotes` shows curated metadata. `ThemeToggle` switches dark/light. The page file becomes a thin wrapper.

**Tech Stack:** Next.js App Router, React client components, Lucide React icons, inline styles (dark-first design tokens), existing `groupCreativesByVersion()` + `getThumbnailDimensions()` from `src/lib/channels.ts`.

**Spec:** `docs/superpowers/specs/2026-04-12-designer-portal-redesign-design.md`
**Mockup:** `.superpowers/brainstorm/12899-1776019875/content/01-designer-gallery-dark.html`

---

## Design Tokens (shared across all components)

Every component imports these tokens. NO hardcoded colors anywhere — always reference the token.

```typescript
// src/components/designer/gallery/tokens.ts

export const DARK = {
  bg: "#0F0F10",
  surface: "#141416",
  card: "#1A1A1E",
  border: "#2A2A2E",
  borderHover: "#3A3A3E",
  text: "#E8E8EA",
  textMuted: "#8A8A8E",
  textDim: "#6A6A6E",
  accent: "#6D28D9",
  accentSoft: "rgba(109,40,217,0.15)",
  vqaGood: "#22c55e",
  vqaOk: "#f59e0b",
  vqaBad: "#ef4444",
} as const;

export const LIGHT = {
  bg: "#FFFFFF",
  surface: "#F7F7F8",
  card: "#FFFFFF",
  border: "#E8E8EA",
  borderHover: "#D0D0D4",
  text: "#1A1A1A",
  textMuted: "#8A8A8E",
  textDim: "#B0B0B4",
  accent: "#6D28D9",
  accentSoft: "rgba(109,40,217,0.08)",
  vqaGood: "#16a34a",
  vqaOk: "#d97706",
  vqaBad: "#dc2626",
} as const;

export type Theme = typeof DARK;

export const FONT = {
  sans: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
  mono: "'SF Mono', 'Fira Code', monospace",
} as const;

// Figma logo SVG as a constant (5-color, used in multiple components)
export const FIGMA_ICON = `<svg width="13" height="13" viewBox="0 0 38 57" fill="none"><path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE"/><path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83"/><path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262"/><path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E"/><path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF"/></svg>`;
```

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/components/designer/gallery/tokens.ts` | Shared design tokens (dark/light themes, fonts, icons) |
| `src/components/designer/gallery/ThemeToggle.tsx` | Sun/moon toggle with localStorage persistence |
| `src/components/designer/gallery/DesignerGallery.tsx` | Main orchestrator — persona tabs, data grouping, theme context |
| `src/components/designer/gallery/PersonaContextCard.tsx` | Mini brief card — who, psychology, design guidance |
| `src/components/designer/gallery/VersionGroup.tsx` | Collapsible accordion — trigger + format grid + design notes |
| `src/components/designer/gallery/FormatCard.tsx` | Single format at true aspect ratio with hover actions |
| `src/components/designer/gallery/AssetLightbox.tsx` | Fullscreen preview with keyboard nav |
| `src/components/designer/gallery/DesignNotes.tsx` | Curated metadata (archetype, pillar, scene, intent) |

### Modified Files
| File | Changes |
|---|---|
| `src/app/designer/[id]/page.tsx` | Replace current workspace body with DesignerGallery |

---

## Task 1: Design Tokens + ThemeToggle

**Files:**
- Create: `src/components/designer/gallery/tokens.ts`
- Create: `src/components/designer/gallery/ThemeToggle.tsx`

- [ ] **Step 1: Create tokens file**

Create `src/components/designer/gallery/tokens.ts` with the exact content from the Design Tokens section above (DARK, LIGHT, FONT, FIGMA_ICON constants + Theme type).

- [ ] **Step 2: Create ThemeToggle component**

```tsx
"use client";

import { Sun, Moon } from "lucide-react";
import type { Theme } from "./tokens";
import { DARK, LIGHT } from "./tokens";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === DARK;
  return (
    <button
      onClick={onToggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: `1px solid ${theme.border}`,
        background: theme.surface,
        color: theme.textMuted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep -E "tokens|ThemeToggle"`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/designer/gallery/
git commit -m "feat(designer): add design tokens (dark/light themes) + ThemeToggle component"
```

---

## Task 2: PersonaContextCard

**Files:**
- Create: `src/components/designer/gallery/PersonaContextCard.tsx`

- [ ] **Step 1: Create PersonaContextCard**

The mini brief card showing WHO this persona is, their psychology, and design guidance tags. This gives the designer immediate context about the creative intent.

**Props:**
```tsx
interface PersonaContextCardProps {
  persona: Record<string, any>;
  theme: Theme;
}
```

**Content extracted from persona:**
- Name: `persona.persona_name || persona.name`
- Archetype: `persona.archetype`
- Demographics: `persona.age_range`, `persona.region`
- Description: `persona.lifestyle` (truncated to 120 chars)
- Psychology: `persona.psychology_profile.primary_bias`, `secondary_bias`
- Design guidance tags: derived from psychology type:
  - identity_appeal → "Large portrait", "Serif headlines", "Minimal decoration"
  - social_proof → "Badge-rich", "Avatar stack", "Numbers visible"

**Layout:** Horizontal card with persona initial avatar (gradient circle), name + description, and tag pills.

**Styling:** `background: theme.surface`, `border: 1px solid theme.border`, `borderRadius: 10`, `padding: 18px 22px`, flex row.

Avatar: 48px gradient circle (`#6D28D9` → `#E91E8C`) with first letter initial.

Tags: `background: theme.border`, `color: theme.textMuted`, `borderRadius: 6px`, `fontSize: 9px`. Psychology tags get special color: `color: #A78BFA`, `background: rgba(109,40,217,0.12)`.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep PersonaContextCard
git add src/components/designer/gallery/PersonaContextCard.tsx
git commit -m "feat(designer): add PersonaContextCard — mini brief with psychology tags for creative context"
```

---

## Task 3: FormatCard

**Files:**
- Create: `src/components/designer/gallery/FormatCard.tsx`

- [ ] **Step 1: Create FormatCard**

The most critical visual component — each format at TRUE aspect ratio with platform badge, VQA score, hover overlay with actions.

**Props:**
```tsx
interface FormatCardProps {
  asset: GeneratedAsset;
  format: FormatDef;
  theme: Theme;
  onClick: () => void;
  onDownload: () => void;
  onExportFigma: () => void;
}
```

**Layout:**
- Outer card: `padding: 6px` (inner breathing room), `borderRadius: 12px`, `border: 1px solid theme.border`
- Inner image area: `borderRadius: 8px`, overflow hidden, computed dimensions from `getThumbnailDimensions(format, 180)` (180px height baseline)
- `justify-content: space-evenly` on the parent grid handles horizontal distribution

**Badges:**
- Platform badge (top-left): `background: rgba(0,0,0,0.6)`, `backdropFilter: blur(6px)`, `fontSize: 9px`, shows format label + ratio
- VQA score (top-right): colored background (green/amber/red at 20% opacity), colored text, `fontSize: 10px`, shows percentage

**Hover overlay:**
- `position: absolute`, `inset: 0`, `background: rgba(0,0,0,0.5)`, `backdropFilter: blur(2px)`
- 3 action buttons centered: Download (Download icon), Edit (Zap icon), Figma (real 5-color Figma SVG)
- Each button: 36px square, `rgba(255,255,255,0.15)` background, `border: 1px solid rgba(255,255,255,0.2)`, `borderRadius: 8px`
- Show on hover via state: `const [hovered, setHovered] = useState(false)`

**Dimensions text below:** Monospace, `fontSize: 10px`, `color: theme.textMuted`, e.g., "1080 × 1080"

**Hover effect on card:** `transform: scale(1.02)`, `boxShadow: 0 8px 24px rgba(0,0,0,0.4)`, `borderColor: theme.borderHover`

**Image:** If `asset.blob_url` exists, render `<img>` with `object-fit: cover`. Else render gradient placeholder with aspect ratio text at low opacity.

**CRITICAL: Use `getThumbnailDimensions()` from `@/lib/channels`** for width/height computation. Import `FormatDef` from `@/lib/channels`.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep FormatCard
git add src/components/designer/gallery/FormatCard.tsx
git commit -m "feat(designer): add FormatCard — true aspect ratio preview with VQA score, hover actions, Figma icon"
```

---

## Task 4: DesignNotes

**Files:**
- Create: `src/components/designer/gallery/DesignNotes.tsx`

- [ ] **Step 1: Create DesignNotes**

Curated design metadata — NOT raw JSON dumps. Shows only meaningful, human-readable fields.

**Props:**
```tsx
interface DesignNotesProps {
  content: Record<string, any>;
  theme: Theme;
}
```

**Fields displayed (4 columns):**
1. **Archetype:** `content.archetype` — mapped to display names: "floating_props" → "Floating Props", "gradient_hero" → "Gradient Hero", "photo_feature" → "Photo Feature"
2. **Pillar:** `content.pillar` — capitalized: "earn" → "Earn"
3. **Scene:** `content.scene` or built from `content.setting` — human-readable
4. **Design Intent:** `content.design_intent` — from Phase 1 graphic copy output

**Layout:** Collapsed by default. Toggle link: purple text "Design Notes" with info circle icon. When expanded: 4-column grid with label (10px uppercase `theme.textDim`) + value (12px `theme.textMuted`).

**CRITICAL:** If a field is empty/undefined, HIDE the column entirely — never show "Unknown" or "N/A". The grid auto-adjusts to show only fields that have data.

Import `ARCHETYPE_LABELS` from `@/lib/channels` for display name mapping.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep DesignNotes
git add src/components/designer/gallery/DesignNotes.tsx
git commit -m "feat(designer): add DesignNotes — curated metadata display, never shows empty fields"
```

---

## Task 5: VersionGroup (Accordion)

**Files:**
- Create: `src/components/designer/gallery/VersionGroup.tsx`

- [ ] **Step 1: Create VersionGroup**

The collapsible accordion for each V-group. Contains the format grid + design notes.

**Props:**
```tsx
interface VersionGroupProps {
  version: VersionGroup;
  channelName: string;
  isExpanded: boolean;
  onToggle: () => void;
  theme: Theme;
  onAssetClick: (asset: GeneratedAsset) => void;
}
```

Import `VersionGroup` type as `VersionGroupType` from `@/lib/channels` (rename to avoid collision with component name).

**Trigger bar (always visible):**
- Flex row: chevron (rotates 90° when open) + V-badge + headline + format pills + VQA score + action buttons
- V-badge: `background: theme.border`, `borderRadius: 8px`, `width: 32px`, `height: 32px`, `fontSize: 12px`, `fontWeight: 700`, `fontFamily: FONT.sans`
- Headline: `fontSize: 14px`, `fontWeight: 600`, truncated with ellipsis
- Format pills: `fontSize: 10px`, `background: theme.border`, `borderRadius: 6px`, e.g., "Feed · Story · Carousel"
- VQA score: colored text (green ≥0.85, amber ≥0.70, red <0.70), `fontSize: 11px`, `fontWeight: 700`
- Action buttons (4): Download, Edit (Zap), Regenerate (RefreshCw), Figma (5-color SVG). Each `width: 30px`, `height: 30px`, `borderRadius: 6px`, `background: theme.border`, `border: 1px solid theme.borderHover`
- Padding: `14px 20px`
- Hover: `background: #222226` (or `theme.card` in light mode)

**Expanded body (toggle visibility):**
- Format grid: `display: flex`, `justifyContent: space-evenly`, `gap: 16px`, `padding: 24px`, `background: theme.surface`
- Render `FormatCard` for each asset in the version, computing dimensions via `getThumbnailDimensions`
- Match each asset to its format definition from `CHANNEL_DEFINITIONS[channelName].formats`
- Below format grid: `DesignNotes` component (collapsed by default)

**Accordion behavior:** Only ONE version expanded at a time — managed by parent via `isExpanded` prop.

**CRITICAL:** The format cards must be matched to their correct `FormatDef` for proper aspect ratio rendering. Match by checking if `asset.platform` includes the format key (e.g., `ig_feed` contains `feed`).

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep VersionGroup
git add src/components/designer/gallery/VersionGroup.tsx
git commit -m "feat(designer): add VersionGroup accordion — format grid with space-evenly, curated design notes"
```

---

## Task 6: AssetLightbox

**Files:**
- Create: `src/components/designer/gallery/AssetLightbox.tsx`

- [ ] **Step 1: Create AssetLightbox**

Fullscreen preview with keyboard navigation. This is where the designer inspects the creative at full resolution.

**Props:**
```tsx
interface AssetLightboxProps {
  asset: GeneratedAsset;
  allAssets: GeneratedAsset[]; // all assets in the version for nav
  onClose: () => void;
  onNavigate: (asset: GeneratedAsset) => void;
  theme: Theme;
}
```

**Layout:**
- Fixed overlay: `position: fixed`, `inset: 0`, `zIndex: 100`, `background: rgba(0,0,0,0.95)`
- Centered image: `maxWidth: 90vw`, `maxHeight: 80vh`, `objectFit: contain`, `borderRadius: 8px`
- Top bar: filename + dimensions + VQA score + platform badge. `position: absolute`, `top: 0`, `padding: 16px 24px`
- Bottom bar: Download, Edit, Figma Export buttons. `position: absolute`, `bottom: 0`, `padding: 16px 24px`
- Close button: top-right, X icon, 32px circle
- Nav arrows: left/right, positioned at vertical center, `width: 40px`, `height: 40px`, `borderRadius: 50%`, semi-transparent white

**Keyboard handling (useEffect):**
```tsx
useEffect(() => {
  function handleKey(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowLeft") navigatePrev();
    if (e.key === "ArrowRight") navigateNext();
  }
  window.addEventListener("keydown", handleKey);
  return () => window.removeEventListener("keydown", handleKey);
}, [currentIndex]);
```

**Click outside to close:** `onClick` on the overlay background calls `onClose`. `onClick` on the image and controls calls `e.stopPropagation()`.

**Image loading:** Show skeleton pulse while loading. Set `onLoad` handler to hide skeleton.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep AssetLightbox
git add src/components/designer/gallery/AssetLightbox.tsx
git commit -m "feat(designer): add AssetLightbox — fullscreen preview with keyboard nav and click-outside close"
```

---

## Task 7: DesignerGallery (Orchestrator)

**Files:**
- Create: `src/components/designer/gallery/DesignerGallery.tsx`

- [ ] **Step 1: Create DesignerGallery**

The main orchestrator. Manages theme state, persona tabs, version accordion state, lightbox state, and composes all sub-components.

**Props:**
```tsx
interface DesignerGalleryProps {
  request: IntakeRequest;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  actors: ActorProfile[];
  token: string;
}
```

**State:**
```tsx
const [theme, setTheme] = useState<Theme>(() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("nova-designer-theme") === "light" ? LIGHT : DARK;
  }
  return DARK;
});
const [activePersonaIdx, setActivePersonaIdx] = useState(0);
const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
const [lightboxAsset, setLightboxAsset] = useState<GeneratedAsset | null>(null);
```

**Theme toggle:**
```tsx
function toggleTheme() {
  const next = theme === DARK ? LIGHT : DARK;
  setTheme(next);
  localStorage.setItem("nova-designer-theme", theme === DARK ? "light" : "dark");
}
```

**Data grouping:**
1. Extract `personas` from `brief.brief_data.personas` (array)
2. For each persona, get their `archetype_key`
3. Filter `assets` to those matching `(asset.content as any)?.persona === archetype_key` OR match by actor name
4. For each persona's assets, use `groupCreativesByVersion()` to get V1-V5 groups
5. Since `groupCreativesByVersion` filters by channel, we need ALL channels' assets merged. Group by `(actor_name + pillar)` directly to get cross-channel versions.

**Custom version grouping** (cross-channel, unlike the channel-specific gallery):
```tsx
function groupAllVersions(personaAssets: GeneratedAsset[]): VersionGroupType[] {
  const composed = personaAssets.filter(a => a.asset_type === "composed_creative" && a.blob_url);
  const groups = new Map<string, GeneratedAsset[]>();
  for (const asset of composed) {
    const c = (asset.content || {}) as Record<string, string>;
    const key = `${c.actor_name || "unknown"}::${c.pillar || "earn"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(asset);
  }
  return Array.from(groups.entries())
    .sort(([, a], [, b]) => {
      const aT = Math.min(...a.map(x => new Date(x.created_at).getTime()));
      const bT = Math.min(...b.map(x => new Date(x.created_at).getTime()));
      return aT - bT;
    })
    .map(([, assets], idx) => {
      const c = (assets[0].content || {}) as Record<string, string>;
      const scores = assets.map(a => a.evaluation_score).filter((s): s is number => s != null && s > 0);
      const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
      return {
        versionLabel: `V${idx + 1}`,
        headline: c.overlay_headline || c.headline || "Untitled",
        archetype: c.archetype || "",
        pillar: c.pillar || "earn",
        actorName: c.actor_name || "",
        avgVqaScore: avg,
        formatCount: new Set(assets.map(a => a.platform)).size,
        assets,
      };
    });
}
```

**Layout structure:**
```tsx
<div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: FONT.sans, transition: "background 0.2s ease, color 0.2s ease" }}>
  {/* Header */}
  {/* Persona Tabs */}
  {/* Content: PersonaContextCard + VersionGroups */}
  {/* Lightbox (conditional) */}
</div>
```

**Header:** Campaign title, metadata (slug · count · status), ThemeToggle, Download All button, Submit Finals button (accent purple).

**Persona Tabs:** Horizontal pill tabs at top. Each shows `persona.persona_name + (assetCount)`. Active tab: `background: theme.accent`, `color: white`. Inactive: `color: theme.textMuted`, `border: 1px solid theme.border`.

**Content:** `PersonaContextCard` for the active persona, then map over versions rendering `VersionGroup` for each.

**Empty state:** If no composed creatives exist: centered message with `ImageIcon` (40px, muted) + "Pipeline is generating creatives for this campaign. Check back in 30 minutes."

**Lightbox integration:** When `lightboxAsset` is set, render `AssetLightbox` with all assets from the active version for navigation.

**Download All handler:** `window.open(\`/api/export/${request.id}?token=${token}&type=composed\`, "_blank")`

**Export Figma handler per asset:** `window.open(\`/api/export/figma/${asset.id}\`, "_blank")`

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/designer/gallery/DesignerGallery.tsx
git commit -m "feat(designer): add DesignerGallery orchestrator — persona tabs, version accordions, theme toggle, lightbox"
```

---

## Task 8: Wire Gallery into Designer Page

**Files:**
- Modify: `src/app/designer/[id]/page.tsx`

- [ ] **Step 1: Read the current file**

Read `src/app/designer/[id]/page.tsx` in full.

- [ ] **Step 2: Replace the workspace body with DesignerGallery**

Keep:
- All type definitions (`DesignerNote`, `DesignerUpload`, `DesignerData`)
- The data fetching `useEffect` (token validation, API call)
- The loading/error states
- The page export with Suspense

Replace: The entire `DesignerWorkspaceContent` render body. Remove the old `FilterTabs`, `DesignerAssetCard` grid, `CampaignContextCard`, `DownloadKit`, `UploadZone` renders.

Add import:
```tsx
import DesignerGallery from "@/components/designer/gallery/DesignerGallery";
```

Replace the workspace content (everything after loading/error checks) with:
```tsx
<DesignerGallery
  request={data.request}
  brief={data.brief}
  assets={data.assets}
  actors={data.actors}
  token={token}
/>
```

**Keep the old components importable** — don't delete them. They may still be used by the internal dashboard (`/designer` page without magic link).

- [ ] **Step 3: Verify TypeScript and tests**

```bash
npx tsc --noEmit 2>&1 | head -20
pnpm test 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/app/designer/[id]/page.tsx
git commit -m "feat(designer): wire DesignerGallery into magic-link workspace — replaces flat asset grid"
```

---

## Task 9: Visual QA Checklist

This is NOT a code task — it's a manual verification pass. The engineer must check each item against the mockup and the spec.

- [ ] **Step 1: Start dev server and open a campaign with creatives**

```bash
pnpm dev
# Open: http://localhost:3000/designer/{campaign-id}?token={valid-token}
```

- [ ] **Step 2: Visual verification checklist**

Check each item — if ANY fails, fix before committing:

**Typography:**
- [ ] ALL text uses system sans-serif (no Georgia, no serif anywhere)
- [ ] Headings are `font-weight: 700`, `letter-spacing: -0.3px`
- [ ] Monospace only on dimensions and VQA scores
- [ ] No "Untitled", "Unknown", or "N/A" text visible

**Dark theme:**
- [ ] Background is `#0F0F10` (not pure black)
- [ ] Cards are `#1A1A1E` with `#2A2A2E` borders
- [ ] Creatives pop against the dark background
- [ ] Text is `#E8E8EA` primary, `#8A8A8E` secondary

**Light theme toggle:**
- [ ] Sun/moon icon in header toggles the theme
- [ ] Light mode shows white background, dark text
- [ ] State persists after page reload (localStorage)
- [ ] Transition is smooth (200ms ease)

**Persona tabs:**
- [ ] All personas from the brief are shown
- [ ] Active tab has purple fill + white text
- [ ] Switching is instant (no loading spinner)
- [ ] Asset count badge shows correct number

**Version accordions:**
- [ ] V1 is expanded by default, others collapsed
- [ ] Clicking another version collapses the current one (single-open accordion)
- [ ] V-badge uses system sans-serif (NOT serif)
- [ ] Format pills show correct formats (Feed · Story · Carousel)
- [ ] VQA score is colored correctly (green/amber/red)

**Format grid:**
- [ ] Thumbnails are at TRUE aspect ratio (not square-cropped)
- [ ] `justify-content: space-evenly` — no dead space pooling on right
- [ ] 6px inner padding on cards, 8px border-radius on inner image
- [ ] Platform badge visible top-left
- [ ] VQA percentage visible top-right
- [ ] Dimensions text in monospace below each card

**Hover effects:**
- [ ] Card scales to 1.02 with elevated shadow on hover
- [ ] Overlay with 3 action icons appears (download, edit, Figma)
- [ ] Figma icon is the REAL 5-color logo (not a grid icon)

**Lightbox:**
- [ ] Click on format card opens fullscreen overlay
- [ ] Image shown at full resolution
- [ ] Arrow keys navigate between formats
- [ ] Escape closes the lightbox
- [ ] Click outside the image closes the lightbox

**Design notes:**
- [ ] "Design Notes" toggle link visible below format grid
- [ ] Click expands to show archetype, pillar, scene, design intent
- [ ] Empty fields are HIDDEN (not shown as "Unknown")

**Empty state:**
- [ ] If no composed creatives: shows specific message with icon
- [ ] NOT a generic "No data" message

- [ ] **Step 3: Fix any issues found, commit**

```bash
git add -A
git commit -m "fix(designer): visual QA fixes — [describe what was fixed]"
```
