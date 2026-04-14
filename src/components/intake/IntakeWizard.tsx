"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import WizardProgress from "./WizardProgress";
import WizardNav from "./WizardNav";
import StepStart from "./StepStart";
import StepTaskMode from "./StepTaskMode";
import StepDetails from "./StepDetails";
import StepRequirements from "./StepRequirements";
import StepReview from "./StepReview";
import type { ExtractionResult } from "@/lib/types";

export default function IntakeWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0); // 0-4
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [taskType, setTaskType] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState<"onsite" | "remote" | null>(null);
  const [confidenceFlags, setConfidenceFlags] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleExtracted(result: ExtractionResult) {
    // Merge base_fields and task_fields into formData
    const merged: Record<string, unknown> = { ...formData };
    if (result.base_fields) Object.assign(merged, result.base_fields);
    if (result.task_fields) Object.assign(merged, result.task_fields);
    setFormData(merged);

    // Auto-select task type if detected
    if (result.detected_task_type) {
      setTaskType(result.detected_task_type);
    }

    // Build confidenceFlags map
    const flags: Record<string, string> = {};
    if (result.confidence_flags) {
      for (const field of result.confidence_flags.fields_confidently_extracted || []) {
        flags[field] = "extracted";
      }
      for (const field of result.confidence_flags.fields_inferred || []) {
        flags[field] = "inferred";
      }
      for (const field of result.confidence_flags.fields_missing || []) {
        flags[field] = "verify";
      }
    }
    setConfidenceFlags(flags);

    // Advance to step 1
    setCurrentStep(1);
  }

  function handleNext() {
    // Validation per step
    if (currentStep === 1) {
      if (!taskType) {
        toast.error("Please select a task type");
        return;
      }
      if (!workMode) {
        toast.error("Please select a work mode (onsite or remote)");
        return;
      }
    }

    if (currentStep === 2) {
      if (!formData.title || !(formData.title as string).trim()) {
        toast.error("Project title is required");
        return;
      }
      if (!formData.volume_needed) {
        toast.error("Volume needed is required");
        return;
      }
    }

    if (currentStep === 3) {
      if (!formData.qualifications_required || !(formData.qualifications_required as string).trim()) {
        toast.error("Qualifications required is a required field");
        return;
      }
      if (workMode === "onsite" && !formData.ada_form_url) {
        toast.error("AIDA form URL is required for onsite tasks");
        return;
      }
    }

    setCurrentStep((s) => s + 1);
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  function handleSkip() {
    // Skip step 0, go to step 1 with empty data
    setCurrentStep(1);
  }

  function handleEditStep(step: number) {
    setCurrentStep(step);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title as string,
          task_type: taskType,
          urgency: formData.urgency || "standard",
          target_languages: formData.target_languages || [],
          target_regions: formData.target_regions || [],
          volume_needed: formData.volume_needed || null,
          form_data: { ...formData, work_mode: workMode },
          schema_version: 1,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create request");
      }

      const data = await res.json();
      const id = data.id;

      // If onsite + ada_form_url present, patch landing pages
      if (workMode === "onsite" && formData.ada_form_url) {
        await fetch(`/api/intake/${id}/landing-pages`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field: "ada_form_url",
            value: formData.ada_form_url,
          }),
        });
      }

      toast.success("Request submitted — generation started automatically");
      router.push(`/intake/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F7F8" }}>
      {/* Gradient bar */}
      <div style={{ height: 2, background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }} />

      {/* Top bar */}
      <div style={{ background: "white", borderBottom: "1px solid #E8E8EA", padding: "16px 40px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ color: "#8A8A8E", display: "flex" }}>
          <ArrowLeft size={18} />
        </Link>
        <span style={{ fontSize: 15, fontWeight: 700 }}>New Recruitment Request</span>
      </div>

      {/* Progress */}
      <WizardProgress currentStep={currentStep} />

      {/* Step content */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 40 }}>
        {currentStep === 0 && <StepStart onExtracted={handleExtracted} onSkip={handleSkip} onExtractingChange={setIsExtracting} />}
        {currentStep === 1 && (
          <StepTaskMode
            taskType={taskType}
            workMode={workMode}
            onTaskTypeChange={setTaskType}
            onWorkModeChange={setWorkMode}
          />
        )}
        {currentStep === 2 && (
          <StepDetails
            formData={formData}
            onChange={setFormData}
            confidenceFlags={confidenceFlags}
          />
        )}
        {currentStep === 3 && (
          <StepRequirements
            formData={formData}
            onChange={setFormData}
            confidenceFlags={confidenceFlags}
            workMode={workMode}
          />
        )}
        {currentStep === 4 && (
          <StepReview
            formData={formData}
            taskType={taskType}
            workMode={workMode}
            onEditStep={handleEditStep}
          />
        )}
      </div>

      {/* Bottom nav — hidden during extraction */}
      {!isExtracting && <WizardNav
        currentStep={currentStep}
        totalSteps={5}
        onBack={handleBack}
        onNext={currentStep === 4 ? handleSubmit : handleNext}
        nextLabel={currentStep === 0 ? "Extract & Continue" : currentStep === 4 ? "Submit Request" : undefined}
        nextDisabled={currentStep === 0 ? false : isSubmitting}
        showSkip={currentStep === 0}
        onSkip={handleSkip}
        isSubmit={currentStep === 4}
      />}
    </div>
  );
}
