"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import DesignerCampaignList from "@/components/designer/DesignerCampaignList";
import DesignerGalleryPanel from "@/components/designer/gallery/DesignerGalleryPanel";

export default function DesignerPortal() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.role) setRole(data.role);
        if (data?.role && !["designer", "admin"].includes(data.role)) {
          router.push("/");
        }
      })
      .catch(() => {});
  }, [router]);

  // Auto-select first campaign
  useEffect(() => {
    if (!selectedId) {
      fetch("/api/intake")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          const active = data.filter((c: any) => c.status !== "draft");
          if (active.length > 0) setSelectedId(active[0].id);
        })
        .catch(() => {});
    }
  }, [selectedId]);

  return (
    <AppShell>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
        {/* Left: Campaign list sidebar */}
        <div className="w-full lg:w-[340px] flex-shrink-0 lg:h-full h-auto max-h-[50vh] lg:max-h-none overflow-y-auto border-b lg:border-b-0 border-[var(--border)]">
          <DesignerCampaignList
            variant="sidebar"
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        {/* Right: Campaign preview */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white min-h-0">
          {selectedId ? (
            <DesignerGalleryPanel requestId={selectedId} />
          ) : (
            <div className="flex items-center justify-center h-full text-[#737373] text-sm">
              Select a campaign to preview
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
