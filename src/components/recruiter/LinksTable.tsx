"use client";

import { useState, useMemo } from "react";
import { Copy, ExternalLink, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { TrackedLinkWithAsset } from "@/lib/types";

interface Props {
  links: TrackedLinkWithAsset[];
}

const PAGE_SIZE = 20;

const CHANNEL_LABEL_MAP: Record<string, string> = {
  social: "Social",
  job_board: "Job Board",
  email: "Email",
  referral: "Referral",
  paid: "Paid",
  organic: "Organic",
  direct: "Direct",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
};

function getChannelLabel(source: string): string {
  return CHANNEL_LABEL_MAP[source?.toLowerCase()] ?? source;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportCSV(links: TrackedLinkWithAsset[]) {
  const headers = [
    "Short URL",
    "Channel",
    "Platform",
    "Recruiter ID",
    "Creative",
    "Clicks",
    "Created",
    "Destination URL",
  ];
  const rows = links.map((l) => [
    escapeCSV(l.short_url),
    escapeCSV(getChannelLabel(l.utm_source)),
    escapeCSV(l.asset_platform ?? ""),
    escapeCSV(l.recruiter_clerk_id),
    escapeCSV(l.asset_thumbnail ? "Yes" : "No creative"),
    escapeCSV(l.click_count),
    escapeCSV(l.created_at),
    escapeCSV(l.destination_url),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tracked-links-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const TH_STYLE: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 600,
  color: "#737373",
  textAlign: "left",
  borderBottom: "1px solid #E5E5E5",
  whiteSpace: "nowrap",
  background: "#FAFAFA",
};

export default function LinksTable({ links }: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return links;
    return links.filter(
      (l) =>
        l.short_url?.toLowerCase().includes(q) ||
        l.utm_source?.toLowerCase().includes(q) ||
        l.utm_content?.toLowerCase().includes(q) ||
        l.utm_term?.toLowerCase().includes(q)
    );
  }, [links, query]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageLinks = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const startIdx = page * PAGE_SIZE + 1;
  const endIdx = Math.min((page + 1) * PAGE_SIZE, filtered.length);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setPage(0);
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Copied to clipboard");
    });
  };

  // Generate page buttons (max 7)
  const pageButtons = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    const pages: (number | "...")[] = [];
    if (page <= 3) {
      for (let i = 0; i < 5; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages - 1);
    } else if (page >= totalPages - 4) {
      pages.push(0);
      pages.push("...");
      for (let i = totalPages - 5; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      pages.push("...");
      pages.push(page - 1);
      pages.push(page);
      pages.push(page + 1);
      pages.push("...");
      pages.push(totalPages - 1);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E8E8EA", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #E8E8EA" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>All Tracked Links</span>
      </div>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 18px",
          borderBottom: "1px solid #E5E5E5",
          background: "#FAFAFA",
        }}
      >
        {/* Search input */}
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search
            size={14}
            color="#737373"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search by URL, channel, platform..."
            style={{
              width: "100%",
              paddingLeft: 30,
              paddingRight: 12,
              paddingTop: 7,
              paddingBottom: 7,
              fontSize: 13,
              border: "1px solid #E5E5E5",
              borderRadius: 10,
              background: "#FFFFFF",
              color: "#1A1A1A",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Export button */}
        <button
          onClick={() => exportCSV(filtered)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 16px",
            background: "#32373C",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Download size={13} />
          Export
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH_STYLE}>Short URL</th>
              <th style={TH_STYLE}>Channel</th>
              <th style={TH_STYLE}>Platform</th>
              <th style={TH_STYLE}>Recruiter</th>
              <th style={TH_STYLE}>Creative</th>
              <th style={{ ...TH_STYLE, textAlign: "center" }}>Clicks</th>
              <th style={TH_STYLE}>Created</th>
              <th style={{ ...TH_STYLE, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageLinks.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "#737373",
                    fontSize: 13,
                  }}
                >
                  No links found.
                </td>
              </tr>
            ) : (
              pageLinks.map((link) => (
                <tr
                  key={link.id}
                  style={{ borderBottom: "1px solid #F5F5F5" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      "#FAFAFA";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      "transparent";
                  }}
                >
                  {/* Short URL */}
                  <td style={{ padding: "9px 12px", maxWidth: 180 }}>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {link.short_url}
                    </div>
                  </td>

                  {/* Channel */}
                  <td style={{ padding: "9px 12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        background: "#F5F5F5",
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#32373C",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getChannelLabel(link.utm_source)}
                    </span>
                  </td>

                  {/* Platform */}
                  <td
                    style={{
                      padding: "9px 12px",
                      fontSize: 12,
                      color: "#1A1A1A",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {link.asset_platform ?? "—"}
                  </td>

                  {/* Recruiter */}
                  <td style={{ padding: "9px 12px", maxWidth: 140 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {link.recruiter_clerk_id}
                    </div>
                  </td>

                  {/* Creative */}
                  <td style={{ padding: "9px 12px" }}>
                    {link.asset_thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={link.asset_thumbnail}
                        alt="creative"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 4,
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#737373",
                          fontStyle: "italic",
                        }}
                      >
                        No creative
                      </span>
                    )}
                  </td>

                  {/* Clicks */}
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: "#1A1A1A",
                      }}
                    >
                      {link.click_count}
                    </span>
                  </td>

                  {/* Created */}
                  <td
                    style={{
                      padding: "9px 12px",
                      fontSize: 11,
                      color: "#737373",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {timeAgo(link.created_at)}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <button
                        onClick={() => handleCopy(link.short_url)}
                        title="Copy link"
                        style={{
                          width: 28,
                          height: 28,
                          border: "1px solid #E8E8EA",
                          borderRadius: 6,
                          background: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <Copy size={12} color="#737373" />
                      </button>
                      <a
                        href={link.destination_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open destination"
                        style={{
                          width: 28,
                          height: 28,
                          border: "1px solid #E8E8EA",
                          borderRadius: 6,
                          background: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          textDecoration: "none",
                        }}
                      >
                        <ExternalLink size={12} color="#737373" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            borderTop: "1px solid #E5E5E5",
          }}
        >
          <span style={{ fontSize: 12, color: "#737373" }}>
            Showing {startIdx}–{endIdx} of {filtered.length}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {pageButtons.map((p, idx) =>
              p === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: "4px 6px",
                    fontSize: 12,
                    color: "#737373",
                  }}
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "1px solid",
                    borderColor: page === p ? "#32373C" : "#E5E5E5",
                    background: page === p ? "#32373C" : "#FFFFFF",
                    color: page === p ? "#FFFFFF" : "#1A1A1A",
                    fontSize: 12,
                    fontWeight: page === p ? 600 : 400,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  {(p as number) + 1}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
