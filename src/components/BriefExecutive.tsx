"use client";

import {
  Target,
  MessageSquare,
  Users,
  Globe,
  Shield,
  Palette,
  Megaphone,
  Heart,
  AlertTriangle,
  Sparkles,
  Languages,
} from "lucide-react";
import EditableField from "@/components/EditableField";
import { toReadable } from "@/lib/format";

interface BriefExecutiveProps {
  briefData: Record<string, any>;
  channelResearch?: Record<string, any> | null;
  designDirection?: Record<string, any> | null;
  editable?: boolean;
  onFieldSave?: (path: string, value: string) => void;
}

function SectionHeader({
  icon: Icon,
  title,
  color = "#6B21A8",
}: {
  icon: React.ComponentType<Record<string, any>>;
  title: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center"
        style={{ backgroundColor: `${color}10`, color }}
      >
        <Icon size={13} />
      </div>
      <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--foreground)]">
        {title}
      </h3>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[var(--border)] my-6" />;
}

function Tag({ children, color = "#6B21A8" }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium leading-none"
      style={{ backgroundColor: `${color}08`, color, border: `1px solid ${color}15` }}
    >
      {children}
    </span>
  );
}

function BulletList({ items, color = "#6B21A8" }: { items: string[]; color?: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--foreground)] leading-relaxed">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[7px]" style={{ backgroundColor: color }} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function PersonaHookCard({
  personaKey,
  hook,
  motivations,
  painPoints,
  psychologyHook,
}: {
  personaKey: string;
  hook?: string;
  motivations?: string[];
  painPoints?: string[];
  psychologyHook?: string;
}) {
  const colors: Record<string, string> = {
    0: "#6B21A8",
    1: "#0693E3",
    2: "#E91E8C",
    3: "#22c55e",
  };
  const color = colors[String(Object.keys(colors).length % 4)] || "#6B21A8";

  return (
    <div className="border border-[var(--border)] rounded-xl p-4 space-y-2" style={{ borderTopColor: color, borderTopWidth: "2px" }}>
      <h4 className="text-[12px] font-bold text-[var(--foreground)] capitalize">
        {personaKey.replace(/_/g, " ")}
      </h4>
      {hook && (
        <p className="text-[13px] text-[var(--foreground)] font-medium leading-relaxed">
          &ldquo;{hook}&rdquo;
        </p>
      )}
      {motivations && motivations.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Motivations</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {motivations.map((m, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-[var(--muted)] rounded-md text-[var(--foreground)]">{m}</span>
            ))}
          </div>
        </div>
      )}
      {painPoints && painPoints.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Pain Points</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {painPoints.map((p, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-red-50 text-red-700 rounded-md">{p}</span>
            ))}
          </div>
        </div>
      )}
      {psychologyHook && (
        <p className="text-[11px] text-[var(--muted-foreground)] italic">Psychology: {psychologyHook}</p>
      )}
    </div>
  );
}

export default function BriefExecutive({
  briefData,
  channelResearch,
  designDirection,
  editable = false,
  onFieldSave,
}: BriefExecutiveProps) {
  const messaging = briefData.messaging_strategy || {};
  const targetAudience = briefData.target_audience || {};
  const contentLang = briefData.content_language || {};
  const channels = briefData.channels || {};
  const guardrails = briefData.cultural_guardrails || {};
  const personas = briefData.personas || [];

  const perPersonaHooks = messaging.per_persona_hooks || {};
  const motivationsByPersona = targetAudience.motivations_by_persona || {};
  const painPointsByPersona = targetAudience.pain_points_by_persona || {};
  const psychologyByPersona = targetAudience.psychology_hooks_by_persona || {};

  return (
    <div className="space-y-0">

      {/* Campaign Objective */}
      <div>
        <SectionHeader icon={Target} title="Campaign Objective" color="#0693E3" />
        <EditableField
          value={briefData.campaign_objective || briefData.summary || ""}
          editable={editable}
          onSave={(v) => onFieldSave?.("campaign_objective", v)}
          textClassName="text-[15px] leading-relaxed text-[var(--foreground)]"
          multiline
        />
      </div>

      <Divider />

      {/* Messaging Strategy */}
      {(messaging.primary_message || messaging.tone) && (
        <>
          <div>
            <SectionHeader icon={Megaphone} title="Messaging Strategy" color="#6B21A8" />
            <div className="grid grid-cols-[1fr_auto] gap-8">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Primary Message</span>
                <EditableField
                  value={messaging.primary_message || ""}
                  editable={editable}
                  onSave={(v) => onFieldSave?.("messaging_strategy.primary_message", v)}
                  textClassName="text-[14px] leading-relaxed text-[var(--foreground)] font-medium"
                />
              </div>
              {messaging.tone && (
                <div className="text-right min-w-[120px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Tone</span>
                  <Tag color="#6B21A8">{messaging.tone}</Tag>
                </div>
              )}
            </div>
          </div>

          {/* Value Propositions */}
          {messaging.value_propositions && messaging.value_propositions.length > 0 && (
            <div className="mt-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Value Propositions</span>
              <BulletList items={messaging.value_propositions} color="#22c55e" />
            </div>
          )}

          <Divider />
        </>
      )}

      {/* Fallback: simple messaging array */}
      {!messaging.primary_message && Array.isArray(briefData.messaging_strategy) && (
        <>
          <div>
            <SectionHeader icon={Megaphone} title="Messaging Strategy" color="#6B21A8" />
            <BulletList items={briefData.messaging_strategy} color="#6B21A8" />
          </div>
          <Divider />
        </>
      )}

      {/* Per-Persona Hooks */}
      {Object.keys(perPersonaHooks).length > 0 && (
        <>
          <div>
            <SectionHeader icon={Users} title="Persona Messaging Hooks" color="#E91E8C" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(perPersonaHooks).map(([key, hook], i) => (
                <PersonaHookCard
                  key={key}
                  personaKey={key}
                  hook={String(hook)}
                  motivations={motivationsByPersona[key] as string[]}
                  painPoints={painPointsByPersona[key] as string[]}
                  psychologyHook={psychologyByPersona[key] as string}
                />
              ))}
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* Channel Strategy */}
      {(channels.primary?.length > 0 || channels.secondary?.length > 0) && (
        <>
          <div>
            <SectionHeader icon={Globe} title="Channel Strategy" color="#0693E3" />
            <div className="grid grid-cols-2 gap-8">
              {channels.primary?.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1.5">Primary Channels</span>
                  <div className="flex flex-wrap gap-1.5">
                    {channels.primary.map((ch: string, i: number) => (
                      <Tag key={i} color="#0693E3">{ch}</Tag>
                    ))}
                  </div>
                </div>
              )}
              {channels.secondary?.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1.5">Secondary Channels</span>
                  <div className="flex flex-wrap gap-1.5">
                    {channels.secondary.map((ch: string, i: number) => (
                      <Tag key={i} color="#737373">{ch}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {channels.rationale && (
              <p className="text-[12px] text-[var(--muted-foreground)] mt-3 leading-relaxed italic">
                {channels.rationale}
              </p>
            )}
          </div>
          <Divider />
        </>
      )}

      {/* Language Configuration */}
      {(contentLang.primary || contentLang.dialect_notes) && (
        <>
          <div>
            <SectionHeader icon={Languages} title="Language & Tone" color="#9B51E0" />
            <div className="grid grid-cols-4 gap-4">
              {contentLang.primary && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Primary</span>
                  <span className="text-[13px] font-medium text-[var(--foreground)]">{contentLang.primary}</span>
                </div>
              )}
              {contentLang.secondary && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Secondary</span>
                  <span className="text-[13px] text-[var(--foreground)]">{contentLang.secondary}</span>
                </div>
              )}
              {contentLang.formality && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Formality</span>
                  <Tag color="#9B51E0">{contentLang.formality}</Tag>
                </div>
              )}
              {contentLang.dialect_notes && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Dialect Notes</span>
                  <span className="text-[12px] text-[var(--muted-foreground)]">{contentLang.dialect_notes}</span>
                </div>
              )}
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* Cultural Guardrails */}
      {(guardrails.things_to_avoid?.length > 0 || guardrails.things_to_lean_into?.length > 0) && (
        <>
          <div>
            <SectionHeader icon={Shield} title="Cultural Guardrails" color="#f59e0b" />
            <div className="grid grid-cols-2 gap-8">
              {guardrails.things_to_lean_into?.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#22c55e] block mb-2">
                    <Sparkles size={10} className="inline mr-1" />
                    Lean Into
                  </span>
                  <BulletList items={guardrails.things_to_lean_into} color="#22c55e" />
                </div>
              )}
              {guardrails.things_to_avoid?.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#ef4444] block mb-2">
                    <AlertTriangle size={10} className="inline mr-1" />
                    Avoid
                  </span>
                  <BulletList items={guardrails.things_to_avoid} color="#ef4444" />
                </div>
              )}
            </div>
            {guardrails.trust_signals?.length > 0 && (
              <div className="mt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1.5">Trust Signals</span>
                <div className="flex flex-wrap gap-1.5">
                  {guardrails.trust_signals.map((s: string, i: number) => (
                    <Tag key={i} color="#22c55e">{s}</Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Fallback: value_props if no structured messaging */}
      {briefData.value_props && !messaging.value_propositions && (
        <>
          <Divider />
          <div>
            <SectionHeader icon={Heart} title="Value Propositions" color="#E91E8C" />
            <BulletList items={briefData.value_props} color="#E91E8C" />
          </div>
        </>
      )}
    </div>
  );
}
