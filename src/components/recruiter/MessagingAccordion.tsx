"use client";

import { useState } from "react";
import { ChevronRight, Check, X, MessageSquare } from "lucide-react";
import { extractField } from "@/lib/format";
import type { CreativeBrief } from "@/lib/types";

interface MessagingAccordionProps {
  brief: CreativeBrief | null;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        color: "#8A8A8E",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

export default function MessagingAccordion({ brief }: MessagingAccordionProps) {
  const [open, setOpen] = useState(false);

  const briefData = brief?.brief_data as Record<string, unknown> | undefined;
  const messaging = briefData?.messaging_strategy as Record<string, unknown> | undefined;

  // Return null if no messaging_strategy or no content
  if (!messaging) return null;

  const primaryMessage = extractField(messaging, "primary_message");
  const targetAudience = extractField(messaging, "target_audience");

  const rawTone = messaging?.tone;
  const tones: string[] = Array.isArray(rawTone)
    ? (rawTone as unknown[]).map((t) => String(t)).filter(Boolean)
    : typeof rawTone === "string" && rawTone
    ? [rawTone]
    : [];

  const rawValueProps =
    (messaging?.value_propositions as unknown[]) ??
    (briefData?.value_props as unknown[]) ??
    [];
  const valueProps: string[] = Array.isArray(rawValueProps)
    ? rawValueProps.map((v) => (typeof v === "string" ? v : "")).filter(Boolean)
    : [];

  const dos: string[] = (messaging?.dos as string[]) ?? [];
  const donts: string[] = (messaging?.donts as string[]) ?? [];
  const channelGuidance: Record<string, string> =
    (messaging?.channel_guidance as Record<string, string>) ?? {};

  // If none of the key fields have content, return null
  const hasContent =
    primaryMessage ||
    targetAudience ||
    tones.length > 0 ||
    valueProps.length > 0 ||
    dos.length > 0 ||
    donts.length > 0 ||
    Object.keys(channelGuidance).length > 0;

  if (!hasContent) return null;

  const channelEntries = Object.entries(channelGuidance);

  return (
    <div
      style={{
        border: "1px solid #E5E5E5",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 16,
        background: "#FFFFFF",
      }}
    >
      {/* Trigger button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "100%",
          padding: "14px 18px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          background: "#FFFFFF",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#FAFAFA";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF";
        }}
      >
        <ChevronRight
          size={16}
          color="#8A8A8E"
          style={{
            flexShrink: 0,
            transition: "transform 0.2s",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
        <MessageSquare size={16} color="#6D28D9" style={{ flexShrink: 0 }} />
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#1A1A1A",
            flex: 1,
          }}
        >
          Campaign Messaging &amp; Guidance
        </span>
        <span
          style={{
            fontSize: 11,
            color: "#8A8A8E",
            marginLeft: "auto",
          }}
        >
          Click to {open ? "collapse" : "expand"}
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div
          style={{
            padding: "16px 18px 20px",
            borderTop: "1px solid #E5E5E5",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* 1. Key Message */}
          {primaryMessage && (
            <div>
              <SectionLabel>Key Message</SectionLabel>
              <div
                style={{
                  borderLeft: "3px solid #6D28D9",
                  background: "#F7F7F8",
                  padding: "10px 14px",
                  borderRadius: "0 8px 8px 0",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: "#1A1A1A",
                  lineHeight: 1.55,
                }}
              >
                &ldquo;{primaryMessage}&rdquo;
              </div>
            </div>
          )}

          {/* 2. Tone & Voice + Target Audience */}
          {(tones.length > 0 || targetAudience) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              {tones.length > 0 && (
                <div>
                  <SectionLabel>Tone &amp; Voice</SectionLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {tones.map((tone, i) => (
                      <span
                        key={i}
                        style={{
                          background: "#F7F7F8",
                          border: "1px solid #E8E8EA",
                          borderRadius: 9999,
                          fontSize: 12,
                          padding: "3px 10px",
                          color: "#1A1A1A",
                        }}
                      >
                        {tone}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {targetAudience && (
                <div>
                  <SectionLabel>Target Audience</SectionLabel>
                  <p style={{ fontSize: 13, color: "#1A1A1A", margin: 0, lineHeight: 1.5 }}>
                    {targetAudience}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 3. Value Propositions */}
          {valueProps.length > 0 && (
            <div>
              <SectionLabel>Value Propositions</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {valueProps.map((prop, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "8px 0",
                      borderBottom:
                        i < valueProps.length - 1 ? "1px solid #E8E8EA" : "none",
                    }}
                  >
                    <Check size={14} color="#6D28D9" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: "#1A1A1A", lineHeight: 1.5 }}>{prop}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Do's and Don'ts */}
          {(dos.length > 0 || donts.length > 0) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              {dos.length > 0 && (
                <div>
                  <SectionLabel>Do&apos;s</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {dos.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                        <Check size={13} color="#6D28D9" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 13, color: "#1A1A1A", lineHeight: 1.45 }}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {donts.length > 0 && (
                <div>
                  <SectionLabel>Don&apos;ts</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {donts.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                        <X size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 13, color: "#1A1A1A", lineHeight: 1.45 }}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Channel Guidance */}
          {channelEntries.length > 0 && (
            <div>
              <SectionLabel>Channel Guidance</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {channelEntries.map(([channel, guidance]) => (
                  <div
                    key={channel}
                    style={{
                      background: "#F7F7F8",
                      border: "1px solid #E8E8EA",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        color: "#6D28D9",
                        marginBottom: 4,
                      }}
                    >
                      {channel}
                    </div>
                    <p style={{ fontSize: 12, color: "#1A1A1A", margin: 0, lineHeight: 1.5 }}>
                      {guidance}
                    </p>
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
