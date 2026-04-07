"use client";

import { extractField } from "@/lib/format";
import type { CreativeBrief } from "@/lib/types";

const TAG_STYLES = [
  { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
  { bg: "#fdf4ff", border: "#e9d5ff", text: "#6b21a8" },
  { bg: "#fefce8", border: "#fde68a", text: "#854d0e" },
  { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
];

interface ChannelMessagingCardProps {
  brief: CreativeBrief | null;
  channel: string;
}

export default function ChannelMessagingCard({ brief, channel }: ChannelMessagingCardProps) {
  const briefData = brief?.brief_data as Record<string, unknown> | undefined;
  const messagingStrategy = briefData?.messaging_strategy as Record<string, unknown> | undefined;
  const primaryMessage = extractField(messagingStrategy, "primary_message") || extractField(briefData, "summary");
  const tone = extractField(messagingStrategy, "tone");

  const rawValueProps =
    (briefData?.value_props as unknown[]) ??
    (messagingStrategy?.value_propositions as unknown[]) ??
    [];
  const valuePropTags: string[] = rawValueProps
    .map((v) => (typeof v === "string" ? v : ""))
    .filter(Boolean)
    .slice(0, 6);

  if (!primaryMessage && valuePropTags.length === 0 && !tone) {
    return null;
  }

  return (
    <div
      className="rounded-xl p-5 border border-[var(--border)] mb-6"
      style={{
        background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)",
      }}
    >
      <div className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
        Key message for {channel}
      </div>
      {primaryMessage && (
        <p className="text-base font-semibold text-[var(--foreground)] leading-snug mb-3">
          &ldquo;{primaryMessage}&rdquo;
        </p>
      )}
      {valuePropTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {valuePropTags.map((tag, i) => {
            const style = TAG_STYLES[i % TAG_STYLES.length];
            return (
              <span
                key={i}
                className="text-xs font-medium px-3 py-1 rounded-full border"
                style={{ background: style.bg, borderColor: style.border, color: style.text }}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}
      {tone && (
        <div className="text-xs text-[var(--muted-foreground)] mt-2">
          <span className="font-medium">Tone:</span> {tone}
        </div>
      )}
    </div>
  );
}
