"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface CampaignSlugFieldProps {
  requestId: string;
  initialValue: string | null;
  canEdit: boolean;
}

export default function CampaignSlugField({ requestId, initialValue, canEdit }: CampaignSlugFieldProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  async function handleBlur() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === (initialValue ?? "")) {
      setValue(initialValue ?? "");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/intake/${requestId}/campaign-slug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_slug: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        setValue(initialValue ?? "");
        return;
      }
      setValue(data.campaign_slug);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save");
      setValue(initialValue ?? "");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return value ? (
      <div className="text-[11px] font-mono text-[var(--muted-foreground)]">{value}</div>
    ) : null;
  }

  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="text-[var(--muted-foreground)] uppercase font-semibold text-[9px]">tracking code:</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="campaign-slug"
        className="font-mono px-1.5 py-0.5 rounded border border-[var(--border)] bg-white focus:border-[#32373C] focus:outline-none min-w-[160px]"
      />
      {saving ? (
        <Loader2 size={11} className="animate-spin text-[var(--muted-foreground)]" />
      ) : saved ? (
        <Check size={11} className="text-green-600" />
      ) : (
        <Pencil size={10} className="text-[var(--muted-foreground)]" />
      )}
    </div>
  );
}
