"use client";

import { FONT, type Theme } from "./tokens";
import PushToFigmaButton from "../figma/PushToFigmaButton";

interface PersonaContextCardProps {
  persona: Record<string, any>;
  theme: Theme;
  requestId: string;
}

const DESIGN_GUIDANCE: Record<string, string[]> = {
  identity_appeal: ["Large portrait", "Serif headlines", "Minimal decoration"],
  social_proof: ["Badge-rich", "Avatar stack", "Numbers visible"],
  scarcity: ["Bold contrast", "Strong CTA", "Countdown energy"],
  urgency: ["Bold contrast", "Strong CTA", "Countdown energy"],
  authority: ["Clean layout", "Trust badges", "Professional feel"],
};

function getDesignTags(primaryBias?: string, secondaryBias?: string): string[] {
  const tags: string[] = [];
  const lookup = (bias?: string) => {
    if (!bias) return;
    const key = Object.keys(DESIGN_GUIDANCE).find((k) =>
      bias.toLowerCase().includes(k)
    );
    if (key) tags.push(...DESIGN_GUIDANCE[key]);
  };
  lookup(primaryBias);
  lookup(secondaryBias);
  return tags.length > 0 ? tags : ["Balanced layout"];
}

function truncate(str: string | undefined, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max).trimEnd() + "…" : str;
}

export default function PersonaContextCard({
  persona,
  theme,
  requestId,
}: PersonaContextCardProps) {
  const name =
    persona.persona_name || persona.name || "Unknown Persona";
  const archetype: string = persona.archetype || "";
  const demographics = [persona.age_range, persona.region]
    .filter(Boolean)
    .join(", ");
  const description = truncate(persona.lifestyle, 120);
  const psych = persona.psychology_profile as
    | Record<string, string>
    | undefined;
  const primaryBias = psych?.primary_bias;
  const secondaryBias = psych?.secondary_bias;
  const designTags = getDesignTags(primaryBias, secondaryBias);

  const initial = name.charAt(0).toUpperCase();

  const psychTags = [primaryBias, secondaryBias].filter(Boolean) as string[];

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        padding: "18px 22px",
        marginBottom: 24,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        fontFamily: FONT.sans,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6D28D9, #E91E8C)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#FFFFFF",
          fontSize: 18,
          fontWeight: 700,
          fontFamily: FONT.sans,
        }}
      >
        {initial}
      </div>

      {/* Center content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: theme.text,
              fontFamily: FONT.sans,
              letterSpacing: "-0.2px",
            }}
          >
            {name}
          </span>
          {(archetype || demographics) && (
            <span
              style={{
                fontSize: 11,
                color: theme.textMuted,
                fontFamily: FONT.sans,
              }}
            >
              {[archetype, demographics].filter(Boolean).join(" · ")}
            </span>
          )}
          <div style={{ marginLeft: "auto", flexShrink: 0 }}>
            <PushToFigmaButton
              requestId={requestId}
              scope="persona"
              persona={name}
              theme={theme}
              compact
            />
          </div>
        </div>

        {/* Description */}
        {description && (
          <div
            style={{
              fontSize: 12,
              color: theme.textMuted,
              fontFamily: FONT.sans,
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
        )}

        {/* Tags row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {/* Psychology tags */}
          {psychTags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 6,
                color: "#A78BFA",
                background: "rgba(109,40,217,0.12)",
                fontFamily: FONT.sans,
                textTransform: "uppercase",
                letterSpacing: "0.4px",
              }}
            >
              {tag.replace(/_/g, " ")}
            </span>
          ))}

          {/* Design guidance tags */}
          {designTags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 6,
                background: theme.border,
                color: theme.textMuted,
                fontFamily: FONT.sans,
                textTransform: "uppercase",
                letterSpacing: "0.4px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
