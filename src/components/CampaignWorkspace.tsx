"use client";

import { useState, useMemo, useRef } from "react";
import {
  Users,
  Target,
  Globe,
  Megaphone,
  ChevronDown,
  ChevronRight,
  Layers,
  Download,
  Pencil,
  LayoutGrid,
  Monitor,
  X,
  Sparkles,
  RefreshCw,
  Languages,
  Shield,
  Heart,
  AlertTriangle,
  Trash2,
  Type,
} from "lucide-react";
import MiniTabs from "@/components/MiniTabs";
import MockupPreview from "@/components/MockupPreview";
import EditableField from "@/components/EditableField";
import CreativeHtmlEditor from "@/components/CreativeHtmlEditor";
import { extractField } from "@/lib/format";
import { toast } from "sonner";
import type {
  GeneratedAsset,
  ActorProfile,
  CreativeBrief,
} from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────

interface CampaignWorkspaceProps {
  briefData: Record<string, any>;
  channelResearch?: Record<string, any> | null;
  designDirection?: Record<string, any> | null;
  campaignStrategies?: any[];
  actors: ActorProfile[];
  assets: GeneratedAsset[];
  editable?: boolean;
  onRefine?: (asset: GeneratedAsset) => void;
  onRetry?: (asset: GeneratedAsset) => void;
  onDelete?: (asset: GeneratedAsset) => void;
}

interface PersonaGroup {
  key: string;
  persona: Record<string, any>;
  actors: ActorProfile[];
  assets: GeneratedAsset[];
  platforms: string[];
}

// ── Platform metadata ────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, { label: string; color: string; icon: string }> = {
  ig_feed: { label: "Instagram", color: "#E1306C", icon: "IG" },
  instagram_feed: { label: "Instagram", color: "#E1306C", icon: "IG" },
  ig_story: { label: "IG Stories", color: "#E1306C", icon: "IG" },
  ig_carousel: { label: "IG Carousel", color: "#E1306C", icon: "IG" },
  facebook_feed: { label: "Facebook", color: "#1877F2", icon: "FB" },
  facebook_stories: { label: "FB Stories", color: "#1877F2", icon: "FB" },
  linkedin_feed: { label: "LinkedIn", color: "#0A66C2", icon: "LI" },
  linkedin_carousel: { label: "LI Carousel", color: "#0A66C2", icon: "LI" },
  tiktok_feed: { label: "TikTok", color: "#000000", icon: "TT" },
  tiktok_carousel: { label: "TT Carousel", color: "#000000", icon: "TT" },
  telegram_card: { label: "Telegram", color: "#0088cc", icon: "TG" },
  twitter_post: { label: "X/Twitter", color: "#1DA1F2", icon: "X" },
  wechat_moments: { label: "WeChat", color: "#07C160", icon: "WC" },
  wechat_carousel: { label: "WC Carousel", color: "#07C160", icon: "WC" },
  whatsapp_story: { label: "WhatsApp", color: "#25D366", icon: "WA" },
  google_display: { label: "Display", color: "#4285F4", icon: "GD" },
  pinterest_feed: { label: "Pinterest", color: "#E60023", icon: "PT" },
  youtube_feed: { label: "YouTube", color: "#FF0000", icon: "YT" },
};

function getPlatformMeta(platform: string) {
  return PLATFORM_ICONS[platform] || { label: platform.replace(/_/g, " "), color: "#6B21A8", icon: platform.slice(0, 2).toUpperCase() };
}

// ── Helpers ──────────────────────────────────────────────────────────

function groupByPersona(
  briefData: Record<string, any>,
  actors: ActorProfile[],
  assets: GeneratedAsset[],
): PersonaGroup[] {
  const personas: Record<string, any>[] = briefData.personas || [];
  const groups = new Map<string, PersonaGroup>();

  // Initialize groups from brief personas
  for (const p of personas) {
    const key = p.archetype_key || p.persona_key || `persona_${personas.indexOf(p)}`;
    groups.set(key, {
      key,
      persona: p,
      actors: [],
      assets: [],
      platforms: [],
    });
  }

  // Assign actors to persona groups
  for (const actor of actors) {
    const fl = actor.face_lock as Record<string, any> || {};
    const pk = fl.persona_key || fl.archetype_key || "unassigned";
    if (!groups.has(pk)) {
      groups.set(pk, { key: pk, persona: { archetype_key: pk }, actors: [], assets: [], platforms: [] });
    }
    groups.get(pk)!.actors.push(actor);
  }

  // Assign assets to persona groups
  const unassigned: GeneratedAsset[] = [];
  for (const asset of assets) {
    if (asset.asset_type === "base_image") continue; // Skip raw photos
    const content = (asset.content || {}) as Record<string, any>;
    const persona = content.persona || "";
    if (persona && groups.has(persona)) {
      groups.get(persona)!.assets.push(asset);
    } else {
      unassigned.push(asset);
    }
  }

  // Distribute unassigned assets evenly across named personas
  // so they show up in the persona cards instead of a giant "unassigned" section
  const namedGroups = Array.from(groups.values());
  if (namedGroups.length > 0 && unassigned.length > 0) {
    for (let i = 0; i < unassigned.length; i++) {
      namedGroups[i % namedGroups.length].assets.push(unassigned[i]);
    }
  }

  // Compute unique platforms per group
  for (const group of groups.values()) {
    group.platforms = [...new Set(group.assets.map(a => a.platform).filter(Boolean))].sort();
  }

  return Array.from(groups.values()).filter(g => g.assets.length > 0 || g.actors.length > 0);
}

// ── Platform Icon Button ─────────────────────────────────────────────

function PlatformIcon({
  platform,
  count,
  active,
  onClick,
}: {
  platform: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const meta = getPlatformMeta(platform);
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl cursor-pointer transition-all ${
        active
          ? "bg-white shadow-md border-2"
          : "bg-[var(--muted)] hover:bg-white hover:shadow-sm border-2 border-transparent"
      }`}
      style={active ? { borderColor: meta.color } : {}}
      title={meta.label}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-black text-white"
        style={{ backgroundColor: meta.color }}
      >
        {meta.icon}
      </div>
      <span className="text-[10px] font-medium text-[var(--foreground)] whitespace-nowrap">{meta.label}</span>
      <span className="text-[9px] text-[var(--muted-foreground)]">{count}</span>
    </button>
  );
}

// ── Creative Thumb (compact) ─────────────────────────────────────────

function CreativeThumb({
  asset,
  onClick,
  onDelete,
}: {
  asset: GeneratedAsset;
  onClick: () => void;
  onDelete?: (asset: GeneratedAsset) => void;
}) {
  const score = asset.evaluation_score || 0;
  const scoreColor = score >= 0.85 ? "#22c55e" : score >= 0.70 ? "#f59e0b" : "#ef4444";
  const content = (asset.content || {}) as Record<string, any>;

  return (
    <button
      onClick={onClick}
      className="group border border-[var(--border)] rounded-xl overflow-hidden bg-white hover:shadow-md transition-all cursor-pointer text-left"
    >
      <div className="relative aspect-square bg-[var(--muted)]">
        {asset.blob_url ? (
          <img src={asset.blob_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"><Layers size={16} className="text-[var(--muted-foreground)] opacity-30" /></div>
        )}
        {score > 0 && (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white" style={{ backgroundColor: scoreColor }}>
            {(score * 100).toFixed(0)}%
          </div>
        )}
        {content.slide_index && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 text-white text-[9px] font-bold flex items-center justify-center">
            {content.slide_index}
          </div>
        )}
        {/* Delete button on hover */}
        {onDelete && (
          <div
            onClick={(e) => { e.stopPropagation(); onDelete(asset); }}
            className="absolute bottom-1.5 right-1.5 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-600"
            title="Delete asset"
          >
            <Trash2 size={12} />
          </div>
        )}
      </div>
      <div className="px-2 py-1.5">
        <p className="text-[11px] font-medium text-[var(--foreground)] truncate">
          {content.overlay_headline || content.slide_headline || asset.format}
        </p>
      </div>
    </button>
  );
}

// ── Full-Screen Creative Editor Modal ────────────────────────────────

function CreativeEditorModal({
  asset,
  onClose,
  onRefine,
  onDelete,
  onChangeLayout,
  onEditHtml,
}: {
  asset: GeneratedAsset;
  onClose: () => void;
  onRefine?: (asset: GeneratedAsset) => void;
  onDelete?: (asset: GeneratedAsset) => void;
  onChangeLayout?: (asset: GeneratedAsset) => void;
  onEditHtml?: (asset: GeneratedAsset) => void;
}) {
  const content = (asset.content || {}) as Record<string, any>;
  const copyData = (asset.copy_data || {}) as Record<string, any>;
  const meta = getPlatformMeta(asset.platform);
  const score = asset.evaluation_score || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-[1200px] w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
        {/* Left: Creative / Mockup */}
        <div className="flex-1 bg-[#1a1a1a] relative flex items-center justify-center p-6 min-h-[300px]">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer transition-colors">
            <X size={18} className="text-white" />
          </button>
          {asset.blob_url ? (
            <img src={asset.blob_url} alt="" className="max-w-full max-h-[75vh] rounded-lg shadow-2xl" />
          ) : (
            <div className="bg-[#2a2a2a] rounded-lg overflow-hidden" style={{ maxWidth: "400px", width: "100%" }}>
              <MockupPreview asset={asset} />
            </div>
          )}
          {/* Bottom action bar */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-black text-white" style={{ backgroundColor: meta.color }}>
                {meta.icon}
              </div>
              <span className="text-[12px] text-white/70">{meta.label} · {asset.format}</span>
            </div>
            <div className="flex items-center gap-2">
              {onEditHtml && (content.creative_html || content.html) && (
                <button
                  onClick={() => { onEditHtml(asset); onClose(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6B21A8] hover:bg-[#5B21B6] rounded-lg text-[12px] font-semibold text-white cursor-pointer transition-colors"
                >
                  <Type size={13} />
                  Edit Live
                </button>
              )}
              {onChangeLayout && (
                <button
                  onClick={() => onChangeLayout(asset)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[12px] font-medium text-white cursor-pointer transition-colors"
                >
                  <Sparkles size={13} />
                  Change Layout
                </button>
              )}
              {asset.blob_url && (
                <button
                  onClick={() => window.open(asset.blob_url!, "_blank")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[12px] font-medium text-white cursor-pointer transition-colors"
                >
                  <Download size={13} />
                  Download
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Edit fields */}
        <div className="w-full md:w-[380px] border-l border-[var(--border)] overflow-y-auto p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Creative Details</h3>
            {score > 0 && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                score >= 0.85 ? "bg-green-50 text-green-700" : score >= 0.70 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"
              }`}>
                {(score * 100).toFixed(0)}% VQA
              </span>
            )}
          </div>

          {/* Headline */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Headline</label>
            <EditableField
              value={content.overlay_headline || copyData.headline || content.slide_headline || ""}
              editable
              onSave={(v) => toast.success(`Headline updated`)}
              textClassName="text-[14px] font-semibold text-[var(--foreground)]"
            />
          </div>

          {/* Subheadline */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Subheadline</label>
            <EditableField
              value={content.overlay_sub || copyData.description || ""}
              editable
              onSave={(v) => toast.success(`Subheadline updated`)}
              textClassName="text-[13px] text-[var(--muted-foreground)] leading-relaxed"
              multiline
            />
          </div>

          {/* CTA */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">CTA</label>
            <EditableField
              value={content.overlay_cta || copyData.cta || "Apply Now"}
              editable
              onSave={(v) => toast.success(`CTA updated`)}
              textClassName="text-[13px] font-medium text-[#6B21A8]"
            />
          </div>

          {/* Caption / Primary Text */}
          {(copyData.caption || copyData.primary_text) && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Caption</label>
              <EditableField
                value={copyData.caption || copyData.primary_text || ""}
                editable
                onSave={(v) => toast.success("Caption updated")}
                textClassName="text-[12px] text-[var(--muted-foreground)] leading-relaxed"
                multiline
              />
            </div>
          )}

          {/* Actor info */}
          {content.actor_name && (
            <div className="pt-3 border-t border-[var(--border)]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Actor</label>
              <p className="text-[13px] text-[var(--foreground)]">{content.actor_name}</p>
              {content.scene && <p className="text-[11px] text-[var(--muted-foreground)]">{content.scene.replace(/_/g, " ")}</p>}
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-[var(--border)] flex gap-2">
            {onRefine && (
              <button
                onClick={() => { onRefine(asset); onClose(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-[var(--border)] rounded-lg text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
              >
                <Pencil size={13} />
                Request Revision
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => { onDelete(asset); onClose(); }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-[12px] font-medium text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
              >
                <Trash2 size={13} />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Persona Section ──────────────────────────────────────────────────

function PersonaSection({
  group,
  index,
  onAssetClick,
  onRefine,
  onDelete,
}: {
  group: PersonaGroup;
  index: number;
  onAssetClick: (asset: GeneratedAsset) => void;
  onRefine?: (asset: GeneratedAsset) => void;
  onDelete?: (asset: GeneratedAsset) => void;
}) {
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const colors = ["#6B21A8", "#0693E3", "#E91E8C", "#22c55e"];
  const color = colors[index % colors.length];
  const p = group.persona;
  const tp = p.targeting_profile || {};
  const interests = tp.interests || {};
  const demo = tp.demographics || {};
  const psycho = tp.psychographics || {};

  // Group assets by platform
  const assetsByPlatform = useMemo(() => {
    const map = new Map<string, GeneratedAsset[]>();
    for (const asset of group.assets) {
      const plat = asset.platform || "unknown";
      if (!map.has(plat)) map.set(plat, []);
      map.get(plat)!.push(asset);
    }
    // Sort carousel slides by index
    for (const [, assets] of map) {
      assets.sort((a, b) => {
        const ai = (a.content as Record<string, any>)?.slide_index ?? 0;
        const bi = (b.content as Record<string, any>)?.slide_index ?? 0;
        return ai - bi;
      });
    }
    return map;
  }, [group.assets]);

  // Get 1 representative creative per platform (highest score)
  const representativeByPlatform = useMemo(() => {
    const reps = new Map<string, GeneratedAsset>();
    for (const [plat, assets] of assetsByPlatform) {
      const best = [...assets].sort((a, b) => (b.evaluation_score || 0) - (a.evaluation_score || 0))[0];
      if (best) reps.set(plat, best);
    }
    return reps;
  }, [assetsByPlatform]);

  const activePlatformAssets = activePlatform ? (assetsByPlatform.get(activePlatform) || []) : [];

  return (
    <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-white">
      {/* Persona Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-[var(--muted)]/50 transition-colors"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: color }}>
            {(p.persona_name || p.name || group.key)?.[0]?.toUpperCase() || "P"}
          </div>
          <div className="text-left">
            <h3 className="text-[14px] font-semibold text-[var(--foreground)]">
              {p.persona_name || p.name || group.key.replace(/_/g, " ")}
            </h3>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {p.age_range || (demo.age_min && demo.age_max ? `${demo.age_min}-${demo.age_max}` : "")}
              {p.region ? ` · ${p.region}` : ""}
              {demo.occupation ? ` · ${demo.occupation}` : ""}
              {` · ${group.assets.length} creatives · ${group.platforms.length} platforms`}
            </p>
          </div>
        </div>
        {expanded ? <ChevronDown size={18} className="text-[var(--muted-foreground)]" /> : <ChevronRight size={18} className="text-[var(--muted-foreground)]" />}
      </button>

      {/* Collapsed preview — platform icons + top creative thumbnail */}
      {!expanded && group.platforms.length > 0 && (
        <div className="px-5 pb-3 flex items-center gap-3">
          <div className="flex gap-1.5">
            {group.platforms.slice(0, 8).map(plat => {
              const meta = getPlatformMeta(plat);
              return (
                <div key={plat} className="w-7 h-7 rounded-md flex items-center justify-center text-[8px] font-black text-white" style={{ backgroundColor: meta.color }} title={meta.label}>
                  {meta.icon}
                </div>
              );
            })}
          </div>
          <span className="text-[11px] text-[var(--muted-foreground)]">{group.assets.length} creatives across {group.platforms.length} platforms</span>
          {/* Show first 3 thumbnails */}
          <div className="flex gap-1 ml-auto">
            {group.assets.filter(a => a.blob_url).slice(0, 3).map(a => (
              <div key={a.id} className="w-8 h-8 rounded-md overflow-hidden bg-[var(--muted)]">
                <img src={a.blob_url!} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Row 1: Demographics + Psychographics + Channels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Demographics */}
            <div className="border border-[var(--border)] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <Users size={12} style={{ color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Demographics</span>
              </div>
              <div className="space-y-1 text-[12px]">
                {p.age_range && <p><span className="text-[var(--muted-foreground)]">Age:</span> <span className="font-medium">{p.age_range}</span></p>}
                {p.region && <p><span className="text-[var(--muted-foreground)]">Region:</span> <span className="font-medium">{p.region}</span></p>}
                {demo.occupation && <p><span className="text-[var(--muted-foreground)]">Occupation:</span> <span className="font-medium">{demo.occupation}</span></p>}
                {demo.education_level && <p><span className="text-[var(--muted-foreground)]">Education:</span> <span className="font-medium">{demo.education_level}</span></p>}
                {p.lifestyle && <p><span className="text-[var(--muted-foreground)]">Lifestyle:</span> <span className="font-medium">{p.lifestyle}</span></p>}
              </div>
            </div>

            {/* Psychographics */}
            <div className="border border-[var(--border)] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <Heart size={12} style={{ color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Psychographics</span>
              </div>
              {(p.motivations || []).length > 0 && (
                <div>
                  <span className="text-[9px] font-semibold text-[#22c55e] uppercase">Motivations</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(p.motivations as string[]).slice(0, 4).map((m: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px]">{m}</span>
                    ))}
                  </div>
                </div>
              )}
              {(p.pain_points || []).length > 0 && (
                <div>
                  <span className="text-[9px] font-semibold text-red-500 uppercase">Pain Points</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(p.pain_points as string[]).slice(0, 3).map((pp: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px]">{pp}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Channel Targeting */}
            <div className="border border-[var(--border)] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <Target size={12} style={{ color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Targeting</span>
              </div>
              {(interests.hyper || []).length > 0 && (
                <div>
                  <span className="text-[9px] font-semibold text-[#6B21A8] uppercase">Hyper</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(interests.hyper as string[]).slice(0, 3).map((h: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px]">{h}</span>
                    ))}
                  </div>
                </div>
              )}
              {(interests.hot || []).length > 0 && (
                <div>
                  <span className="text-[9px] font-semibold text-[#f59e0b] uppercase">Hot</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(interests.hot as string[]).slice(0, 3).map((h: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded text-[10px]">{h}</span>
                    ))}
                  </div>
                </div>
              )}
              {(p.trigger_words || []).length > 0 && (
                <div>
                  <span className="text-[9px] font-semibold text-[var(--muted-foreground)] uppercase">Triggers</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(p.trigger_words as string[]).slice(0, 4).map((t: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-[var(--muted)] text-[var(--foreground)] rounded text-[10px]">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Platform Icons */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Platforms & Creatives</span>
            <div className="flex flex-wrap gap-2">
              {group.platforms.map(plat => {
                const count = assetsByPlatform.get(plat)?.length || 0;
                return (
                  <PlatformIcon
                    key={plat}
                    platform={plat}
                    count={count}
                    active={activePlatform === plat}
                    onClick={() => setActivePlatform(activePlatform === plat ? null : plat)}
                  />
                );
              })}
            </div>
          </div>

          {/* Row 3: Representative creatives (1 per platform) when no platform selected */}
          {!activePlatform && representativeByPlatform.size > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Array.from(representativeByPlatform.entries()).map(([plat, asset]) => {
                const meta = getPlatformMeta(plat);
                return (
                  <div key={plat} className="space-y-1">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-4 h-4 rounded flex items-center justify-center text-[7px] font-black text-white" style={{ backgroundColor: meta.color }}>
                        {meta.icon}
                      </div>
                      <span className="text-[10px] font-medium text-[var(--muted-foreground)]">{meta.label}</span>
                    </div>
                    <CreativeThumb asset={asset} onClick={() => onAssetClick(asset)} onDelete={onDelete} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Row 4: All creatives for selected platform */}
          {activePlatform && activePlatformAssets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black text-white" style={{ backgroundColor: getPlatformMeta(activePlatform).color }}>
                    {getPlatformMeta(activePlatform).icon}
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--foreground)]">{getPlatformMeta(activePlatform).label}</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">{activePlatformAssets.length} creatives</span>
                </div>
              </div>

              {/* Creatives grid — capped height with scroll */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[360px] overflow-y-auto pr-1">
                {activePlatformAssets.map(asset => (
                  <CreativeThumb key={asset.id} asset={asset} onClick={() => onAssetClick(asset)} onDelete={onDelete} />
                ))}
              </div>

              {/* Mockups for this platform — first 4 only */}
              <div className="mt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Ad Mockups</span>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {activePlatformAssets.slice(0, 4).map(asset => (
                    <button key={`mock-${asset.id}`} onClick={() => onAssetClick(asset)} className="border border-[var(--border)] rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow cursor-pointer text-left">
                      <div className="bg-[#1a1a1a] p-2">
                        <MockupPreview asset={asset} />
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-[11px] font-medium text-[var(--foreground)] truncate">
                          {(asset.content as Record<string, any>)?.overlay_headline || asset.format}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function CampaignWorkspace({
  briefData,
  channelResearch,
  designDirection,
  campaignStrategies = [],
  actors,
  assets,
  editable = false,
  onRefine,
  onRetry,
  onDelete,
}: CampaignWorkspaceProps) {
  const [selectedAsset, setSelectedAsset] = useState<GeneratedAsset | null>(null);
  const [htmlEditorAsset, setHtmlEditorAsset] = useState<GeneratedAsset | null>(null);

  const messaging = briefData.messaging_strategy || {};
  const channels = briefData.channels || {};
  const guardrails = briefData.cultural_guardrails || {};
  const contentLang = briefData.content_language || {};

  // Group everything by persona
  const personaGroups = useMemo(
    () => groupByPersona(briefData, actors, assets),
    [briefData, actors, assets]
  );

  const handleChangeLayout = async (asset: GeneratedAsset) => {
    try {
      const res = await fetch(`/api/assets/${asset.id}/relayout`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to request layout change");
        return;
      }
      const data = await res.json();
      toast.success("Layout change queued — GLM-5 generating new variation...");
    } catch {
      toast.error("Failed to request layout change");
    }
  };

  return (
    <div className="space-y-4">
      {/* Top: Campaign Overview + Regional tabs */}
      <MiniTabs
        defaultTab="campaign"
        tabs={[
          {
            key: "campaign",
            label: "Campaign",
            content: (
              <div className="space-y-4">
                {/* Objective */}
                {(briefData.campaign_objective || briefData.summary) && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Campaign Objective</span>
                    <p className="text-[14px] leading-relaxed text-[var(--foreground)]">{briefData.campaign_objective || briefData.summary}</p>
                  </div>
                )}
                {/* Messaging */}
                {messaging.primary_message && (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Primary Message</span>
                      <p className="text-[13px] font-medium text-[var(--foreground)]">{messaging.primary_message}</p>
                    </div>
                    {messaging.tone && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Tone</span>
                        <span className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-[#6B21A8] border border-purple-100">{messaging.tone}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Value Props */}
                {(messaging.value_propositions || briefData.value_props) && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Value Propositions</span>
                    <ul className="space-y-1">
                      {(messaging.value_propositions || briefData.value_props || []).slice(0, 6).map((vp: any, i: number) => {
                        let text = "";
                        if (typeof vp === "string") {
                          text = vp;
                        } else if (vp && typeof vp === "object") {
                          // Extract the most meaningful string from the object
                          text = vp.text || vp.value || vp.proposition || vp.description || vp.message || "";
                          // If none of those keys exist, try to find any string value that isn't a key name
                          if (!text) {
                            const vals = Object.values(vp).filter(v => typeof v === "string" && (v as string).length > 10);
                            text = (vals[0] as string) || "";
                          }
                          // Last resort: skip this item rather than showing JSON
                          if (!text) return null;
                        }
                        return (
                          <li key={i} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] flex-shrink-0 mt-[7px]" />
                            <span className="text-[13px] text-[var(--foreground)] leading-relaxed">{text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {/* Strategy summary */}
                {briefData.campaign_strategies_summary && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Media Strategy</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(briefData.campaign_strategies_summary as Record<string, any>).map(([region, s]: [string, any]) => (
                        <div key={region} className="border border-[var(--border)] rounded-xl p-3" style={{ borderTopColor: "#0693E3", borderTopWidth: "2px" }}>
                          <span className="text-[12px] font-bold text-[var(--foreground)]">{region}</span>
                          <div className="mt-1 text-[11px] text-[var(--muted-foreground)] space-y-0.5">
                            <p>Tier {s.tier || 1} · {s.ad_set_count || "?"} ad sets</p>
                            {s.split_test_variable && <p>Split test: {s.split_test_variable}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "regional",
            label: "Regional Intelligence",
            content: (
              <div className="space-y-4">
                {/* Language */}
                {contentLang.primary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Language</span>
                      <span className="text-[13px] font-medium text-[var(--foreground)]">{contentLang.primary}</span>
                    </div>
                    {contentLang.formality && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Formality</span>
                        <span className="text-[13px] text-[var(--foreground)]">{contentLang.formality}</span>
                      </div>
                    )}
                    {contentLang.dialect_notes && (
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Dialect Notes</span>
                        <span className="text-[12px] text-[var(--muted-foreground)]">{contentLang.dialect_notes}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Cultural guardrails */}
                {(guardrails.things_to_lean_into?.length > 0 || guardrails.things_to_avoid?.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {guardrails.things_to_lean_into?.length > 0 && (
                      <div className="border border-[var(--border)] rounded-xl p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#22c55e] block mb-2">Lean Into</span>
                        <ul className="space-y-1">
                          {guardrails.things_to_lean_into.map((item: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--foreground)]">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mt-[6px] flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {guardrails.things_to_avoid?.length > 0 && (
                      <div className="border border-[var(--border)] rounded-xl p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#ef4444] block mb-2">Avoid</span>
                        <ul className="space-y-1">
                          {guardrails.things_to_avoid.map((item: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--foreground)]">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] mt-[6px] flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {/* Channels */}
                {(channels.primary?.length > 0 || channels.secondary?.length > 0) && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Channel Strategy</span>
                    <div className="flex flex-wrap gap-2">
                      {(channels.primary || []).map((ch: string) => {
                        const clean = ch.replace(/\s*\(.*$/, "").trim();
                        const meta = getPlatformMeta(clean.toLowerCase().replace(/\s+/g, "_"));
                        return (
                          <span key={ch} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border" style={{ borderColor: `${meta.color}30`, color: meta.color, backgroundColor: `${meta.color}08` }}>
                            <span className="w-3 h-3 rounded flex items-center justify-center text-[6px] font-black text-white" style={{ backgroundColor: meta.color }}>{meta.icon}</span>
                            {clean}
                          </span>
                        );
                      })}
                      {(channels.secondary || []).map((ch: string) => {
                        const clean = ch.replace(/\s*\(.*$/, "").trim();
                        return (
                          <span key={ch} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[var(--muted-foreground)] bg-[var(--muted)]">
                            {clean}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Persona Sections */}
      {personaGroups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[var(--muted-foreground)]" />
              <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Personas & Creatives</h2>
              <span className="text-[11px] text-[var(--muted-foreground)]">{personaGroups.length} personas · {assets.filter(a => a.asset_type !== "base_image").length} creatives</span>
            </div>
          </div>
          {personaGroups.map((group, i) => (
            <PersonaSection
              key={group.key}
              group={group}
              index={i}
              onAssetClick={setSelectedAsset}
              onRefine={onRefine}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Full-screen editor modal */}
      {selectedAsset && !htmlEditorAsset && (
        <CreativeEditorModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onRefine={onRefine}
          onDelete={onDelete}
          onChangeLayout={handleChangeLayout}
          onEditHtml={(asset) => { setHtmlEditorAsset(asset); setSelectedAsset(null); }}
        />
      )}

      {/* Interactive HTML Editor — full-screen Pomelli-style */}
      {htmlEditorAsset && (
        <CreativeHtmlEditor
          asset={htmlEditorAsset}
          onClose={() => setHtmlEditorAsset(null)}
          onChangeLayout={handleChangeLayout}
          onSave={(asset, html) => {
            toast.success("Creative edits saved locally");
          }}
        />
      )}
    </div>
  );
}
