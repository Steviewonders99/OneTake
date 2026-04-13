"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Theme } from "../gallery/tokens";
import { FONT, FIGMA_ICON } from "../gallery/tokens";

interface PushToFigmaButtonProps {
  requestId: string;
  scope: "campaign" | "persona" | "version" | "organic" | "paid";
  persona?: string;
  version?: string;
  theme: Theme;
  compact?: boolean;
}

export default function PushToFigmaButton({
  requestId,
  scope,
  persona,
  version,
  theme,
  compact = false,
}: PushToFigmaButtonProps) {
  const [isPushing, setIsPushing] = useState(false);

  async function handlePush() {
    if (isPushing) return;
    setIsPushing(true);

    try {
      const res = await fetch("/api/figma/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          scope: scope === "organic" || scope === "paid" ? "campaign" : scope,
          persona: persona || undefined,
          version: version || undefined,
          distribution: scope === "organic" ? "organic" : scope === "paid" ? "paid" : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      toast.success("Pushed to Figma — open plugin to import");
    } catch (err) {
      toast.error(
        "Push failed: " + (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setIsPushing(false);
    }
  }

  if (compact) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handlePush();
        }}
        title={`Push ${scope} to Figma`}
        disabled={isPushing}
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          background: theme.border,
          border: `1px solid ${theme.borderHover}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isPushing ? "wait" : "pointer",
          opacity: isPushing ? 0.6 : 1,
          transition: "opacity 0.15s ease",
        }}
      >
        {isPushing ? (
          <Loader2 size={13} style={{ color: theme.textMuted, animation: "spin 1s linear infinite" }} />
        ) : (
          <span dangerouslySetInnerHTML={{ __html: FIGMA_ICON }} />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handlePush}
      disabled={isPushing}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 18px",
        borderRadius: 9999,
        background: theme.border,
        color: theme.text,
        border: `1px solid ${theme.borderHover}`,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: FONT.sans,
        cursor: isPushing ? "wait" : "pointer",
        opacity: isPushing ? 0.7 : 1,
        transition: "all 0.15s ease",
      }}
    >
      {isPushing ? (
        <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
      ) : (
        <span dangerouslySetInnerHTML={{ __html: FIGMA_ICON }} />
      )}
      Push to Figma
    </button>
  );
}
