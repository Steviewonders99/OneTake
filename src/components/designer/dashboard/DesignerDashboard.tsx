"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Layers, Loader2 } from "lucide-react";
import ThemeToggle from "../gallery/ThemeToggle";
import { DARK, LIGHT, Theme, FONT } from "../gallery/tokens";
import DashboardSidebar from "./DashboardSidebar";
import StatusGroup from "./StatusGroup";
import WorkItemRow from "./WorkItemRow";
import { IntakeRequest } from "@/lib/types";

// Rotating persona chip colors
const PERSONA_COLORS = [
  "#6D28D9",
  "#2563EB",
  "#0891B2",
  "#059669",
  "#D97706",
  "#DC2626",
  "#7C3AED",
  "#DB2777",
];

export default function DesignerDashboard() {
  const router = useRouter();

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nova-designer-theme") === "light"
        ? LIGHT
        : DARK;
    }
    return DARK;
  });
  const [campaigns, setCampaigns] = useState<IntakeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["review"])
  );
  const [userName, setUserName] = useState("Designer");

  // ── Data fetching ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/intake").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([camps, user]) => {
        setCampaigns(
          (camps as IntakeRequest[]).filter(
            (c: IntakeRequest) => c.status !== "draft"
          )
        );
        if (user?.firstName) setUserName(user.firstName);
        else if (user?.initials) setUserName(user.initials);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Time-based greeting ────────────────────────────────────
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // ── Status grouping ────────────────────────────────────────
  const grouped = useMemo(
    () => ({
      review: campaigns.filter(
        (c) => c.status === "review" || c.status === "approved"
      ),
      completed: campaigns.filter((c) => c.status === "sent"),
      generating: campaigns.filter((c) => c.status === "generating"),
    }),
    [campaigns]
  );

  // ── Stats ──────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      active: campaigns.length,
      creatives: 0, // placeholder — would need aggregate API
      avgVqa: 0, // placeholder
      pendingReview: grouped.review.length,
    }),
    [campaigns, grouped]
  );

  // ── Theme toggle ───────────────────────────────────────────
  function toggleTheme() {
    const next = theme === DARK ? LIGHT : DARK;
    setTheme(next);
    localStorage.setItem(
      "nova-designer-theme",
      next === DARK ? "dark" : "light"
    );
  }

  // ── Group expand/collapse ──────────────────────────────────
  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Derive persona chips from campaign title ───────────────
  function derivePersonas(campaign: IntakeRequest) {
    const title = campaign.title || "U";
    const initial = title.charAt(0).toUpperCase();
    const colorIdx =
      title.charCodeAt(0) % PERSONA_COLORS.length;
    return [
      {
        name: title,
        initial,
        color: PERSONA_COLORS[colorIdx],
      },
    ];
  }

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: theme.bg,
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          fontFamily: FONT.sans,
          color: theme.textMuted,
        }}
      >
        <Loader2
          size={24}
          style={{ animation: "spin 1s linear infinite" }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: "14px" }}>Loading campaigns...</span>
      </div>
    );
  }

  // ── Render rows for a status group ─────────────────────────
  function renderRows(
    items: IntakeRequest[],
    dimmed: boolean,
    progressVal: number,
    priorityVal: "urgent" | "high" | "medium" | "low"
  ) {
    return items.map((campaign) => (
      <WorkItemRow
        key={campaign.id}
        campaign={campaign}
        creativeCount={0}
        personaCount={0}
        personas={derivePersonas(campaign)}
        avgVqa={0}
        progress={progressVal}
        priority={priorityVal}
        theme={theme}
        onClick={() => router.push(`/designer/${campaign.id}`)}
        dimmed={dimmed}
      />
    ));
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.text,
        fontFamily: FONT.sans,
        display: "flex",
        flexDirection: "column" as const,
        transition: "background 0.2s ease, color 0.2s ease",
      }}
    >
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: "48px",
          borderBottom: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      >
        {/* Left: Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Gradient square logo */}
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background:
                "linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Layers size={14} color="#fff" />
          </div>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: theme.text,
              fontFamily: FONT.sans,
            }}
          >
            Nova
          </span>
          <span
            style={{
              width: "1px",
              height: "16px",
              background: theme.border,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "15px",
              color: theme.textMuted,
              fontFamily: FONT.sans,
            }}
          >
            Creative Studio
          </span>
        </div>

        {/* Right: Theme toggle + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              color: "#fff",
              fontFamily: FONT.sans,
              flexShrink: 0,
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Sidebar + Main ──────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1 }}>
        <DashboardSidebar
          theme={theme}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          stats={stats}
        />

        <div style={{ flex: 1, overflowY: "auto" as const }}>
          {/* ── Greeting ──────────────────────────────────── */}
          <div style={{ padding: "24px 32px 16px" }}>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: theme.text,
                fontFamily: FONT.sans,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {greeting}, {userName}
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: theme.textMuted,
                fontFamily: FONT.sans,
                margin: "4px 0 0",
              }}
            >
              {campaigns.length} active campaign
              {campaigns.length !== 1 ? "s" : ""} in your studio
            </p>
          </div>

          {/* ── Column headers (sticky) ───────────────────── */}
          <div
            style={{
              position: "sticky" as const,
              top: 0,
              zIndex: 10,
              background: theme.bg,
              display: "grid",
              gridTemplateColumns: "24px 1fr 120px 80px 80px 100px 130px 40px",
              gap: "12px",
              padding: "8px 32px",
              borderBottom: `1px solid ${theme.border}`,
              fontSize: "12px",
              fontWeight: 600,
              textTransform: "uppercase" as const,
              letterSpacing: "0.04em",
              color: theme.textDim,
              fontFamily: FONT.sans,
            }}
          >
            <span />
            <span>Campaign</span>
            <span>Personas</span>
            <span style={{ textAlign: "center" }}>Creatives</span>
            <span style={{ textAlign: "center" }}>VQA</span>
            <span style={{ textAlign: "center" }}>Created</span>
            <span>Progress</span>
            <span />
          </div>

          {/* ── Organic Priority Section ──────────────────── */}
          <div
            style={{
              padding: "12px 32px 4px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 2,
                background: "#E84BA5",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
                color: "#E84BA5",
                fontFamily: FONT.sans,
              }}
            >
              Organic — Review Priority
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: theme.border,
                marginLeft: 8,
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
                color: theme.textDim,
                fontFamily: FONT.sans,
              }}
            >
              Paid — Standard
            </span>
          </div>

          {/* ── Status groups ─────────────────────────────── */}
          {grouped.review.length > 0 && (
            <StatusGroup
              status="review"
              label="Needs Review"
              count={grouped.review.length}
              isExpanded={expandedGroups.has("review")}
              onToggle={() => toggleGroup("review")}
              theme={theme}
            >
              {renderRows(grouped.review, false, 0, "high")}
            </StatusGroup>
          )}

          {grouped.completed.length > 0 && (
            <StatusGroup
              status="sent"
              label="Completed"
              count={grouped.completed.length}
              isExpanded={expandedGroups.has("completed")}
              onToggle={() => toggleGroup("completed")}
              theme={theme}
            >
              {renderRows(grouped.completed, true, 100, "low")}
            </StatusGroup>
          )}

          {grouped.generating.length > 0 && (
            <StatusGroup
              status="generating"
              label="Generating"
              count={grouped.generating.length}
              isExpanded={expandedGroups.has("generating")}
              onToggle={() => toggleGroup("generating")}
              theme={theme}
            >
              {renderRows(grouped.generating, true, 40, "low")}
            </StatusGroup>
          )}

          {/* Empty state */}
          {campaigns.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 32px",
                gap: "12px",
              }}
            >
              <Layers size={32} color={theme.textDim} />
              <span
                style={{
                  fontSize: "15px",
                  color: theme.textMuted,
                  fontFamily: FONT.sans,
                }}
              >
                No active campaigns
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
