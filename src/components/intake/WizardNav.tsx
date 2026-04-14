"use client";

import { ChevronLeft, ChevronRight, Check } from "lucide-react";

interface WizardNavProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
  isSubmit?: boolean;
}

export default function WizardNav({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
  showSkip = false,
  onSkip,
  isSubmit = false,
}: WizardNavProps) {
  const label = nextLabel || (isSubmit ? "Submit Request" : "Continue");
  return (
    <div style={{ position: "sticky", bottom: 0, zIndex: 20, background: "#FFFFFF", borderTop: "1px solid #E8E8EA", padding: "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 12, color: "#8A8A8E" }}>Step {currentStep + 1} of {totalSteps}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {showSkip && onSkip && (
          <button onClick={onSkip} style={{ padding: "10px 20px", borderRadius: 9999, fontSize: 13, fontWeight: 600, border: "none", background: "none", color: "#8A8A8E", cursor: "pointer", fontFamily: "inherit" }}>
            Skip — fill manually
          </button>
        )}
        {currentStep > 0 && (
          <button onClick={onBack} style={{ padding: "10px 24px", borderRadius: 9999, fontSize: 13, fontWeight: 600, border: "1px solid #E8E8EA", background: "white", color: "#8A8A8E", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
            <ChevronLeft size={12} /> Back
          </button>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          style={{
            padding: "10px 28px", borderRadius: 9999, fontSize: 14, fontWeight: 700,
            border: "none", background: isSubmit ? "#15803d" : nextDisabled ? "#E8E8EA" : "#32373C",
            color: nextDisabled ? "#8A8A8E" : "white",
            cursor: nextDisabled ? "not-allowed" : "pointer",
            fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {isSubmit && <Check size={14} />}
          {label}
          {!isSubmit && <ChevronRight size={14} />}
        </button>
      </div>
    </div>
  );
}
