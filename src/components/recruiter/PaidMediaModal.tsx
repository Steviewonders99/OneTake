"use client";

import { useState, useMemo } from "react";
import { X, TrendingUp, DollarSign, Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PaidMediaModalProps {
  requestId: string;
  campaignTitle: string;
  targetRegions: string[];
  onClose: () => void;
}

interface CountryBudget {
  country: string;
  budget: string;
  currency: string;
  payRate: string;
  payRateCurrency: string;
  platforms: string[];
}

const CURRENCIES: Record<string, string> = {
  "United Kingdom": "GBP", "Australia": "AUD", "India": "INR",
  "New Zealand": "NZD", "South Africa": "ZAR", "Ireland": "EUR",
  "Singapore": "SGD", "United States": "USD", "Mexico": "MXN",
  "Brazil": "BRL", "Germany": "EUR", "France": "EUR",
};

const AD_PLATFORMS = [
  { value: "meta", label: "Meta (FB + IG)" },
  { value: "linkedin", label: "LinkedIn Ads" },
  { value: "reddit", label: "Reddit Ads" },
  { value: "tiktok", label: "TikTok Ads" },
  { value: "google", label: "Google Ads" },
  { value: "indeed_sponsored", label: "Indeed Sponsored" },
];

export default function PaidMediaModal({ requestId, campaignTitle, targetRegions, onClose }: PaidMediaModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [countryBudgets, setCountryBudgets] = useState<CountryBudget[]>(() =>
    targetRegions.map(country => ({
      country,
      budget: "",
      currency: CURRENCIES[country] ?? "USD",
      payRate: "",
      payRateCurrency: CURRENCIES[country] ?? "USD",
      platforms: ["meta"],
    }))
  );
  const [notes, setNotes] = useState("");

  const totalBudget = useMemo(() => {
    // Sum in USD equivalent (rough)
    return countryBudgets.reduce((sum, cb) => sum + (parseFloat(cb.budget) || 0), 0);
  }, [countryBudgets]);

  const selectedCountries = countryBudgets.filter(cb => parseFloat(cb.budget) > 0);

  const updateCountry = (index: number, field: keyof CountryBudget, value: string | string[]) => {
    setCountryBudgets(prev => prev.map((cb, i) => i === index ? { ...cb, [field]: value } : cb));
  };

  const togglePlatform = (index: number, platform: string) => {
    setCountryBudgets(prev => prev.map((cb, i) => {
      if (i !== index) return cb;
      const platforms = cb.platforms.includes(platform)
        ? cb.platforms.filter(p => p !== platform)
        : [...cb.platforms, platform];
      return { ...cb, platforms };
    }));
  };

  const handleSubmit = async () => {
    if (selectedCountries.length === 0) {
      toast.error("Set a budget for at least one country");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        countries: selectedCountries.map(cb => ({
          country: cb.country,
          lifetime_budget: parseFloat(cb.budget),
          currency: cb.currency,
          pay_rate: cb.payRate ? parseFloat(cb.payRate) : null,
          pay_rate_currency: cb.payRateCurrency,
          platforms: cb.platforms,
        })),
        notes,
        total_estimated: totalBudget,
      };
      await fetch(`/api/intake/${requestId}/request-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Paid media campaign requested — marketing team notified");
      onClose();
    } catch {
      toast.error("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, maxWidth: 700, width: "100%", margin: 16, maxHeight: "85vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #E8E8EA", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0693E3, #9B51E0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={16} color="#fff" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>Request Paid Campaign</h2>
                <p style={{ fontSize: 12, color: "#8A8A8E", margin: 0 }}>{campaignTitle}</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#8A8A8E" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Country budget cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Budget & Rates by Country
              </label>
              <span style={{ fontSize: 12, color: "#6D28D9", fontWeight: 600 }}>
                {selectedCountries.length} of {countryBudgets.length} selected
              </span>
            </div>

            {countryBudgets.map((cb, i) => (
              <div key={cb.country} style={{
                border: parseFloat(cb.budget) > 0 ? "1px solid #6D28D9" : "1px solid #E8E8EA",
                borderRadius: 12, padding: 16, background: parseFloat(cb.budget) > 0 ? "#FAFAFE" : "#FFFFFF",
                transition: "all 0.15s",
              }}>
                {/* Country name */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Globe size={14} style={{ color: "#6D28D9" }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>{cb.country}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#8A8A8E" }}>{cb.currency}</span>
                </div>

                {/* Budget + Pay Rate row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Lifetime Budget
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 4 }}>
                      <span style={{ padding: "7px 10px", background: "#F3F4F6", borderRadius: "8px 0 0 8px", border: "1px solid #E5E5E5", borderRight: "none", fontSize: 12, color: "#6B7280", fontWeight: 600 }}>
                        {cb.currency}
                      </span>
                      <input
                        type="number"
                        value={cb.budget}
                        onChange={(e) => updateCountry(i, "budget", e.target.value)}
                        placeholder="0"
                        style={{ flex: 1, padding: "7px 10px", borderRadius: "0 8px 8px 0", border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "inherit", width: "100%" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Pay Rate (per unit)
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 4 }}>
                      <span style={{ padding: "7px 10px", background: "#F3F4F6", borderRadius: "8px 0 0 8px", border: "1px solid #E5E5E5", borderRight: "none", fontSize: 12, color: "#6B7280", fontWeight: 600 }}>
                        {cb.payRateCurrency}
                      </span>
                      <input
                        type="number"
                        value={cb.payRate}
                        onChange={(e) => updateCountry(i, "payRate", e.target.value)}
                        placeholder="Optional"
                        style={{ flex: 1, padding: "7px 10px", borderRadius: "0 8px 8px 0", border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "inherit", width: "100%" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Ad platforms */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>
                    Ad Platforms
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {AD_PLATFORMS.map((p) => (
                      <button key={p.value} type="button" onClick={() => togglePlatform(i, p.value)}
                        style={{
                          padding: "3px 10px", borderRadius: 9999, fontSize: 10, fontWeight: 600,
                          border: "1px solid", cursor: "pointer", fontFamily: "inherit",
                          borderColor: cb.platforms.includes(p.value) ? "#0693E3" : "#E5E5E5",
                          background: cb.platforms.includes(p.value) ? "#DBEAFE" : "#FFFFFF",
                          color: cb.platforms.includes(p.value) ? "#1E40AF" : "#8A8A8E",
                        }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Campaign objectives, targeting preferences, scheduling notes..."
              style={{ display: "block", marginTop: 6, width: "100%", minHeight: 70, padding: 12, borderRadius: 10, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          {/* Summary + Submit */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0 0", borderTop: "1px solid #E8E8EA" }}>
            <div>
              <span style={{ fontSize: 12, color: "#8A8A8E" }}>Total estimated: </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A" }}>
                {selectedCountries.length > 0
                  ? selectedCountries.map(cb => `${cb.currency} ${parseFloat(cb.budget).toLocaleString()}`).join(" + ")
                  : "—"
                }
              </span>
              <span style={{ fontSize: 12, color: "#8A8A8E", marginLeft: 8 }}>
                {selectedCountries.length} {selectedCountries.length === 1 ? "country" : "countries"}
              </span>
            </div>
            <button type="button" onClick={handleSubmit} disabled={submitting || selectedCountries.length === 0}
              style={{
                padding: "10px 24px", borderRadius: 9999, fontSize: 13, fontWeight: 600,
                border: "none", cursor: selectedCountries.length > 0 ? "pointer" : "not-allowed",
                fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                background: selectedCountries.length > 0 ? "linear-gradient(135deg, #0693E3, #9B51E0)" : "#E5E5E5",
                color: selectedCountries.length > 0 ? "#FFFFFF" : "#8A8A8E",
              }}>
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Launch Paid Campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
