"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import RecruiterWorkspace from "@/components/recruiter/RecruiterWorkspace";
import type { IntakeRequest, CreativeBrief, GeneratedAsset, PipelineRun } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function RecruiterPage() {
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<IntakeRequest | null>(null);
  const [brief, setBrief] = useState<CreativeBrief | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [requests, setRequests] = useState<IntakeRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load all approved/review requests
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/intake");
        if (res.ok) {
          const data = await res.json();
          const approved = (data as IntakeRequest[]).filter(
            (r) => r.status === "approved" || r.status === "review" || r.status === "sent"
          );
          setRequests(approved);
          if (approved.length > 0 && !selectedId) {
            setSelectedId(approved[0].id);
          }
        }
      } catch {
        // silent
      }
    })();
  }, []);

  // Load selected request data
  useEffect(() => {
    if (!selectedId) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const [reqRes, briefRes, assetsRes, pipeRes] = await Promise.all([
          fetch(`/api/intake/${selectedId}`),
          fetch(`/api/generate/${selectedId}/brief`),
          fetch(`/api/generate/${selectedId}/images`),
          fetch(`/api/generate/${selectedId}`),
        ]);

        if (reqRes.ok) setRequest(await reqRes.json());
        if (briefRes.ok) {
          const bd = await briefRes.json();
          setBrief(bd.brief ?? null);
        }
        if (assetsRes.ok) {
          const ad = await assetsRes.json();
          setAssets(ad.assets ?? []);
        }
        if (pipeRes.ok) {
          const pd = await pipeRes.json();
          setPipelineRuns(pd.pipeline_runs ?? []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedId]);

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Campaign selector */}
        {requests.length > 1 && (
          <div style={{
            padding: "12px 24px", borderBottom: "1px solid #E8E8EA", background: "#FFFFFF",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#8A8A8E" }}>CAMPAIGN</span>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{
                fontSize: 13, padding: "6px 12px", borderRadius: 8,
                border: "1px solid #E5E5E5", background: "#FFFFFF",
                cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
              }}
            >
              {requests.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 64, gap: 8, color: "#8A8A8E" }}>
            <Loader2 size={18} className="animate-spin" />
            <span style={{ fontSize: 14 }}>Loading campaign...</span>
          </div>
        )}

        {!loading && !request && (
          <div style={{ padding: 64, textAlign: "center", color: "#8A8A8E", fontSize: 14 }}>
            No approved campaigns yet. Run a pipeline first.
          </div>
        )}

        {!loading && request && (
          <RecruiterWorkspace
            request={request}
            brief={brief}
            assets={assets}
            pipelineRuns={pipelineRuns}
          />
        )}
      </div>
    </AppShell>
  );
}
