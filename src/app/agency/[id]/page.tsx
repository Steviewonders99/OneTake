"use client";

import { use, useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  Users,
  Target,
  DollarSign,
  Loader2,
  AlertCircle,
  Globe,
  Layers,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import type { GeneratedAsset, CreativeBrief, ActorProfile } from "@/lib/types";

// ── Types ─────────────────────────────────────────────

interface AgencyData {
  request: {
    id: string;
    title: string;
    task_type: string;
    target_regions: string[];
    target_languages: string[];
    status: string;
  };
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  actors: ActorProfile[];
  strategies: any[];
}

interface PersonaPackage {
  key: string;
  persona: Record<string, any>;
  assets: GeneratedAsset[];
  platforms: string[];
}

// ── Helpers ───────────────────────────────────────────

function platformLabel(p: string) {
  const labels: Record<string, string> = {
    ig_feed: "Instagram Feed", ig_story: "IG Stories", ig_carousel: "IG Carousel",
    facebook_feed: "Facebook Feed", linkedin_feed: "LinkedIn Feed",
    linkedin_carousel: "LinkedIn Carousel", tiktok_feed: "TikTok Feed",
    tiktok_carousel: "TikTok Carousel", telegram_card: "Telegram",
    twitter_post: "X/Twitter", google_display: "Display", youtube_feed: "YouTube",
    whatsapp_story: "WhatsApp", wechat_moments: "WeChat", pinterest_feed: "Pinterest",
  };
  return labels[p] || p.replace(/_/g, " ");
}

function groupByPersona(briefData: Record<string, any>, assets: GeneratedAsset[]): PersonaPackage[] {
  const personas: Record<string, any>[] = briefData.personas || [];
  const groups = new Map<string, PersonaPackage>();

  for (const p of personas) {
    const key = p.archetype_key || `persona_${personas.indexOf(p)}`;
    groups.set(key, { key, persona: p, assets: [], platforms: [] });
  }

  for (const asset of assets) {
    if (asset.asset_type === "base_image") continue;
    const pk = (asset.content as Record<string, any>)?.persona || "unassigned";
    if (!groups.has(pk)) {
      groups.set(pk, { key: pk, persona: { archetype_key: pk }, assets: [], platforms: [] });
    }
    groups.get(pk)!.assets.push(asset);
  }

  for (const g of groups.values()) {
    g.platforms = [...new Set(g.assets.map(a => a.platform).filter(Boolean))].sort();
  }

  return Array.from(groups.values()).filter(g => g.assets.length > 0);
}

// ── Main Content ──────────────────────────────────────

function AgencyContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [data, setData] = useState<AgencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Reuse the designer API endpoint (magic link auth)
        const res = await fetch(`/api/designer/${id}?token=${token}`);
        if (!res.ok) throw new Error("Invalid or expired link");
        const d = await res.json();

        // Fetch strategies
        let strategies: any[] = [];
        try {
          const stratRes = await fetch(`/api/generate/${id}/strategy`);
          if (stratRes.ok) {
            const sd = await stratRes.json();
            strategies = sd.strategies || [];
          }
        } catch { /* strategies optional */ }

        setData({
          request: d.request,
          brief: d.brief,
          assets: d.assets || [],
          actors: d.actors || [],
          strategies,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, token]);

  if (loading) return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#6B21A8]" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="text-center">
        <AlertCircle size={32} className="mx-auto text-red-500 mb-3" />
        <p className="text-base font-medium text-[var(--foreground)]">{error || "Link expired"}</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">Contact the marketing team for a new link.</p>
      </div>
    </div>
  );

  const briefData = (data.brief?.brief_data || {}) as Record<string, any>;
  const personaPackages = groupByPersona(briefData, data.assets);
  const strategies = data.strategies;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="gradient-accent h-1" />
      <header className="bg-white border-b border-[var(--border)] px-6 py-5">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold uppercase tracking-wider text-[#6B21A8] mb-1">OneForma Campaign Package</p>
              <h1 className="text-xl font-semibold text-[var(--foreground)]">{data.request.title}</h1>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                {data.request.task_type?.replace(/_/g, " ")} &middot; {data.request.target_regions?.join(", ") || "Global"} &middot; {personaPackages.length} personas &middot; {data.assets.filter(a => a.asset_type !== "base_image").length} creatives
              </p>
            </div>
            <button
              onClick={() => {
                window.open(`/api/export/${id}?token=${token}&type=composed`, "_blank");
                toast.success("Downloading all creatives...");
              }}
              className="btn-primary flex items-center gap-2 cursor-pointer"
            >
              <Download size={16} />
              Download All
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-8">

        {/* Campaign Strategy + Budget */}
        {(strategies.length > 0 || briefData.campaign_strategies_summary) && (
          <section className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={16} className="text-[#0693E3]" />
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Campaign Strategy & Budget</h2>
            </div>

            {/* Strategy summary cards */}
            {briefData.campaign_strategies_summary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {Object.entries(briefData.campaign_strategies_summary as Record<string, any>).map(([region, s]: [string, any]) => (
                  <div key={region} className="border border-[var(--border)] rounded-xl p-4" style={{ borderTopColor: "#0693E3", borderTopWidth: "2px" }}>
                    <h3 className="text-[14px] font-bold text-[var(--foreground)] mb-2">{region}</h3>
                    <div className="space-y-1.5 text-[12px]">
                      <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Tier</span><span className="font-semibold text-[#0693E3]">Tier {s.tier || 1}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Ad Sets</span><span className="font-medium">{s.ad_set_count || "—"}</span></div>
                      {s.split_test_variable && <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Split Test</span><span className="font-medium capitalize">{s.split_test_variable}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Full strategy details */}
            {strategies.map((strat: any) => {
              const sd = strat.strategy_data || {};
              const campaigns: any[] = sd.campaigns || [];
              return (
                <div key={strat.id} className="border border-[var(--border)] rounded-xl overflow-hidden mb-4">
                  <div className="px-4 py-3 bg-[var(--muted)] flex items-center justify-between" style={{ borderLeft: "3px solid #6B21A8" }}>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-semibold">{strat.country}</span>
                      <span className="px-2 py-0.5 rounded-lg text-[12px] font-semibold bg-purple-50 text-[#6B21A8]">Tier {strat.tier}</span>
                    </div>
                    <span className="text-[14px] font-bold">${strat.monthly_budget?.toLocaleString()}/mo</span>
                  </div>
                  {campaigns.map((camp: any, ci: number) => (
                    <div key={ci} className="px-4 py-3 border-t border-[var(--border)]">
                      <span className="text-[12px] font-bold text-[var(--foreground)] block mb-2">{camp.name || `Campaign ${ci + 1}`}</span>
                      {camp.ad_sets?.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                          {camp.ad_sets.map((adSet: any, ai: number) => (
                            <div key={ai} className="border border-[var(--border)] rounded-lg p-2.5">
                              <span className="text-[12px] font-bold block mb-1">{adSet.name || `Ad Set ${ai + 1}`}</span>
                              {adSet.targeting_tier && (
                                <span className={`px-1.5 py-0.5 rounded text-[12px] font-semibold ${adSet.targeting_tier === "hyper" ? "bg-purple-50 text-purple-700" : adSet.targeting_tier === "hot" ? "bg-yellow-50 text-yellow-700" : "bg-green-50 text-green-700"}`}>
                                  {adSet.targeting_tier}
                                </span>
                              )}
                              {adSet.daily_budget && <span className="text-[12px] text-[var(--muted-foreground)] block mt-1">${adSet.daily_budget}/day</span>}
                              {adSet.interests?.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 mt-1">
                                  {adSet.interests.slice(0, 3).map((int: string, ii: number) => (
                                    <span key={ii} className="text-[12px] px-1 py-0.5 bg-[var(--muted)] rounded">{int}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        )}

        {/* Per-Persona Creative Packages */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-[var(--muted-foreground)]" />
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Creative Packages by Persona</h2>
          </div>

          <div className="space-y-6">
            {personaPackages.map((pkg, pi) => (
              <PersonaCard key={pkg.key} pkg={pkg} index={pi} requestId={id} token={token} />
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-white px-6 py-4 mt-12">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between text-[13px] text-[var(--muted-foreground)]">
          <span>OneForma Creative Package &middot; Generated by Nova</span>
          <span>Link expires in 7 days</span>
        </div>
      </footer>
    </div>
  );
}

// ── Persona Card ──────────────────────────────────────

function PersonaCard({
  pkg,
  index,
  requestId,
  token,
}: {
  pkg: PersonaPackage;
  index: number;
  requestId: string;
  token: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const colors = ["#6B21A8", "#0693E3", "#E91E8C", "#22c55e"];
  const color = colors[index % colors.length];
  const p = pkg.persona;
  const tp = p.targeting_profile || {};
  const interests = tp.interests || {};
  const demo = tp.demographics || {};

  // Group assets by platform
  const byPlatform = useMemo(() => {
    const map = new Map<string, GeneratedAsset[]>();
    for (const a of pkg.assets) {
      const plat = a.platform || "other";
      if (!map.has(plat)) map.set(plat, []);
      map.get(plat)!.push(a);
    }
    return map;
  }, [pkg.assets]);

  return (
    <div className="card overflow-hidden">
      {/* Persona Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-[var(--muted)]/30 transition-colors"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: color }}>
            {(p.persona_name || p.name || pkg.key)?.[0]?.toUpperCase() || "P"}
          </div>
          <div className="text-left">
            <h3 className="text-[14px] font-semibold text-[var(--foreground)]">
              {p.persona_name || p.name || pkg.key.replace(/_/g, " ")}
            </h3>
            <p className="text-[13px] text-[var(--muted-foreground)]">
              {p.age_range || ""} {p.region ? ` · ${p.region}` : ""} {demo.occupation ? ` · ${demo.occupation}` : ""}
              {` · ${pkg.assets.length} creatives · ${pkg.platforms.length} platforms`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Download all assets for this persona
              for (const a of pkg.assets) {
                if (a.blob_url) window.open(a.blob_url, "_blank");
              }
              toast.success(`Downloading ${pkg.assets.length} assets for ${p.persona_name || pkg.key}`);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--muted)] hover:bg-[var(--border)] rounded-lg text-[13px] font-medium cursor-pointer transition-colors"
          >
            <Download size={12} />
            Download Persona
          </button>
          {expanded ? <ChevronDown size={16} className="text-[var(--muted-foreground)]" /> : <ChevronRight size={16} className="text-[var(--muted-foreground)]" />}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-5">
          {/* Targeting & Interests */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Demographics */}
            <div className="border border-[var(--border)] rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Users size={12} style={{ color }} />
                <span className="text-[14px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Demographics</span>
              </div>
              <div className="space-y-1 text-[12px]">
                {p.age_range && <p><span className="text-[var(--muted-foreground)]">Age:</span> <span className="font-medium">{p.age_range}</span></p>}
                {p.region && <p><span className="text-[var(--muted-foreground)]">Region:</span> <span className="font-medium">{p.region}</span></p>}
                {demo.occupation && <p><span className="text-[var(--muted-foreground)]">Occupation:</span> <span className="font-medium">{demo.occupation}</span></p>}
                {demo.gender && <p><span className="text-[var(--muted-foreground)]">Gender:</span> <span className="font-medium">{demo.gender}</span></p>}
                {demo.education_level && <p><span className="text-[var(--muted-foreground)]">Education:</span> <span className="font-medium">{demo.education_level}</span></p>}
              </div>
            </div>

            {/* Targeting Interests */}
            <div className="border border-[var(--border)] rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Target size={12} style={{ color }} />
                <span className="text-[14px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Targeting Interests</span>
              </div>
              {(interests.hyper || []).length > 0 && (
                <div className="mb-2">
                  <span className="text-[12px] font-semibold text-[#6B21A8] uppercase">Hyper</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(interests.hyper as string[]).map((h: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[12px]">{h}</span>
                    ))}
                  </div>
                </div>
              )}
              {(interests.hot || []).length > 0 && (
                <div className="mb-2">
                  <span className="text-[12px] font-semibold text-[#f59e0b] uppercase">Hot</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(interests.hot as string[]).map((h: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded text-[12px]">{h}</span>
                    ))}
                  </div>
                </div>
              )}
              {(interests.broad || []).length > 0 && (
                <div>
                  <span className="text-[12px] font-semibold text-[#22c55e] uppercase">Broad</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(interests.broad as string[]).map((h: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[12px]">{h}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Budget Weight */}
            <div className="border border-[var(--border)] rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <DollarSign size={12} style={{ color }} />
                <span className="text-[14px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Budget & Pool</span>
              </div>
              <div className="space-y-1 text-[12px]">
                {tp.budget_weight_pct && <p><span className="text-[var(--muted-foreground)]">Budget share:</span> <span className="font-bold text-[16px]">{tp.budget_weight_pct}%</span></p>}
                {tp.estimated_pool_size && <p><span className="text-[var(--muted-foreground)]">Pool size:</span> <span className="font-medium capitalize">{tp.estimated_pool_size}</span></p>}
                {tp.expected_cpl_tier && <p><span className="text-[var(--muted-foreground)]">CPL tier:</span> <span className="font-medium capitalize">{tp.expected_cpl_tier}</span></p>}
              </div>
            </div>
          </div>

          {/* Creatives by Platform */}
          <div>
            <span className="text-[14px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-3">Creatives by Platform</span>
            {Array.from(byPlatform.entries()).map(([plat, assets]) => (
              <div key={plat} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <LayoutGrid size={13} className="text-[var(--muted-foreground)]" />
                    <span className="text-[12px] font-semibold text-[var(--foreground)]">{platformLabel(plat)}</span>
                    <span className="text-[12px] text-[var(--muted-foreground)]">{assets.length} creatives</span>
                  </div>
                  <button
                    onClick={() => {
                      for (const a of assets) {
                        if (a.blob_url) window.open(a.blob_url, "_blank");
                      }
                      toast.success(`Downloading ${assets.length} ${platformLabel(plat)} creatives`);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors"
                  >
                    <Download size={11} />
                    Download
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {assets.map((asset) => (
                    <div key={asset.id} className="border border-[var(--border)] rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow">
                      <div className="relative aspect-square bg-[var(--muted)]">
                        {asset.blob_url ? (
                          <img src={asset.blob_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center"><Layers size={14} className="text-[var(--muted-foreground)] opacity-30" /></div>
                        )}
                        {asset.evaluation_score && asset.evaluation_score > 0 && (
                          <div className={`absolute top-1 left-1 px-1 py-0.5 rounded text-[12px] font-bold text-white ${asset.evaluation_score >= 0.85 ? "bg-green-500" : "bg-yellow-500"}`}>
                            {(asset.evaluation_score * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-[12px] font-medium text-[var(--foreground)] truncate">
                          {(asset.content as Record<string, any>)?.overlay_headline || asset.format}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────

export default function AgencyPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-[#6B21A8]" /></div>}>
      <AgencyContent id={id} />
    </Suspense>
  );
}
