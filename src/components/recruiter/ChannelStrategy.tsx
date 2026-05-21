"use client";

import { useMemo, useState } from "react";
import { Globe, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";

interface ChannelStrategyProps {
  assets: GeneratedAsset[];
}

const BOARD_URLS: Record<string, string> = {
  "Indeed UK": "https://indeed.co.uk", "Reed": "https://reed.co.uk", "Totaljobs": "https://totaljobs.com",
  "Seek": "https://seek.com.au", "Indeed AU": "https://au.indeed.com", "Jora": "https://jora.com",
  "Naukri": "https://naukri.com", "Indeed India": "https://indeed.co.in", "Internshala": "https://internshala.com",
  "Apna": "https://apna.co", "Seek NZ": "https://seek.co.nz", "Trade Me Jobs": "https://trademe.co.nz/jobs",
  "Indeed NZ": "https://nz.indeed.com", "PNet": "https://pnet.co.za", "Careers24": "https://careers24.com",
  "CareerJunction": "https://careerjunction.co.za", "Indeed ZA": "https://za.indeed.com",
  "IrishJobs": "https://irishjobs.ie", "Jobs.ie": "https://jobs.ie", "Indeed IE": "https://ie.indeed.com",
  "JobStreet": "https://jobstreet.com.sg", "MyCareersFuture": "https://mycareersfuture.gov.sg",
  "Indeed SG": "https://sg.indeed.com", "LinkedIn": "https://linkedin.com/jobs",
  "RemoteCorgi": "https://remotecorgi.com",
};

const COUNTRY_FLAG: Record<string, string> = {
  "United Kingdom": "GB", "Australia": "AU", "India": "IN", "New Zealand": "NZ",
  "South Africa": "ZA", "Ireland": "IE", "Singapore": "SG",
};

export default function ChannelStrategy({ assets }: ChannelStrategyProps) {
  const [expanded, setExpanded] = useState(true);

  const countryBoards = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const a of assets) {
      if (a.asset_type !== "job_portal_copy") continue;
      const content = (a.content ?? {}) as Record<string, unknown>;
      const country = String(content.country ?? (a as Record<string, unknown>).country ?? "");
      const platform = String(content.portal_name ?? a.platform ?? "");
      if (!country || !platform) continue;
      if (!map.has(country)) map.set(country, new Set());
      map.get(country)!.add(platform);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([country, platforms]) => ({ country, platforms: Array.from(platforms) }));
  }, [assets]);

  if (countryBoards.length === 0) return null;

  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA",
      overflow: "hidden", marginBottom: 0,
    }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", gap: 8,
          background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
        }}
      >
        {expanded ? <ChevronDown size={14} color="#8A8A8E" /> : <ChevronRight size={14} color="#8A8A8E" />}
        <Globe size={14} style={{ color: "#0693E3" }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Where to Post — By Country</span>
        <span style={{ fontSize: 11, color: "#8A8A8E" }}>{countryBoards.length} regions · {countryBoards.reduce((s, c) => s + c.platforms.length, 0)} boards</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {countryBoards.map(({ country, platforms }) => (
            <div key={country} style={{
              background: "#F7F7F8", borderRadius: 10, padding: 14,
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>
                {country}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {platforms.map((platform, i) => (
                  <div key={platform} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 10px", borderRadius: 8,
                    background: i === 0 ? "#EEF2FF" : "#FFFFFF",
                    border: "1px solid #E8E8EA",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 4, background: "#32373C", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: "#1A1A1A" }}>
                        {platform}
                      </span>
                      {i === 0 && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: "#4F46E5", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Primary
                        </span>
                      )}
                    </div>
                    {BOARD_URLS[platform] && (
                      <a
                        href={BOARD_URLS[platform]}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "#8A8A8E", display: "flex" }}
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
