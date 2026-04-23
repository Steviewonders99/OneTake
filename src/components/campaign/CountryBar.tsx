"use client";

import { useRef, useEffect, useState } from "react";

interface CountryStatus {
  country: string;
  status: "pending" | "processing" | "complete" | "failed";
  stageTarget?: number | null;
}

interface CountryBarProps {
  countries: CountryStatus[];
  selected: string | null;
  onChange: (country: string | null) => void;
}

const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  complete: { bg: "#dcfce7", color: "#15803d", label: "DONE" },
  processing: { bg: "#dbeafe", color: "#1d4ed8", label: "GEN" },
  pending: { bg: "#f5f5f5", color: "#737373", label: "PEND" },
  failed: { bg: "#fee2e2", color: "#dc2626", label: "FAIL" },
};

export default function CountryBar({ countries, selected, onChange }: CountryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setShowFade(el.scrollWidth > el.clientWidth && el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    check();
    el.addEventListener("scroll", check);
    return () => el.removeEventListener("scroll", check);
  }, [countries.length]);

  const isAllSelected = selected === null;

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "2px solid #E5E5E5",
          padding: "0 24px",
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{
            padding: "12px 20px",
            fontSize: 13,
            fontWeight: isAllSelected ? 700 : 600,
            color: isAllSelected ? "#1A1A1A" : "#737373",
            background: "none",
            border: "none",
            borderBottom: isAllSelected ? "2px solid #32373C" : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
            marginBottom: -2,
          }}
        >
          All Countries
        </button>

        {countries.map((c) => {
          const isActive = selected === c.country;
          const badge = STATUS_BADGES[c.status] || STATUS_BADGES.pending;
          const stageLabel = c.status === "processing" && c.stageTarget
            ? `S${c.stageTarget}/4`
            : badge.label;

          return (
            <button
              key={c.country}
              type="button"
              onClick={() => onChange(c.country)}
              style={{
                padding: "12px 20px",
                fontSize: 13,
                fontWeight: isActive ? 700 : 600,
                color: isActive ? "#1A1A1A" : "#737373",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid #32373C" : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: -2,
              }}
            >
              {c.country}
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  background: badge.bg,
                  color: badge.color,
                  borderRadius: 9999,
                  fontWeight: 700,
                }}
              >
                {stageLabel}
              </span>
            </button>
          );
        })}
      </div>

      {showFade && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 60,
            background: "linear-gradient(to right, transparent, #FFFFFF)",
            pointerEvents: "none",
          }}
        />
      )}

      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
