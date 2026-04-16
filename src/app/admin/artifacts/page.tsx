"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ToggleLeft, ToggleRight, ImageOff } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";

interface Artifact {
  artifact_id: string;
  category: string;
  description: string;
  blob_url: string;
  dimensions: string | null;
  css_class: string | null;
  usage_snippet: string;
  usage_notes: string | null;
  pillar_affinity: string[] | null;
  format_affinity: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const PILLAR_COLORS: Record<string, string> = {
  earn: "bg-green-100 text-green-700 border-green-200",
  grow: "bg-blue-100 text-blue-700 border-blue-200",
  shape: "bg-purple-100 text-purple-700 border-purple-200",
};

const IMAGE_CATEGORIES = new Set(["blob", "divider", "mask", "badge", "icon", "pattern", "frame", "logo"]);
const CSS_CATEGORIES = new Set(["gradient"]);
const CTA_CATEGORIES = new Set(["cta", "text_treatment"]);

const ALL_CATEGORIES = [
  "blob", "divider", "mask", "badge", "icon",
  "gradient", "pattern", "frame", "cta", "text_treatment", "logo",
];

function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  const [imgError, setImgError] = useState(false);

  if (IMAGE_CATEGORIES.has(artifact.category)) {
    if (imgError) {
      return (
        <div className="h-32 flex items-center justify-center bg-[#F5F5F5] rounded-lg">
          <ImageOff size={24} className="text-[#737373]" />
        </div>
      );
    }
    return (
      <div className="h-32 flex items-center justify-center bg-[#F5F5F5] rounded-lg overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artifact.blob_url}
          alt={artifact.description}
          className="max-h-full max-w-full object-contain"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  if (CSS_CATEGORIES.has(artifact.category)) {
    return (
      <div className="h-32 flex flex-col items-center justify-center bg-[#F5F5F5] rounded-lg gap-2 px-3">
        {artifact.css_class && (
          <div
            className={artifact.css_class}
            style={{ width: "100%", height: "48px", borderRadius: "8px" }}
          />
        )}
        {artifact.css_class && (
          <code className="text-[10px] text-[#737373] truncate w-full text-center">
            .{artifact.css_class}
          </code>
        )}
      </div>
    );
  }

  if (CTA_CATEGORIES.has(artifact.category)) {
    return (
      <div className="h-32 flex items-center justify-center bg-[#F5F5F5] rounded-lg overflow-hidden px-3">
        <div
          className="text-center text-sm"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(artifact.usage_snippet) }}
        />
      </div>
    );
  }

  return (
    <div className="h-32 flex items-center justify-center bg-[#F5F5F5] rounded-lg">
      <span className="text-xs text-[#737373]">{artifact.category}</span>
    </div>
  );
}

function ArtifactCard({
  artifact,
  onToggle,
}: {
  artifact: Artifact;
  onToggle: (id: string, currentState: boolean) => void;
}) {
  return (
    <div
      className="card p-4 flex flex-col gap-3"
      style={{
        borderRadius: "12px",
        opacity: artifact.is_active ? 1 : 0.55,
        border: "1px solid #E5E5E5",
      }}
    >
      <ArtifactPreview artifact={artifact} />

      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-medium text-[#1A1A1A] leading-snug line-clamp-2">
            {artifact.description}
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: "#F5F5F5", color: "#737373" }}
          >
            {artifact.category}
          </span>
        </div>

        {artifact.dimensions && (
          <span className="text-[11px] text-[#737373]">{artifact.dimensions}</span>
        )}
      </div>

      {artifact.pillar_affinity && artifact.pillar_affinity.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {artifact.pillar_affinity.map((pillar) => (
            <span
              key={pillar}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${PILLAR_COLORS[pillar] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
            >
              {pillar}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1 border-t border-[#E5E5E5]">
        <a
          href={artifact.blob_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-[#737373] hover:text-[#1A1A1A] transition-colors cursor-pointer"
        >
          <ExternalLink size={11} />
          View file
        </a>

        <div className="ml-auto">
          <button
            onClick={() => onToggle(artifact.artifact_id, artifact.is_active)}
            className="flex items-center gap-1.5 text-[11px] rounded-full px-3 py-1 cursor-pointer transition-colors"
            style={{
              background: artifact.is_active ? "#1A1A1A" : "#F5F5F5",
              color: artifact.is_active ? "#FFFFFF" : "#737373",
            }}
            title={artifact.is_active ? "Deactivate" : "Activate"}
          >
            {artifact.is_active ? (
              <>
                <ToggleRight size={13} />
                Active
              </>
            ) : (
              <>
                <ToggleLeft size={13} />
                Inactive
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/admin/artifacts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setArtifacts(data);
        } else {
          setError(data.error ?? "Failed to load artifacts");
        }
      })
      .catch(() => setError("Network error loading artifacts"))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (artifactId: string, currentActive: boolean) => {
    setToggling((prev) => new Set(prev).add(artifactId));

    try {
      if (currentActive) {
        // Soft-delete (deactivate)
        const res = await fetch("/api/admin/artifacts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifact_id: artifactId }),
        });
        if (!res.ok) throw new Error("Failed to deactivate");
        setArtifacts((prev) =>
          prev.map((a) =>
            a.artifact_id === artifactId ? { ...a, is_active: false } : a
          )
        );
      } else {
        // Re-activate via PUT
        const artifact = artifacts.find((a) => a.artifact_id === artifactId);
        if (!artifact) return;
        const res = await fetch("/api/admin/artifacts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...artifact, is_active: true }),
        });
        if (!res.ok) throw new Error("Failed to activate");
        setArtifacts((prev) =>
          prev.map((a) =>
            a.artifact_id === artifactId ? { ...a, is_active: true } : a
          )
        );
      }
    } catch {
      // Silently revert on failure — don't need a toast here
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(artifactId);
        return next;
      });
    }
  };

  const filtered = artifacts.filter((a) => {
    if (!showInactive && !a.is_active) return false;
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
    return true;
  });

  // Group by category
  const grouped = filtered.reduce<Record<string, Artifact[]>>((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {});

  const totalActive = artifacts.filter((a) => a.is_active).length;
  const totalInactive = artifacts.filter((a) => !a.is_active).length;

  return (
    <div className="p-6 space-y-6" style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Design Artifacts</h1>
          <p className="text-sm text-[#737373] mt-1">
            Manage reusable design assets used in creative generation
          </p>
        </div>

        {!loading && !error && (
          <div className="flex gap-3 text-sm">
            <div
              className="px-3 py-1.5 rounded-full text-center"
              style={{ background: "#F5F5F5" }}
            >
              <span className="font-semibold text-[#1A1A1A]">{totalActive}</span>
              <span className="text-[#737373] ml-1">active</span>
            </div>
            <div
              className="px-3 py-1.5 rounded-full text-center"
              style={{ background: "#F5F5F5" }}
            >
              <span className="font-semibold text-[#1A1A1A]">{totalInactive}</span>
              <span className="text-[#737373] ml-1">inactive</span>
            </div>
            <div
              className="px-3 py-1.5 rounded-full text-center"
              style={{ background: "#F5F5F5" }}
            >
              <span className="font-semibold text-[#1A1A1A]">{artifacts.length}</span>
              <span className="text-[#737373] ml-1">total</span>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm px-3 py-2 border border-[#E5E5E5] bg-white text-[#1A1A1A] cursor-pointer"
          style={{ borderRadius: "10px", outline: "none" }}
        >
          <option value="all">All categories</option>
          {ALL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-[#737373] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="cursor-pointer"
          />
          Show inactive
        </label>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-[#737373] text-sm">
          Loading artifacts...
        </div>
      )}

      {error && (
        <div
          className="p-4 text-sm text-red-700 rounded-xl"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
        >
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex items-center justify-center py-20 text-[#737373] text-sm">
          No artifacts match the current filters.
        </div>
      )}

      {/* Grouped grid */}
      {!loading && !error && Object.keys(grouped).length > 0 && (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-base font-semibold text-[#1A1A1A] capitalize">
                  {category.replace("_", " ")}
                </h2>
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "#F5F5F5", color: "#737373" }}
                >
                  {items.length}
                </span>
              </div>
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {items.map((artifact) => (
                  <ArtifactCard
                    key={artifact.artifact_id}
                    artifact={artifact}
                    onToggle={toggling.has(artifact.artifact_id) ? () => {} : handleToggle}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
