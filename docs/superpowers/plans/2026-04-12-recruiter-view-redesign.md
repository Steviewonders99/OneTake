# Recruiter View Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the recruiter portal into an enterprise-grade experience with collapsible messaging accordion, standalone link builder side panel, and deep-dive dashboard tab.

**Architecture:** Two-column layout (creative library left + sticky link builder right) on the "Assets & Creatives" tab, with a new "Dashboard" tab replacing the old Performance tab. Stats row fetched once in RecruiterWorkspace and shared. Enterprise OneForma color system — grayscale dominant, deep purple `#6D28D9` accent used sparingly.

**Tech Stack:** Next.js App Router, React client components, Lucide React icons, Tailwind-free (inline styles matching OneForma design tokens), existing Neon Postgres via `getDb()`.

**Spec:** `docs/superpowers/specs/2026-04-12-recruiter-view-redesign-design.md`
**Mockup:** `.superpowers/brainstorm/89475-1775994931/content/05-enterprise-v5.html`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/components/recruiter/MessagingAccordion.tsx` | Collapsible campaign messaging briefing (5 sections) |
| `src/components/recruiter/DashboardTab.tsx` | Full analytics dashboard — stats, charts, table |
| `src/components/recruiter/ChannelBarChart.tsx` | CSS-only horizontal bar chart for channel clicks |
| `src/components/recruiter/TopPerformers.tsx` | Top 5 leaderboard by click count |
| `src/components/recruiter/LinksTable.tsx` | Searchable, paginated, exportable links table |
| `src/components/recruiter/StatsRow.tsx` | 4 stat cards (creatives, links, clicks, top channel) |

### Modified Files
| File | Changes |
|---|---|
| `src/lib/types.ts` | Add `clicks_today`, `recruiter_count`, `channel_count` to `TrackedLinksSummary` |
| `src/app/api/tracked-links/route.ts` | Compute new summary fields, add `limit`/`utm_term` query params |
| `src/components/recruiter/RecruiterWorkspace.tsx` | New tab structure, 2-col layout, fetch tracked links, stats row |
| `src/components/recruiter/CreativeLibrary.tsx` | Remove bottom padding, remove LinkBuilderBar import |
| `src/components/recruiter/CreativeGrid.tsx` | Enterprise card styling with deep purple selection |
| `src/components/recruiter/LinkBuilderBar.tsx` | Transform from sticky footer → sticky side panel with recent links |

### Deleted Files
| File | Reason |
|---|---|
| `src/components/recruiter/PerformanceTab.tsx` | Replaced by DashboardTab |

---

## Task 1: Update Types + API

**Files:**
- Modify: `src/lib/types.ts:465-475`
- Modify: `src/app/api/tracked-links/route.ts:234-270`

- [ ] **Step 1: Add new fields to TrackedLinksSummary type**

In `src/lib/types.ts`, update the `TrackedLinksSummary` interface:

```typescript
export interface TrackedLinksSummary {
  total_clicks: number;
  total_links: number;
  best_channel: { name: string; clicks: number; pct: number } | null;
  top_creative: { name: string; clicks: number; asset_id: string | null } | null;
  clicks_today: number;
  recruiter_count: number;
  channel_count: number;
}
```

- [ ] **Step 2: Update GET handler to compute new summary fields and support query params**

In `src/app/api/tracked-links/route.ts`, after the existing `request_id` param parsing (line 177), add `limit` and `utm_term` query param parsing:

```typescript
  const request_id = url.searchParams.get('request_id');
  if (!request_id) {
    return Response.json({ error: 'request_id query param required' }, { status: 400 });
  }
  const limitParam = url.searchParams.get('limit');
  const utmTermFilter = url.searchParams.get('utm_term');
```

Then, after the links are built (line 232), add filtering and new summary computation. Replace the summary block (lines 234-269) with:

```typescript
  // Apply optional utm_term filter
  let filteredLinks = links;
  if (utmTermFilter) {
    filteredLinks = links.filter((l) => l.utm_term === utmTermFilter);
  }

  // Apply optional limit
  const limitedLinks = limitParam ? filteredLinks.slice(0, parseInt(limitParam, 10)) : filteredLinks;

  // Compute summary aggregates (always from full unfiltered set for accuracy)
  const total_clicks = links.reduce((s, l) => s + l.click_count, 0);
  const total_links = links.length;

  // Best channel: group by utm_source, sum clicks, find max
  const channelTotals = new Map<string, number>();
  for (const l of links) {
    channelTotals.set(l.utm_source, (channelTotals.get(l.utm_source) ?? 0) + l.click_count);
  }
  let best_channel: { name: string; clicks: number; pct: number } | null = null;
  if (channelTotals.size > 0 && total_clicks > 0) {
    const sortedChannels = [...channelTotals.entries()].sort((a, b) => b[1] - a[1]);
    const [name, clicks] = sortedChannels[0];
    best_channel = { name, clicks, pct: Math.round((clicks / total_clicks) * 100) };
  }

  // Top creative: the link with the highest click count (must be > 0)
  let top_creative: { name: string; clicks: number; asset_id: string | null } | null = null;
  const topLink = links[0];
  if (topLink && topLink.click_count > 0) {
    top_creative = {
      name: topLink.utm_content,
      clicks: topLink.click_count,
      asset_id: topLink.asset_id,
    };
  }

  // New summary fields
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  const clicks_today = links.reduce((s, l) => {
    if (l.last_clicked_at && l.last_clicked_at >= todayISO) return s + l.click_count;
    return s;
  }, 0);
  const recruiter_count = new Set(links.map((l) => l.utm_term)).size;
  const channel_count = channelTotals.size;

  return Response.json({
    links: limitedLinks,
    summary: {
      total_clicks,
      total_links,
      best_channel,
      top_creative,
      clicks_today,
      recruiter_count,
      channel_count,
    },
  });
```

**Note:** `clicks_today` is an approximation — it checks `last_clicked_at >= today` but counts the full `click_count` for those links. For exact daily counts we'd need a separate SQL query with date filtering, but this is good enough for a dashboard stat. A future enhancement can add a `clicked_at` events table for precise daily breakdowns.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors (or only pre-existing ones unrelated to tracked-links)

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/app/api/tracked-links/route.ts
git commit -m "feat(api): add clicks_today, recruiter_count, channel_count to tracked-links summary; add limit/utm_term query params"
```

---

## Task 2: StatsRow Component

**Files:**
- Create: `src/components/recruiter/StatsRow.tsx`

- [ ] **Step 1: Create StatsRow component**

```tsx
"use client";

import type { TrackedLinksSummary } from "@/lib/types";

interface StatsRowProps {
  approvedCount: number;
  channelCount: number;
  summary: TrackedLinksSummary | null;
}

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  reddit: "Reddit",
  job_board: "Job Board",
  social: "Social",
  email: "Email",
  internal: "Internal",
  influencer: "Influencer",
};

export default function StatsRow({ approvedCount, channelCount, summary }: StatsRowProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 14,
        marginBottom: 22,
      }}
    >
      <StatCard label="Creatives" value={String(approvedCount)} sub={`Across ${channelCount} channels`} />
      <StatCard
        label="Links Created"
        value={String(summary?.total_links ?? 0)}
        sub={`By ${summary?.recruiter_count ?? 0} recruiters`}
      />
      <StatCard
        label="Total Clicks"
        value={String(summary?.total_clicks ?? 0)}
        sub={summary?.clicks_today ? `+${summary.clicks_today} today` : "No clicks yet"}
      />
      <StatCard
        label="Top Channel"
        value={
          summary?.best_channel
            ? CHANNEL_LABEL[summary.best_channel.name] ?? summary.best_channel.name
            : "—"
        }
        valueFontSize={summary?.best_channel ? 20 : 32}
        sub={
          summary?.best_channel
            ? `${summary.best_channel.clicks} clicks · ${summary.best_channel.pct}%`
            : "No data yet"
        }
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueFontSize = 32,
}: {
  label: string;
  value: string;
  sub: string;
  valueFontSize?: number;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 10,
        padding: 18,
        border: "1px solid #E8E8EA",
        transition: "box-shadow 0.2s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: 0.5,
          color: "#8A8A8E",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: valueFontSize,
          fontWeight: 800,
          letterSpacing: -1,
          lineHeight: 1,
          color: "#1A1A1A",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#8A8A8E", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep StatsRow`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/recruiter/StatsRow.tsx
git commit -m "feat(ui): add StatsRow component — 4 enterprise stat cards for recruiter view"
```

---

## Task 3: MessagingAccordion Component

**Files:**
- Create: `src/components/recruiter/MessagingAccordion.tsx`

- [ ] **Step 1: Create MessagingAccordion component**

```tsx
"use client";

import { useState } from "react";
import { ChevronRight, Check, X, MessageSquare } from "lucide-react";
import { extractField } from "@/lib/format";
import type { CreativeBrief } from "@/lib/types";

interface MessagingAccordionProps {
  brief: CreativeBrief | null;
}

export default function MessagingAccordion({ brief }: MessagingAccordionProps) {
  const [open, setOpen] = useState(false);

  const briefData = brief?.brief_data as Record<string, unknown> | undefined;
  const messaging = briefData?.messaging_strategy as Record<string, unknown> | undefined;

  if (!messaging) return null;

  const primaryMessage = extractField(messaging, "primary_message") || "";
  const toneRaw = messaging?.tone;
  const tones: string[] = Array.isArray(toneRaw)
    ? toneRaw.filter((t): t is string => typeof t === "string")
    : typeof toneRaw === "string"
      ? [toneRaw]
      : [];
  const targetAudience = extractField(messaging, "target_audience") || "";

  const rawVP =
    (messaging?.value_propositions as unknown[]) ??
    (briefData?.value_props as unknown[]) ??
    [];
  const valueProps: string[] = rawVP
    .map((v) => (typeof v === "string" ? v : ""))
    .filter(Boolean);

  const dos = (messaging?.dos as string[] | undefined) ?? [];
  const donts = (messaging?.donts as string[] | undefined) ?? [];
  const channelGuidance = (messaging?.channel_guidance as Record<string, string> | undefined) ?? {};

  const hasContent = primaryMessage || tones.length > 0 || valueProps.length > 0;
  if (!hasContent) return null;

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left" as const,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#FAFAFA"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
      >
        <ChevronRight
          size={14}
          style={{
            color: "#8A8A8E",
            transition: "transform 0.2s",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
        <MessageSquare size={14} style={{ color: "#8A8A8E" }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>
          Campaign Messaging & Guidance
        </span>
        <span style={{ fontSize: 11, color: "#8A8A8E", marginLeft: "auto" }}>
          {open ? "Click to collapse" : "Click to expand"}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #E8E8EA", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Key Message */}
          {primaryMessage && (
            <div>
              <SectionLabel>Key Message</SectionLabel>
              <div
                style={{
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: "#333",
                  padding: "16px 20px",
                  background: "#F7F7F8",
                  borderRadius: 8,
                  borderLeft: "3px solid #6D28D9",
                  fontStyle: "italic",
                }}
              >
                {primaryMessage}
              </div>
            </div>
          )}

          {/* Tone + Audience */}
          {(tones.length > 0 || targetAudience) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {tones.length > 0 && (
                <div>
                  <SectionLabel>Tone & Voice</SectionLabel>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {tones.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "4px 14px",
                          borderRadius: 9999,
                          background: "#F7F7F8",
                          color: "#32373C",
                          border: "1px solid #E8E8EA",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {targetAudience && (
                <div>
                  <SectionLabel>Target Audience</SectionLabel>
                  <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>{targetAudience}</div>
                </div>
              )}
            </div>
          )}

          {/* Value Props */}
          {valueProps.length > 0 && (
            <div>
              <SectionLabel>Value Propositions</SectionLabel>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {valueProps.map((vp, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 13,
                      color: "#444",
                      padding: "6px 0",
                      borderBottom: i < valueProps.length - 1 ? "1px solid #E8E8EA" : "none",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    <Check size={14} style={{ color: "#6D28D9", flexShrink: 0, marginTop: 2 }} />
                    {vp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Do's and Don'ts */}
          {(dos.length > 0 || donts.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {dos.length > 0 && (
                <div>
                  <SectionLabel>Do&apos;s</SectionLabel>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {dos.map((d, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: 13,
                          color: "#444",
                          padding: "6px 0",
                          borderBottom: i < dos.length - 1 ? "1px solid #E8E8EA" : "none",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          lineHeight: 1.5,
                        }}
                      >
                        <Check size={14} style={{ color: "#6D28D9", flexShrink: 0, marginTop: 2 }} />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {donts.length > 0 && (
                <div>
                  <SectionLabel>Don&apos;ts</SectionLabel>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {donts.map((d, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: 13,
                          color: "#444",
                          padding: "6px 0",
                          borderBottom: i < donts.length - 1 ? "1px solid #E8E8EA" : "none",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          lineHeight: 1.5,
                        }}
                      >
                        <X size={14} style={{ color: "#DC2626", flexShrink: 0, marginTop: 2 }} />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Channel Guidance */}
          {Object.keys(channelGuidance).length > 0 && (
            <div>
              <SectionLabel>Channel-Specific Guidance</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {Object.entries(channelGuidance).map(([channel, text]) => (
                  <div
                    key={channel}
                    style={{
                      padding: 14,
                      borderRadius: 8,
                      background: "#F7F7F8",
                      border: "1px solid #E8E8EA",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1A1A", marginBottom: 6 }}>
                      {channel}
                    </div>
                    <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>{text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: 0.8,
        color: "#8A8A8E",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep MessagingAccordion`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/recruiter/MessagingAccordion.tsx
git commit -m "feat(ui): add MessagingAccordion — collapsible campaign messaging briefing for recruiters"
```

---

## Task 4: Enterprise CreativeGrid Restyle

**Files:**
- Modify: `src/components/recruiter/CreativeGrid.tsx`

- [ ] **Step 1: Restyle CreativeGrid with enterprise design tokens**

Replace the entire content of `src/components/recruiter/CreativeGrid.tsx`:

```tsx
"use client";

import { Copy, Download, Check } from "lucide-react";
import { toast } from "sonner";
import { extractField } from "@/lib/format";
import type { GeneratedAsset } from "@/lib/types";

interface CreativeGridProps {
  assets: GeneratedAsset[];
  selectedAssetId: string | null;
  onSelect: (asset: GeneratedAsset) => void;
}

function getOrganicCaption(asset: GeneratedAsset): string {
  return (
    extractField(asset.copy_data, "primary_text") ||
    extractField(asset.copy_data, "caption") ||
    extractField(asset.copy_data, "hook") ||
    extractField(asset.content, "overlay_sub") ||
    ""
  );
}

function getHeadline(asset: GeneratedAsset): string {
  return (
    extractField(asset.content, "overlay_headline") ||
    extractField(asset.copy_data, "headline") ||
    ""
  );
}

function getFormatLabel(asset: GeneratedAsset): string {
  if (!asset.format) return "";
  const parts = asset.format.split("x");
  if (parts.length === 2) return `${parts[0]} x ${parts[1]}`;
  return asset.format;
}

function getPersonaName(asset: GeneratedAsset): string {
  const name = extractField(asset.content, "persona_name") || extractField(asset.content, "actor_name") || "";
  if (!name) return "";
  // Shorten to "FirstName L."
  const parts = name.split(" ");
  if (parts.length >= 2) return `${parts[0]} ${parts[1][0]}.`;
  return name;
}

export default function CreativeGrid({ assets, selectedAssetId, onSelect }: CreativeGridProps) {
  if (assets.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0", fontSize: 13, color: "#8A8A8E" }}>
        No creatives for this channel yet.
      </div>
    );
  }

  async function handleCopyCaption(e: React.MouseEvent, caption: string) {
    e.stopPropagation();
    if (!caption) { toast.error("No caption available"); return; }
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Caption copied to clipboard");
    } catch { toast.error("Could not copy caption"); }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "16px 18px" }}>
      {assets.map((asset) => {
        const selected = asset.id === selectedAssetId;
        const headline = getHeadline(asset);
        const caption = getOrganicCaption(asset);
        const format = getFormatLabel(asset);
        const persona = getPersonaName(asset);

        return (
          <button
            key={asset.id}
            onClick={() => onSelect(asset)}
            style={{
              textAlign: "left" as const,
              background: "#FFFFFF",
              borderRadius: 10,
              overflow: "hidden",
              cursor: "pointer",
              transition: "all 0.15s",
              border: selected ? "1px solid #6D28D9" : "1px solid #E8E8EA",
              boxShadow: selected ? "0 0 0 2px rgba(109,40,217,0.1)" : "none",
              fontFamily: "inherit",
              padding: 0,
            }}
            onMouseEnter={(e) => {
              if (!selected) {
                e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.07)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!selected) {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "none";
              }
            }}
          >
            <div style={{ aspectRatio: "1", position: "relative", overflow: "hidden", background: "#EBEBEB" }}>
              {asset.blob_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.blob_url} alt={headline || "Creative"} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, opacity: 0.08, color: "#1A1A1A" }}>
                  {asset.format?.includes("x") ? (() => { const [w, h] = asset.format.split("x").map(Number); return w && h ? `${(w / h).toFixed(w === h ? 0 : 1)}:${w === h ? "1" : "1"}` : ""; })() : ""}
                </div>
              )}
              {format && (
                <div style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", color: "white", fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 5 }}>
                  {format}
                </div>
              )}
              {persona && (
                <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(6px)", color: "#1A1A1A", fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 5 }}>
                  {persona}
                </div>
              )}
              {selected && (
                <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: "50%", background: "#6D28D9", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={11} strokeWidth={3} />
                </div>
              )}
            </div>
            <div style={{ padding: "10px 12px" }}>
              {headline && (
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 6, color: "#1A1A1A", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                  {headline}
                </div>
              )}
              <div style={{ display: "flex", gap: 5 }}>
                <button
                  type="button"
                  onClick={(e) => handleCopyCaption(e, caption)}
                  disabled={!caption}
                  style={{
                    flex: 1, fontSize: 10, fontWeight: 600, padding: "5px 0",
                    borderRadius: 6, textAlign: "center" as const, cursor: caption ? "pointer" : "default",
                    border: "1px solid #E8E8EA", background: "white", color: "#8A8A8E",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                    opacity: caption ? 1 : 0.5,
                    fontFamily: "inherit",
                  }}
                >
                  <Copy size={10} /> Copy
                </button>
                {asset.blob_url && (
                  <a
                    href={asset.blob_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    download
                    style={{
                      flex: "0 0 auto", padding: "5px 7px", borderRadius: 6,
                      border: "1px solid #E8E8EA", background: "white", color: "#8A8A8E",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <Download size={10} />
                  </a>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep CreativeGrid`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/recruiter/CreativeGrid.tsx
git commit -m "feat(ui): enterprise restyle CreativeGrid — deep purple selection, format/persona badges, hover lift"
```

---

## Task 5: Transform LinkBuilderBar → Side Panel

**Files:**
- Modify: `src/components/recruiter/LinkBuilderBar.tsx`

- [ ] **Step 1: Refactor LinkBuilderBar into a sticky side panel with recent links**

This is a significant refactor. The component keeps all its existing logic (source/content dropdowns, landing page polling, UTM generation) but changes from a sticky bottom bar to a sticky side panel card. Add "Attached Creative" optional display and "Recent Links" section.

Read the current file first, then replace entirely. The key changes:
- Remove `sticky bottom-0` positioning — the parent grid handles stickiness
- Add optional creative attachment display with remove button
- Add recent links section at the bottom
- Enterprise styling (rounded panels, muted labels, charcoal button)
- Remove the `readinessState === "disabled"` full-bar amber warning — replace with inline message in the panel

The full replacement file is large (~350 lines). Key structural changes:

1. **Wrapper**: Change from `sticky bottom-0` to a regular `div` (parent handles sticky positioning)
2. **Panel card**: Wrap in white card with border, header with Link icon + title
3. **Attached Creative**: New section showing selected asset thumbnail + name + "×" remove, or dashed empty state
4. **Form fields**: Same fields (Source, Platform, Tag, Destination) in 2x2 grid, but with enterprise input styling
5. **URL Preview**: Dark bar with green dot
6. **Generate button**: Full-width charcoal pill
7. **Recent Links**: Fetch last 3 links on mount, show below the form
8. **Readiness gate**: Show amber inline message inside the card, not a full-width bar

Add a new prop `onDetachCreative: () => void` so the parent can clear the selected asset.

Add a `useEffect` to fetch recent links:
```tsx
const [recentLinks, setRecentLinks] = useState<TrackedLinkWithAsset[]>([]);
useEffect(() => {
  fetch(`/api/tracked-links?request_id=${requestId}&limit=3`)
    .then((r) => r.ok ? r.json() : null)
    .then((data) => { if (data?.links) setRecentLinks(data.links); })
    .catch(() => {});
}, [requestId]);
```

After a successful link creation, prepend the new link to `recentLinks` (optimistic update):
```tsx
// Inside handleCopyLink success handler, after toast:
setRecentLinks((prev) => [{ ...data, short_url: data.short_url } as TrackedLinkWithAsset, ...prev].slice(0, 3));
```

The component interface changes to:
```tsx
interface LinkBuilderBarProps {
  requestId: string;
  campaignSlug: string | null;
  activeChannel: string;
  selectedAsset: GeneratedAsset | null;
  recruiterInitials: string;
  onDetachCreative: () => void;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep LinkBuilder`
Expected: errors about `onDetachCreative` prop missing at call sites (will be fixed in Task 7)

- [ ] **Step 3: Commit**

```bash
git add src/components/recruiter/LinkBuilderBar.tsx
git commit -m "feat(ui): transform LinkBuilderBar from sticky footer to side panel with recent links + optional creative"
```

---

## Task 6: Dashboard Sub-Components

**Files:**
- Create: `src/components/recruiter/ChannelBarChart.tsx`
- Create: `src/components/recruiter/TopPerformers.tsx`
- Create: `src/components/recruiter/LinksTable.tsx`

- [ ] **Step 1: Create ChannelBarChart**

```tsx
"use client";

import type { TrackedLinkWithAsset } from "@/lib/types";

const CHANNEL_LABEL: Record<string, string> = {
  social: "Social", job_board: "Job Board", email: "Email",
  internal: "Internal", influencer: "Influencer",
  linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", reddit: "Reddit",
};

const BAR_SHADES = ["#32373C", "#555555", "#737373", "#999999", "#B0B0B0", "#CCCCCC"];

interface ChannelBarChartProps { links: TrackedLinkWithAsset[]; }

export default function ChannelBarChart({ links }: ChannelBarChartProps) {
  const totals = new Map<string, number>();
  for (const l of links) {
    totals.set(l.utm_source, (totals.get(l.utm_source) ?? 0) + l.click_count);
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] ?? 1;

  if (sorted.length === 0) {
    return <div style={{ padding: 18, fontSize: 13, color: "#8A8A8E", textAlign: "center" }}>No link data yet.</div>;
  }

  const totalClicks = sorted.reduce((s, [, c]) => s + c, 0);

  return (
    <div style={{ padding: 18 }}>
      {sorted.map(([channel, clicks], i) => {
        const pct = totalClicks > 0 ? Math.round((clicks / totalClicks) * 100) : 0;
        const widthPct = Math.max((clicks / max) * 100, 8);
        return (
          <div key={channel} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, width: 76, textAlign: "right" as const, color: "#1A1A1A" }}>
              {CHANNEL_LABEL[channel] ?? channel}
            </div>
            <div style={{ flex: 1, height: 22, background: "#F7F7F8", borderRadius: 5, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${widthPct}%`,
                  background: BAR_SHADES[Math.min(i, BAR_SHADES.length - 1)],
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "white",
                  minWidth: 32,
                }}
              >
                {pct}%
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, width: 34, textAlign: "right" as const, color: "#1A1A1A" }}>{clicks}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create TopPerformers**

```tsx
"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { TrackedLinkWithAsset } from "@/lib/types";

const CHANNEL_LABEL: Record<string, string> = {
  social: "Social", job_board: "Job Board", email: "Email",
  internal: "Internal", influencer: "Influencer",
};

interface TopPerformersProps { links: TrackedLinkWithAsset[]; }

export default function TopPerformers({ links }: TopPerformersProps) {
  const top5 = links
    .filter((l) => l.click_count > 0)
    .sort((a, b) => b.click_count - a.click_count)
    .slice(0, 5);

  if (top5.length === 0) {
    return <div style={{ padding: 18, fontSize: 13, color: "#8A8A8E", textAlign: "center" }}>No clicks yet.</div>;
  }

  return (
    <div style={{ padding: 18 }}>
      {top5.map((link, i) => (
        <div
          key={link.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 0",
            borderBottom: i < top5.length - 1 ? "1px solid #F7F7F8" : "none",
          }}
        >
          <div
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: i === 0 ? "#fef3c7" : "#F7F7F8",
              color: i === 0 ? "#92400e" : "#32373C",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, flexShrink: 0,
            }}
          >
            {i + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: 11, fontWeight: 600, color: "#1A1A1A" }}>
              {link.short_url.replace(/^https?:\/\/[^/]+/, "")}
            </div>
            <div style={{ fontSize: 10, color: "#8A8A8E" }}>
              {CHANNEL_LABEL[link.utm_source] ?? link.utm_source} · {link.utm_term}
              {link.asset_thumbnail ? "" : " · No creative"}
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1A1A1A" }}>{link.click_count}</div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(link.short_url).then(
                () => toast.success("Link copied!"),
                () => toast.error("Could not copy")
              );
            }}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: "1px solid #E8E8EA", background: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#8A8A8E",
            }}
          >
            <Copy size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create LinksTable**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Copy, ExternalLink, Search, SlidersHorizontal, Download } from "lucide-react";
import { toast } from "sonner";
import type { TrackedLinkWithAsset } from "@/lib/types";

const CHANNEL_LABEL: Record<string, string> = {
  social: "Social", job_board: "Job Board", email: "Email",
  internal: "Internal", influencer: "Influencer",
};

const PAGE_SIZE = 20;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface LinksTableProps { links: TrackedLinkWithAsset[]; }

export default function LinksTable({ links }: LinksTableProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return links;
    const q = query.toLowerCase();
    return links.filter(
      (l) =>
        l.short_url.toLowerCase().includes(q) ||
        l.utm_source.toLowerCase().includes(q) ||
        l.utm_content.toLowerCase().includes(q) ||
        l.utm_term.toLowerCase().includes(q)
    );
  }, [links, query]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageLinks = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function exportCsv() {
    const header = "Short URL,Channel,Platform,Recruiter,Clicks,Created\n";
    const rows = filtered.map((l) =>
      `${l.short_url},${l.utm_source},${l.utm_content},${l.utm_term},${l.click_count},${l.created_at}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tracked-links.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const thStyle: React.CSSProperties = {
    textAlign: "left", fontSize: 10, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: 0.5,
    color: "#8A8A8E", padding: "9px 14px",
    borderBottom: "1px solid #E8E8EA", background: "#FAFAFA",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 14px", fontSize: 12,
    borderBottom: "1px solid #F7F7F8", verticalAlign: "middle",
  };

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid #E8E8EA" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8A8A8E" }} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder="Search links..."
            style={{
              width: "100%", fontSize: 13, padding: "7px 10px 7px 34px",
              borderRadius: 8, border: "1px solid #E8E8EA",
              background: "#FAFAFA", fontFamily: "inherit",
            }}
          />
        </div>
        <button
          onClick={exportCsv}
          style={{
            fontSize: 12, fontWeight: 600, padding: "7px 14px",
            borderRadius: 9999, border: "none",
            background: "#32373C", color: "white", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <Download size={12} /> Export
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Short URL</th>
              <th style={thStyle}>Channel</th>
              <th style={thStyle}>Platform</th>
              <th style={thStyle}>Recruiter</th>
              <th style={thStyle}>Creative</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Clicks</th>
              <th style={thStyle}>Created</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageLinks.map((link) => (
              <tr key={link.id} onMouseEnter={(e) => { e.currentTarget.style.background = "#FAFAFA"; }} onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}>
                <td style={{ ...tdStyle, fontFamily: '"SF Mono", "Fira Code", monospace', fontWeight: 600, color: "#1A1A1A" }}>
                  {link.short_url.replace(/^https?:\/\/[^/]+/, "")}
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 9999, background: "#F7F7F8", color: "#32373C" }}>
                    {CHANNEL_LABEL[link.utm_source] ?? link.utm_source}
                  </span>
                </td>
                <td style={tdStyle}>{link.utm_content}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{link.utm_term}</td>
                <td style={{ ...tdStyle, color: link.asset_thumbnail ? "#8A8A8E" : "#8A8A8E", fontStyle: link.asset_thumbnail ? "normal" : "italic" }}>
                  {link.asset_thumbnail ? link.utm_content : "No creative"}
                </td>
                <td style={{ ...tdStyle, fontSize: 15, fontWeight: 800, textAlign: "center" }}>{link.click_count}</td>
                <td style={{ ...tdStyle, color: "#8A8A8E" }}>{timeAgo(link.created_at)}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 3, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => { navigator.clipboard.writeText(link.short_url).then(() => toast.success("Copied!"), () => toast.error("Failed")); }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E8E8EA", background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8A8A8E" }}
                    >
                      <Copy size={12} />
                    </button>
                    <a
                      href={link.short_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E8E8EA", background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8A8A8E" }}
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderTop: "1px solid #E8E8EA" }}>
          <div style={{ fontSize: 12, color: "#8A8A8E" }}>
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                style={{
                  width: 30, height: 30, borderRadius: 6,
                  border: page === i ? "1px solid #32373C" : "1px solid #E8E8EA",
                  background: page === i ? "#32373C" : "white",
                  color: page === i ? "white" : "#8A8A8E",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep -E "ChannelBar|TopPerformers|LinksTable"`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/recruiter/ChannelBarChart.tsx src/components/recruiter/TopPerformers.tsx src/components/recruiter/LinksTable.tsx
git commit -m "feat(ui): add dashboard sub-components — ChannelBarChart, TopPerformers, LinksTable"
```

---

## Task 7: DashboardTab Component

**Files:**
- Create: `src/components/recruiter/DashboardTab.tsx`

- [ ] **Step 1: Create DashboardTab composing sub-components**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3 } from "lucide-react";
import ChannelBarChart from "./ChannelBarChart";
import TopPerformers from "./TopPerformers";
import LinksTable from "./LinksTable";
import type { TrackedLinksResponse } from "@/lib/types";

interface DashboardTabProps {
  requestId: string;
}

export default function DashboardTab({ requestId }: DashboardTabProps) {
  const [data, setData] = useState<TrackedLinksResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracked-links?request_id=${requestId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: "#8A8A8E" }}>
        Loading dashboard...
      </div>
    );
  }

  if (!data || data.links.length === 0) {
    return (
      <div style={{ padding: "64px 0", textAlign: "center" }}>
        <BarChart3 size={40} style={{ color: "#8A8A8E", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", marginBottom: 8 }}>No tracked links yet</div>
        <div style={{ fontSize: 13, color: "#8A8A8E", maxWidth: 320, margin: "0 auto" }}>
          Go to the Assets & Creatives tab, select a creative, and generate a tracked link. Your analytics will appear here.
        </div>
      </div>
    );
  }

  const { summary, links } = data;
  const avgPerLink = summary.total_links > 0 ? (summary.total_clicks / summary.total_links).toFixed(1) : "0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* 5 Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        <DashStat value={String(summary.total_links)} label="Total Links" />
        <DashStat value={String(summary.total_clicks)} label="Total Clicks" />
        <DashStat value={avgPerLink} label="Avg/Link" />
        <DashStat value={String(summary.recruiter_count)} label="Recruiters" />
        <DashStat value={String(summary.channel_count)} label="Channels" />
      </div>

      {/* Channel + Top Performers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #E8E8EA" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A" }}>Clicks by Channel</span>
          </div>
          <ChannelBarChart links={links} />
        </div>
        <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #E8E8EA" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A" }}>Top Performers</span>
          </div>
          <TopPerformers links={links} />
        </div>
      </div>

      {/* Full Table */}
      <LinksTable links={links} />

      <div style={{ fontSize: 10, color: "#8A8A8E", textAlign: "center" }}>
        Updates every 30 seconds · Click counts include all redirects since creation
      </div>
    </div>
  );
}

function DashStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E8E8EA", borderRadius: 10, padding: 14, textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "#1A1A1A" }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.4, color: "#8A8A8E", marginTop: 3 }}>{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep DashboardTab`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/recruiter/DashboardTab.tsx
git commit -m "feat(ui): add DashboardTab — 5 stats, channel chart, top performers, searchable links table"
```

---

## Task 8: Orchestrate RecruiterWorkspace + CreativeLibrary

**Files:**
- Modify: `src/components/recruiter/RecruiterWorkspace.tsx`
- Modify: `src/components/recruiter/CreativeLibrary.tsx`

This is the integration task — rewiring the recruiter workspace with the new tab structure, 2-column layout, stats row, and messaging accordion.

- [ ] **Step 1: Update CreativeLibrary to remove LinkBuilderBar and bottom padding**

In `src/components/recruiter/CreativeLibrary.tsx`:

1. Remove the `LinkBuilderBar` import (line 6) and its render (lines 145-151)
2. Remove `pb-32` padding from the outer wrapper
3. Export `selectedAssetId` and `selectedAsset` via a callback so the parent can pass them to the link builder
4. Add new props: `onAssetSelect: (asset: GeneratedAsset | null) => void`

The component should call `onAssetSelect` whenever the selected asset changes:

Remove:
```tsx
import LinkBuilderBar from "./LinkBuilderBar";
```

Change the interface to add `onAssetSelect`:
```tsx
interface CreativeLibraryProps {
  requestId: string;
  campaignSlug: string | null;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  onAssetSelect: (asset: GeneratedAsset | null) => void;
}
```

Replace the bottom of the component — remove `LinkBuilderBar` render and `pb-32`:
```tsx
  // Notify parent when selected asset changes
  useEffect(() => {
    onAssetSelect(selectedAsset);
  }, [selectedAsset, onAssetSelect]);

  // ... (rest of existing code)

  return (
    <div className="py-6">
      {/* Channel sub-tabs */}
      {/* ... existing channel pills ... */}

      <ChannelMessagingCard brief={brief} channel={CHANNEL_LABEL[activeChannel] ?? activeChannel} />
      <CreativeGrid assets={channelAssets} selectedAssetId={selectedAssetId} onSelect={(a) => setSelectedAssetId(a.id)} />
    </div>
  );
```

Remove the `recruiterInitials` state and `/api/auth/me` fetch — that moves to RecruiterWorkspace.

- [ ] **Step 2: Rewrite RecruiterWorkspace with new tab structure and 2-column layout**

Replace `src/components/recruiter/RecruiterWorkspace.tsx` with the new orchestrator. Key changes:

1. Tabs: "Assets & Creatives" (Image icon), "Dashboard" (LayoutDashboard icon), "Overview" (FileText icon)
2. Fetch tracked links summary in the workspace (for stats row)
3. 2-column grid: CreativeLibrary (left) + LinkBuilderBar (right, sticky)
4. MessagingAccordion above the creative library
5. StatsRow above the two-column layout
6. Track `selectedAsset` state here, pass to LinkBuilderBar

```tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Image, LayoutDashboard, FileText } from "lucide-react";
import { getRecruiterStatus } from "@/lib/format";
import { RecruiterOverviewTab } from "@/components/RecruiterDetailView";
import CreativeLibrary from "./CreativeLibrary";
import LinkBuilderBar from "./LinkBuilderBar";
import DashboardTab from "./DashboardTab";
import MessagingAccordion from "./MessagingAccordion";
import StatsRow from "./StatsRow";
import type {
  IntakeRequest,
  CreativeBrief,
  GeneratedAsset,
  PipelineRun,
  TrackedLinksSummary,
} from "@/lib/types";

type TabKey = "creatives" | "dashboard" | "overview";

interface RecruiterWorkspaceProps {
  request: IntakeRequest;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  pipelineRuns: PipelineRun[];
}

export default function RecruiterWorkspace({ request, brief, assets, pipelineRuns }: RecruiterWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("creatives");
  const statusInfo = getRecruiterStatus(request.status);
  const isApproved = request.status === "approved" || request.status === "sent";
  const approvedAssets = useMemo(() => assets.filter((a) => a.evaluation_passed === true), [assets]);

  const [selectedAsset, setSelectedAsset] = useState<GeneratedAsset | null>(null);
  const [recruiterInitials, setRecruiterInitials] = useState("??");
  const [summary, setSummary] = useState<TrackedLinksSummary | null>(null);

  // Fetch recruiter initials
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.initials) setRecruiterInitials(data.initials); })
      .catch(() => {});
  }, []);

  // Fetch tracked links summary for stats row
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracked-links?request_id=${request.id}&limit=0`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } catch { /* silent */ }
  }, [request.id]);

  useEffect(() => {
    if (isApproved) {
      fetchSummary();
      const interval = setInterval(fetchSummary, 30000);
      return () => clearInterval(interval);
    }
  }, [isApproved, fetchSummary]);

  // Channel count for stats
  const channelCount = useMemo(() => {
    const channels = new Set(approvedAssets.map((a) => a.platform?.toLowerCase()).filter(Boolean));
    return channels.size;
  }, [approvedAssets]);

  function handleDownloadAll() {
    for (const asset of approvedAssets) {
      if (asset.blob_url) window.open(asset.blob_url, "_blank");
    }
  }

  // Pre-approval: no tabs, just overview
  if (!isApproved) {
    return (
      <div style={{ flex: 1, overflowY: "auto", background: "#F7F7F8" }}>
        <div style={{ height: 2, background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }} />
        <HeaderBar request={request} statusInfo={statusInfo} showDownloadAll={false} approvedCount={0} />
        <RecruiterOverviewTab request={request} brief={brief} assets={assets} pipelineRuns={pipelineRuns} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#F7F7F8" }}>
      <div style={{ height: 2, background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }} />
      <HeaderBar
        request={request}
        statusInfo={statusInfo}
        showDownloadAll
        approvedCount={approvedAssets.length}
        onDownloadAll={handleDownloadAll}
      />

      {/* Tab bar */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E8E8EA", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", display: "flex", gap: 0 }}>
          <TabButton active={activeTab === "creatives"} onClick={() => setActiveTab("creatives")} icon={<Image size={14} />} label="Assets & Creatives" />
          <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={<LayoutDashboard size={14} />} label="Dashboard" />
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} icon={<FileText size={14} />} label="Overview" />
        </div>
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>
        {activeTab === "creatives" && (
          <>
            <StatsRow approvedCount={approvedAssets.length} channelCount={channelCount} summary={summary} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <MessagingAccordion brief={brief} />
                <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA", overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid #E8E8EA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Creative Library</span>
                    <span style={{ fontSize: 11, color: "#8A8A8E" }}>{approvedAssets.length} approved</span>
                  </div>
                  <CreativeLibrary
                    requestId={request.id}
                    campaignSlug={request.campaign_slug}
                    brief={brief}
                    assets={assets}
                    onAssetSelect={setSelectedAsset}
                  />
                </div>
              </div>
              <div style={{ position: "sticky", top: 72 }}>
                <LinkBuilderBar
                  requestId={request.id}
                  campaignSlug={request.campaign_slug}
                  activeChannel=""
                  selectedAsset={selectedAsset}
                  recruiterInitials={recruiterInitials}
                  onDetachCreative={() => setSelectedAsset(null)}
                />
              </div>
            </div>
          </>
        )}
        {activeTab === "dashboard" && <DashboardTab requestId={request.id} />}
        {activeTab === "overview" && (
          <RecruiterOverviewTab request={request} brief={brief} assets={assets} pipelineRuns={pipelineRuns} />
        )}
      </div>
    </div>
  );
}

function HeaderBar({
  request, statusInfo, showDownloadAll, approvedCount, onDownloadAll,
}: {
  request: IntakeRequest;
  statusInfo: ReturnType<typeof getRecruiterStatus>;
  showDownloadAll: boolean;
  approvedCount: number;
  onDownloadAll?: () => void;
}) {
  return (
    <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E8E8EA", padding: "18px 32px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "#8A8A8E", cursor: "pointer", display: "flex" }} aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, margin: 0 }}>{request.title}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
              {request.campaign_slug && (
                <span style={{ fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: 11, color: "#8A8A8E", background: "#F7F7F8", padding: "1px 8px", borderRadius: 4 }}>
                  {request.campaign_slug}
                </span>
              )}
              <span style={{ fontSize: 11, fontWeight: 600, color: statusInfo.color, background: statusInfo.bgColor, border: `1px solid ${statusInfo.borderColor}`, padding: "1px 10px", borderRadius: 9999 }}>
                {statusInfo.label}
              </span>
            </div>
          </div>
        </div>
        {showDownloadAll && approvedCount > 0 && onDownloadAll && (
          <button
            onClick={onDownloadAll}
            style={{
              background: "#32373C", color: "white", border: "none",
              padding: "7px 18px", borderRadius: 9999,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Download size={14} />
            Download All
          </button>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "11px 18px",
        fontSize: 13,
        fontWeight: 600,
        color: active ? "#1A1A1A" : "#8A8A8E",
        border: "none",
        background: "none",
        borderBottom: `2px solid ${active ? "#32373C" : "transparent"}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "inherit",
        transition: "color 0.15s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | head -30`
Expected: 0 errors (or only pre-existing ones)

- [ ] **Step 4: Commit**

```bash
git add src/components/recruiter/RecruiterWorkspace.tsx src/components/recruiter/CreativeLibrary.tsx
git commit -m "feat(ui): orchestrate RecruiterWorkspace — 2-col layout, new tabs, stats row, messaging accordion"
```

---

## Task 9: Delete PerformanceTab + Final Cleanup

**Files:**
- Delete: `src/components/recruiter/PerformanceTab.tsx`

- [ ] **Step 1: Verify PerformanceTab is no longer imported anywhere**

Run: `cd /Users/stevenjunop/centric-intake && grep -r "PerformanceTab" src/ --include="*.tsx" --include="*.ts"`
Expected: Only `src/components/recruiter/PerformanceTab.tsx` itself (no imports from other files since RecruiterWorkspace was rewritten in Task 8)

- [ ] **Step 2: Delete PerformanceTab**

```bash
rm src/components/recruiter/PerformanceTab.tsx
```

- [ ] **Step 3: Final TypeScript check**

Run: `cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors related to recruiter components

- [ ] **Step 4: Run dev server and verify**

Run: `cd /Users/stevenjunop/centric-intake && npm run dev`
Navigate to an approved campaign's recruiter view. Verify:
- Gradient bar at top
- Stats row with 4 cards
- Messaging accordion (collapsed by default, expands on click)
- Creative library with channel pills and 3-col grid
- Link builder side panel (sticky, right column)
- Dashboard tab with charts and table
- Overview tab (unchanged)

- [ ] **Step 5: Commit**

```bash
git rm src/components/recruiter/PerformanceTab.tsx
git commit -m "chore: delete PerformanceTab — replaced by DashboardTab in recruiter view redesign"
```
