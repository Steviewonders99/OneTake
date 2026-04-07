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
import MediaStrategyTab from "@/components/MediaStrategyTab";
import { extractField } from "@/lib/format";
import { toast } from "sonner";
import type {
  GeneratedAsset,
  ActorProfile,
  CreativeBrief,
} from "@/lib/types";
import { getPlatformMeta, PlatformLogo, toChannel } from "@/lib/platforms";

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

  // Assign actors to persona groups — deduplicate by name, prefer actors with images
  const actorsByName = new Map<string, ActorProfile>();
  for (const actor of actors) {
    const name = actor.name || "unknown";
    const existing = actorsByName.get(name);
    if (!existing) {
      actorsByName.set(name, actor);
    } else {
      // Keep the one that has base_image assets
      const existingHasImages = assets.some(a => a.asset_type === "base_image" && String(a.actor_id) === String(existing.id) && a.blob_url);
      const newHasImages = assets.some(a => a.asset_type === "base_image" && String(a.actor_id) === String(actor.id) && a.blob_url);
      if (newHasImages && !existingHasImages) {
        actorsByName.set(name, actor);
      }
    }
  }
  for (const actor of actorsByName.values()) {
    const fl = (typeof actor.face_lock === "string" ? JSON.parse(actor.face_lock || "{}") : actor.face_lock) as Record<string, any> || {};
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
      <div className="w-9 h-9 flex items-center justify-center">
        <PlatformLogo brand={meta.brand} className="w-8 h-8" />
      </div>
      <span className="text-[12px] font-medium text-[var(--foreground)] whitespace-nowrap">{meta.label}</span>
      <span className="text-[12px] text-[var(--muted-foreground)]">{count}</span>
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
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[12px] font-bold text-white" style={{ backgroundColor: scoreColor }}>
            {(score * 100).toFixed(0)}%
          </div>
        )}
        {content.slide_index && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 text-white text-[12px] font-bold flex items-center justify-center">
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
        <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      {/* 80vw centered 2-column modal */}
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row" style={{ width: "80vw", maxWidth: "1400px", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>

        {/* LEFT: Creative Preview */}
        <div className="flex-1 bg-[#1a1a1a] relative flex items-center justify-center p-8 min-h-[400px]">
          {/* Close button */}
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer transition-colors z-10">
            <X size={18} className="text-white" />
          </button>

          {asset.blob_url ? (
            <img src={asset.blob_url} alt="" className="max-w-full max-h-[75vh] rounded-lg shadow-2xl object-contain" />
          ) : (
            <div className="w-full max-w-[400px]">
              <MockupPreview asset={asset} />
            </div>
          )}

          {/* Bottom bar */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlatformLogo brand={meta.brand} className="w-5 h-5" />
              <span className="text-[12px] text-white/60">{meta.label} · {asset.format}</span>
            </div>
            {score > 0 && (
              <span className={`text-[12px] font-bold px-2 py-0.5 rounded ${
                score >= 0.85 ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"
              }`}>
                {(score * 100).toFixed(0)}% VQA
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: Edit Fields + Actions */}
        <div className="w-full md:w-[380px] flex flex-col border-l border-[var(--border)] overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--muted)]">
            <h3 className="text-[14px] font-semibold text-[var(--foreground)]">Creative Details</h3>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{content.actor_name ? `${content.actor_name} · ` : ""}{meta.label}</p>
          </div>

          {/* Fields */}
          <div className="p-6 space-y-5 flex-1">
            <div>
              <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Headline</label>
              <EditableField
                value={content.overlay_headline || copyData.headline || content.slide_headline || ""}
                editable
                onSave={(v) => toast.success("Headline updated")}
                textClassName="text-[14px] font-semibold text-[var(--foreground)]"
              />
            </div>
            <div>
              <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Subheadline</label>
              <EditableField
                value={content.overlay_sub || copyData.description || ""}
                editable
                onSave={(v) => toast.success("Subheadline updated")}
                textClassName="text-[13px] text-[var(--muted-foreground)] leading-relaxed"
                multiline
              />
            </div>
            <div>
              <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">CTA</label>
              <EditableField
                value={content.overlay_cta || copyData.cta || "Apply Now"}
                editable
                onSave={(v) => toast.success("CTA updated")}
                textClassName="text-[13px] font-medium text-[#6B21A8]"
              />
            </div>
            {(copyData.caption || copyData.primary_text) && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Caption</label>
                <EditableField
                  value={copyData.caption || copyData.primary_text || ""}
                  editable
                  onSave={(v) => toast.success("Caption updated")}
                  textClassName="text-[12px] text-[var(--muted-foreground)] leading-relaxed"
                  multiline
                />
              </div>
            )}
            {content.actor_name && (
              <div className="pt-4 border-t border-[var(--border)]">
                <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Actor</label>
                <p className="text-[13px] text-[var(--foreground)]">{content.actor_name}</p>
                {content.scene && <p className="text-[12px] text-[var(--muted-foreground)]">{content.scene.replace(/_/g, " ")}</p>}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--muted)] space-y-2">
            <div className="flex gap-2">
              {onEditHtml && (content.creative_html || content.html) && (
                <button onClick={() => { onEditHtml(asset); onClose(); }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#6B21A8] hover:bg-[#5B21B6] rounded-lg text-[12px] font-semibold text-white cursor-pointer transition-colors">
                  <Type size={13} /> Edit Live
                </button>
              )}
              {onChangeLayout && (
                <button onClick={() => onChangeLayout(asset)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-[var(--border)] bg-white hover:bg-white/80 rounded-lg text-[12px] font-medium cursor-pointer transition-colors">
                  <Sparkles size={13} /> Change Layout
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {asset.blob_url && (
                <button onClick={() => window.open(asset.blob_url!, "_blank")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-[var(--border)] bg-white rounded-lg text-[12px] font-medium cursor-pointer hover:bg-white/80 transition-colors">
                  <Download size={13} /> Download
                </button>
              )}
              {onRefine && (
                <button onClick={() => { onRefine(asset); onClose(); }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-[var(--border)] bg-white rounded-lg text-[12px] font-medium cursor-pointer hover:bg-white/80 transition-colors">
                  <Pencil size={13} /> Revise
                </button>
              )}
              {onDelete && (
                <button onClick={() => { onDelete(asset); onClose(); }} className="flex items-center justify-center gap-1.5 px-3 py-2 border border-red-200 bg-white rounded-lg text-[12px] font-medium text-red-600 cursor-pointer hover:bg-red-50 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
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
  allAssets,
  onAssetClick,
  onRefine,
  onDelete,
}: {
  group: PersonaGroup;
  index: number;
  allAssets: GeneratedAsset[];
  onAssetClick: (asset: GeneratedAsset) => void;
  onRefine?: (asset: GeneratedAsset) => void;
  onDelete?: (asset: GeneratedAsset) => void;
}) {
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [showCopy, setShowCopy] = useState(false);
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

  // Get 1 representative creative per platform — MUST have a blob_url (skip blanks)
  const representativeByPlatform = useMemo(() => {
    const reps = new Map<string, GeneratedAsset>();
    for (const [plat, assets] of assetsByPlatform) {
      // Prioritize assets with images, then by score
      const withImage = assets.filter(a => a.blob_url);
      const best = withImage.length > 0
        ? [...withImage].sort((a, b) => (b.evaluation_score || 0) - (a.evaluation_score || 0))[0]
        : assets[0]; // fallback to first even without image
      if (best) reps.set(plat, best);
    }
    return reps;
  }, [assetsByPlatform]);

  const activePlatformAssets = activePlatform ? (assetsByPlatform.get(activePlatform) || []) : [];

  // Group platforms by channel — handles both snake_case and Title Case
  const channelGroups = useMemo(() => {
    const groups = new Map<string, { platforms: string[]; totalAssets: number }>();
    for (const plat of group.platforms) {
      const channel = toChannel(plat);
      if (!channel) continue; // Skip filtered channels
      if (!groups.has(channel)) groups.set(channel, { platforms: [], totalAssets: 0 });
      groups.get(channel)!.platforms.push(plat);
      groups.get(channel)!.totalAssets += assetsByPlatform.get(plat)?.length || 0;
    }
    return groups;
  }, [group.platforms, assetsByPlatform]);

  // Get formats for active channel
  const activeChannelPlatforms = activeChannel ? (channelGroups.get(activeChannel)?.platforms || []) : [];

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
            <p className="text-[13px] text-[var(--muted-foreground)]">
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
                <div key={plat} className="w-7 h-7 flex items-center justify-center" title={meta.label}>
                  <PlatformLogo brand={meta.brand} className="w-6 h-6" />
                </div>
              );
            })}
          </div>
          <span className="text-[13px] text-[var(--muted-foreground)]">{group.assets.length} creatives across {group.platforms.length} platforms</span>
          {/* Show first 3 thumbnails */}
          <div className="flex gap-1 ml-auto">
            {group.assets.filter(a => a.blob_url).slice(0, 3).map(a => (
              <button key={a.id} onClick={(e) => { e.stopPropagation(); onAssetClick(a); }} className="w-8 h-8 rounded-md overflow-hidden bg-[var(--muted)] cursor-pointer hover:ring-2 hover:ring-[#6B21A8]/40 transition-all">
                <img src={a.blob_url!} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-5 pb-6 space-y-6">
          {/* Row 1: Demographics + Psychographics + Channels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Demographics */}
            <div className="border border-[var(--border)] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <Users size={12} style={{ color }} />
                <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Demographics</span>
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
                <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Psychographics</span>
              </div>
              {(p.motivations || []).length > 0 && (
                <div>
                  <span className="text-[12px] font-semibold text-[#22c55e] uppercase">Motivations</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(p.motivations as string[]).slice(0, 4).map((m: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[12px]">{m}</span>
                    ))}
                  </div>
                </div>
              )}
              {(p.pain_points || []).length > 0 && (
                <div>
                  <span className="text-[12px] font-semibold text-red-500 uppercase">Pain Points</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(p.pain_points as string[]).slice(0, 3).map((pp: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[12px]">{pp}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Channel Targeting */}
            <div className="border border-[var(--border)] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <Target size={12} style={{ color }} />
                <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Targeting</span>
              </div>
              {(interests.hyper || []).length > 0 && (
                <div>
                  <span className="text-[12px] font-semibold text-[#6B21A8] uppercase">Hyper</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(interests.hyper as string[]).slice(0, 3).map((h: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[12px]">{h}</span>
                    ))}
                  </div>
                </div>
              )}
              {(interests.hot || []).length > 0 && (
                <div>
                  <span className="text-[12px] font-semibold text-[#f59e0b] uppercase">Hot</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(interests.hot as string[]).slice(0, 3).map((h: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded text-[12px]">{h}</span>
                    ))}
                  </div>
                </div>
              )}
              {(p.trigger_words || []).length > 0 && (
                <div>
                  <span className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase">Triggers</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(p.trigger_words as string[]).slice(0, 4).map((t: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-[var(--muted)] text-[var(--foreground)] rounded text-[12px]">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 1.5: Actor Photos — pull from base_image assets */}
          {group.actors.length > 0 && (
            <div>
              <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Actors</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Prioritize actors that have images — compare as strings for UUID safety */}
                {[...group.actors]
                  .sort((a, b) => {
                    const aHas = allAssets.some(x => x.asset_type === "base_image" && String(x.actor_id) === String(a.id) && x.blob_url) ? 1 : 0;
                    const bHas = allAssets.some(x => x.asset_type === "base_image" && String(x.actor_id) === String(b.id) && x.blob_url) ? 1 : 0;
                    return bHas - aHas;
                  })
                  .slice(0, 4).map((actor) => {
                  const actorIdStr = String(actor.id);
                  const actorImage = allAssets
                    .filter(a => a.asset_type === "base_image" && String(a.actor_id) === actorIdStr && a.blob_url)
                    .sort((a, b) => (b.evaluation_score || 0) - (a.evaluation_score || 0))[0];
                  const imgUrl = actorImage?.blob_url || "";
                  return (
                    <div key={actor.id} className="border border-[var(--border)] rounded-xl overflow-hidden bg-white">
                      {imgUrl ? (
                        <div className="aspect-[4/3] relative bg-[var(--muted)]">
                          <img src={imgUrl} alt={actor.name} className="absolute inset-0 w-full h-full object-cover" />
                          {actorImage?.evaluation_score && (
                            <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[11px] font-bold text-white ${actorImage.evaluation_score >= 0.85 ? "bg-green-500" : "bg-yellow-500"}`}>
                              {((actorImage.evaluation_score) * 100).toFixed(0)}%
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-[4/3] bg-[var(--muted)] flex items-center justify-center">
                          <span className="text-[32px] font-bold text-[var(--muted-foreground)]">{actor.name?.[0]?.toUpperCase() || "?"}</span>
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-[14px] font-bold text-[var(--foreground)]">{actor.name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Row 2: Ad Messaging per Platform (collapsible) */}
          {(() => {
            const copyAssets = allAssets.filter(a =>
              a.asset_type === "copy" as any &&
              ((a.content as Record<string, any>)?.persona_name?.toLowerCase() === (p.persona_name || p.name || "").toLowerCase() ||
               (a.content as Record<string, any>)?.persona_key === group.key)
            );
            if (copyAssets.length === 0) return null;

            const copyByPlatform = new Map<string, any[]>();
            for (const asset of copyAssets) {
              const plat = asset.platform || "unknown";
              if (!copyByPlatform.has(plat)) copyByPlatform.set(plat, []);
              copyByPlatform.get(plat)!.push(asset);
            }

            return (
              <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowCopy(!showCopy)}
                  className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[var(--muted)]/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Megaphone size={14} className="text-[#6B21A8]" />
                    <span className="text-[13px] font-semibold text-[var(--foreground)]">Ad Messaging</span>
                    <span className="text-[12px] text-[var(--muted-foreground)]">{copyAssets.length} variations · {copyByPlatform.size} platforms</span>
                  </div>
                  {showCopy ? <ChevronDown size={16} className="text-[var(--muted-foreground)]" /> : <ChevronRight size={16} className="text-[var(--muted-foreground)]" />}
                </button>
                {showCopy && (
                  <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Array.from(copyByPlatform.entries()).map(([plat, assets]) => {
                      const meta = getPlatformMeta(plat);
                      return (
                        <div key={plat} className="border border-[var(--border)] rounded-xl overflow-hidden">
                          <div className="px-3 py-2 bg-[var(--muted)] flex items-center gap-2">
                            <PlatformLogo brand={meta.brand} className="w-4 h-4" />
                            <span className="text-[13px] font-semibold text-[var(--foreground)]">{meta.label || plat.replace(/_/g, " ")}</span>
                            <span className="text-[12px] text-[var(--muted-foreground)]">{assets.length}</span>
                          </div>
                          <div className="divide-y divide-[var(--border)]">
                            {assets.map((asset: any) => {
                              const content = (asset.content || {}) as Record<string, any>;
                              const cd = content.copy_data || {};
                              const angle = content.copy_angle || "";
                              const headline = cd.headline || cd.card_headline || cd.tweet_text || "";
                              const primaryText = cd.primary_text || cd.message_text || cd.introductory_text || "";
                              const description = cd.description || cd.card_description || "";
                              const cta = cd.cta || cd.cta_button || cd.cta_text || cd.button_text || "";
                              if (!headline && !primaryText) return null;
                              return (
                                <div key={asset.id} className="px-3 py-2.5 space-y-1">
                                  {angle && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700 capitalize inline-block mb-1">
                                      {angle.replace(/^(primary_|secondary_)/, "").replace(/_/g, " ")}
                                    </span>
                                  )}
                                  {headline && <p className="text-[13px] font-bold text-[var(--foreground)] leading-snug">{headline}</p>}
                                  {primaryText && <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed line-clamp-2">{primaryText}</p>}
                                  {cta && (
                                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#6B21A8] text-white mt-1">{cta}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Row 3: Channel Icons (grouped) */}
          <div>
            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Channels</span>
            <div className="flex flex-wrap gap-2">
              {Array.from(channelGroups.entries()).map(([channel, { platforms: plats, totalAssets }]) => {
                const firstPlat = plats[0] || "";
                const meta = getPlatformMeta(firstPlat);
                const isActive = activeChannel === channel;
                return (
                  <button
                    key={channel}
                    onClick={() => {
                      setActiveChannel(isActive ? null : channel);
                      setActivePlatform(null);
                    }}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl cursor-pointer transition-all ${
                      isActive ? "bg-white shadow-md border-2" : "bg-[var(--muted)] hover:bg-white hover:shadow-sm border-2 border-transparent"
                    }`}
                    style={isActive ? { borderColor: meta.color } : {}}
                  >
                    <PlatformLogo brand={meta.brand} className="w-7 h-7" />
                    <span className="text-[12px] font-medium text-[var(--foreground)]">{channel}</span>
                    <span className="text-[11px] text-[var(--muted-foreground)]">{totalAssets}</span>
                  </button>
                );
              })}
            </div>
            {/* Format sub-tabs for active channel */}
            {activeChannel && activeChannelPlatforms.length > 1 && (
              <div className="flex gap-2 mt-3">
                {activeChannelPlatforms.map(plat => {
                  const format = plat.split("_").slice(1).join(" ") || "feed";
                  const count = assetsByPlatform.get(plat)?.length || 0;
                  const isActive = activePlatform === plat;
                  return (
                    <button
                      key={plat}
                      onClick={() => setActivePlatform(isActive ? null : plat)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-all capitalize ${
                        isActive ? "bg-[var(--foreground)] text-white" : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]"
                      }`}
                    >
                      {format} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Row 3: Best creative per platform — show for no channel selection OR single-format channel */}
          {!activeChannel && representativeByPlatform.size > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {Array.from(representativeByPlatform.entries()).map(([plat, asset]) => {
                const meta = getPlatformMeta(plat);
                return (
                  <button
                    key={plat}
                    onClick={() => setActivePlatform(plat)}
                    className="group border border-[var(--border)] rounded-xl overflow-hidden bg-white hover:shadow-md transition-all cursor-pointer text-left"
                  >
                    <div className="relative aspect-square bg-[var(--muted)]">
                      {asset.blob_url ? (
                        <img src={asset.blob_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center"><Layers size={14} className="text-[var(--muted-foreground)] opacity-30" /></div>
                      )}
                      <div className="absolute top-1.5 left-1.5 w-5 h-5 flex items-center justify-center">
                        <PlatformLogo brand={meta.brand} className="w-5 h-5" />
                      </div>
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium">
                        {assetsByPlatform.get(plat)?.length || 1}
                      </div>
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="text-[11px] font-medium text-[var(--foreground)] truncate">{meta.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Row 4a: All creatives for channel (when no specific format selected) */}
          {activeChannel && !activePlatform && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[14px] font-semibold text-[var(--foreground)]">{activeChannel}</span>
                <span className="text-[13px] text-[var(--muted-foreground)]">
                  {activeChannelPlatforms.reduce((sum, p) => sum + (assetsByPlatform.get(p)?.length || 0), 0)} creatives
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[360px] overflow-y-auto pr-1">
                {activeChannelPlatforms.flatMap(plat => (assetsByPlatform.get(plat) || [])).map(asset => (
                  <CreativeThumb key={asset.id} asset={asset} onClick={() => onAssetClick(asset)} onDelete={onDelete} />
                ))}
              </div>
            </div>
          )}

          {/* Row 4b: All creatives for selected specific format */}
          {activePlatform && activePlatformAssets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <PlatformLogo brand={getPlatformMeta(activePlatform).brand} className="w-6 h-6" />
                  </div>
                  <span className="text-[14px] font-semibold text-[var(--foreground)]">{getPlatformMeta(activePlatform).label}</span>
                  <span className="text-[13px] text-[var(--muted-foreground)]">{activePlatformAssets.length} creatives</span>
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
                <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Ad Mockups</span>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {activePlatformAssets.slice(0, 4).map(asset => (
                    <button key={`mock-${asset.id}`} onClick={() => onAssetClick(asset)} className="border border-[var(--border)] rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow cursor-pointer text-left">
                      <div className="bg-[#1a1a1a] p-2">
                        <MockupPreview asset={asset} />
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
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
  const [translateMode, setTranslateMode] = useState(false);

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
      {/* Translate toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setTranslateMode(!translateMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium cursor-pointer transition-colors ${
            translateMode
              ? "bg-blue-50 text-blue-700 border border-blue-200"
              : "bg-[var(--muted)] text-[var(--muted-foreground)] border border-transparent hover:bg-white hover:border-[var(--border)]"
          }`}
        >
          <Languages size={13} />
          {translateMode ? "Translation On" : "Translate to English"}
        </button>
      </div>

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
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Campaign Objective</span>
                    {editable ? (
                      <EditableField
                        value={briefData.campaign_objective || briefData.summary || ""}
                        editable={editable}
                        onSave={(v) => toast.success("Objective updated")}
                        textClassName="text-[14px] leading-relaxed text-[var(--foreground)]"
                        multiline
                      />
                    ) : (
                      <p className="text-[14px] leading-relaxed text-[var(--foreground)]">{briefData.campaign_objective || briefData.summary}</p>
                    )}
                  </div>
                )}
                {/* Messaging */}
                {messaging.primary_message && (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
                    <div>
                      <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Primary Message</span>
                      {editable ? (
                        <EditableField
                          value={messaging.primary_message}
                          editable={editable}
                          onSave={(v) => toast.success("Primary message updated")}
                          textClassName="text-[13px] font-medium text-[var(--foreground)]"
                          multiline
                        />
                      ) : (
                        <p className="text-[13px] font-medium text-[var(--foreground)]">{messaging.primary_message}</p>
                      )}
                    </div>
                    {messaging.tone && (
                      <div>
                        <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Tone</span>
                        {editable ? (
                          <EditableField
                            value={messaging.tone}
                            editable={editable}
                            onSave={(v) => toast.success("Tone updated")}
                            textClassName="text-[13px] font-medium text-[#6B21A8]"
                          />
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-[13px] font-medium bg-purple-50 text-[#6B21A8] border border-purple-100">{messaging.tone}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Value Props */}
                {(messaging.value_propositions || briefData.value_props) && (
                  <div>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Value Propositions</span>
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
                {/* Campaign Strategy Overview */}
                {briefData.campaign_strategies_summary && (
                  <div>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Campaign Strategy</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(briefData.campaign_strategies_summary as Record<string, any>).map(([region, s]: [string, any]) => (
                        <div key={region} className="border border-[var(--border)] rounded-xl p-4" style={{ borderTopColor: "#0693E3", borderTopWidth: "2px" }}>
                          <span className="text-[14px] font-bold text-[var(--foreground)]">{region}</span>
                          <div className="mt-2 text-[13px] text-[var(--muted-foreground)] space-y-1">
                            <p>Tier {s.tier || 1} · {s.ad_set_count || "?"} ad sets</p>
                            {s.split_test_variable && <p>Split test: <span className="font-medium text-[var(--foreground)] capitalize">{s.split_test_variable}</span></p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Budget Data */}
                {briefData.budget_data && (
                  <div>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Budget Allocation</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(briefData.budget_data as Record<string, any>).map(([key, val]: [string, any]) => {
                        if (typeof val !== "object" || !val) return null;
                        return (
                          <div key={key} className="border border-[var(--border)] rounded-xl p-3">
                            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">{key}</span>
                            {val.monthly_budget && <span className="text-[16px] font-bold text-[var(--foreground)]">${Number(val.monthly_budget).toLocaleString()}</span>}
                            {val.weight_pct && <span className="text-[12px] text-[var(--muted-foreground)] block">{val.weight_pct}% of total</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "media",
            label: "Media Strategy",
            content: (
              <MediaStrategyTab
                strategies={campaignStrategies as any}
                assets={assets}
                briefData={briefData}
              />
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
                      <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Language</span>
                      <span className="text-[13px] font-medium text-[var(--foreground)]">{contentLang.primary}</span>
                    </div>
                    {contentLang.formality && (
                      <div>
                        <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Formality</span>
                        <span className="text-[13px] text-[var(--foreground)]">{contentLang.formality}</span>
                      </div>
                    )}
                    {contentLang.dialect_notes && (
                      <div className="col-span-2">
                        <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Dialect Notes</span>
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
                        <span className="text-[12px] font-bold uppercase tracking-wider text-[#22c55e] block mb-2">Lean Into</span>
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
                        <span className="text-[12px] font-bold uppercase tracking-wider text-[#ef4444] block mb-2">Avoid</span>
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
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Channel Strategy</span>
                    <div className="flex flex-wrap gap-2">
                      {(channels.primary || []).map((ch: string) => {
                        const clean = ch.replace(/\s*\(.*$/, "").trim();
                        const meta = getPlatformMeta(clean.toLowerCase().replace(/\s+/g, "_"));
                        return (
                          <span key={ch} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-medium border" style={{ borderColor: `${meta.color}30`, color: meta.color, backgroundColor: `${meta.color}08` }}>
                            <PlatformLogo brand={meta.brand} className="w-4 h-4" />
                            {clean}
                          </span>
                        );
                      })}
                      {(channels.secondary || []).map((ch: string) => {
                        const clean = ch.replace(/\s*\(.*$/, "").trim();
                        return (
                          <span key={ch} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] text-[var(--muted-foreground)] bg-[var(--muted)]">
                            {clean}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Full Cultural Research */}
                {briefData.cultural_research && (
                  <div>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-3">Cultural Research</span>
                    <div className="space-y-3">
                      {Object.entries(briefData.cultural_research as Record<string, any>).map(([region, data]) => {
                        if (typeof data !== "object" || !data) return null;
                        return Object.entries(data as Record<string, any>).map(([dimension, content]) => {
                          if (dimension.startsWith("_")) return null;
                          const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
                          return (
                            <div key={`${region}-${dimension}`} className="border border-[var(--border)] rounded-xl p-4">
                              <h4 className="text-[14px] font-semibold text-[var(--foreground)] capitalize mb-2">
                                {dimension.replace(/_/g, " ")}
                              </h4>
                              <div className="text-[13px] text-[var(--muted-foreground)] leading-relaxed">
                                {typeof content === "object" && content !== null
                                  ? Object.entries(content as Record<string, unknown>).map(([k, v]) => (
                                      <div key={k} className="mb-3">
                                        <span className="font-semibold text-[var(--foreground)] capitalize block mb-0.5">{k.replace(/_/g, " ")}</span>
                                        <span className="leading-relaxed">{String(v)}</span>
                                      </div>
                                    ))
                                  : <span className="whitespace-pre-wrap">{text}</span>}
                              </div>
                            </div>
                          );
                        });
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
              <h2 className="text-[14px] font-semibold text-[var(--foreground)]">Personas & Creatives</h2>
              <span className="text-[13px] text-[var(--muted-foreground)]">{personaGroups.length} personas · {assets.filter(a => a.asset_type !== "base_image").length} creatives</span>
            </div>
          </div>
          {personaGroups.map((group, i) => (
            <PersonaSection
              key={group.key}
              group={group}
              index={i}
              allAssets={assets}
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
