"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileText,
  Sparkles,
  Loader2,
  ClipboardPaste,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import TaskTypePicker from "@/components/TaskTypePicker";
import DynamicForm from "@/components/DynamicForm";
import type { TaskTypeSchema, ExtractionResult } from "@/lib/types";

type EntryMode = "manual" | "upload" | "paste" | null;

export default function NewIntakePage() {
  const router = useRouter();
  const [schemas, setSchemas] = useState<TaskTypeSchema[]>([]);
  const [schemasLoading, setSchemasLoading] = useState(true);
  const [selectedTaskType, setSelectedTaskType] = useState<string | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<TaskTypeSchema | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [entryMode, setEntryMode] = useState<EntryMode>(null);
  const [pasteText, setPasteText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manuallyEditedKeys, setManuallyEditedKeys] = useState<Set<string>>(new Set());
  // Field-level validation errors from API
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Wrapped onChange — tracks which fields the user has manually edited so
  // their AI-drafted badge can be downgraded to "none".
  function handleFormChange(newData: Record<string, unknown>) {
    const changedKeys = new Set<string>(manuallyEditedKeys);
    for (const key of Object.keys(newData)) {
      if (newData[key] !== formData[key]) {
        changedKeys.add(key);
      }
    }
    setManuallyEditedKeys(changedKeys);
    setFormData(newData);
    setFieldErrors({});
  }

  // Load schemas
  useEffect(() => {
    async function loadSchemas() {
      try {
        const res = await fetch("/api/schemas");
        if (!res.ok) throw new Error("Failed to load schemas");
        const data = await res.json();
        setSchemas(data);
      } catch {
        toast.error("Failed to load task types");
      } finally {
        setSchemasLoading(false);
      }
    }
    loadSchemas();
  }, []);

  // Load selected schema detail
  useEffect(() => {
    if (!selectedTaskType) {
      setSelectedSchema(null);
      return;
    }

    async function loadSchema() {
      try {
        const res = await fetch(`/api/schemas/${selectedTaskType}`);
        if (!res.ok) throw new Error("Failed to load schema");
        const data = await res.json();
        setSelectedSchema(data);

        // Initialize defaults
        const defaults: Record<string, unknown> = {};
        const allFields = [
          ...data.schema.base_fields,
          ...data.schema.task_fields,
          ...data.schema.conditional_fields,
          ...data.schema.common_fields,
        ];
        for (const field of allFields) {
          if (field.default_value !== undefined) {
            defaults[field.key] = field.default_value;
          }
        }
        setFormData((prev) => ({ ...defaults, ...prev }));
      } catch {
        toast.error("Failed to load schema details");
      }
    }
    loadSchema();
  }, [selectedTaskType]);

  // Extract from paste
  async function handleExtractPaste() {
    if (!pasteText.trim()) {
      toast.error("Please paste some text first");
      return;
    }

    if (manuallyEditedKeys.size > 0) {
      const confirmed = window.confirm(
        `This will replace ${manuallyEditedKeys.size} field${manuallyEditedKeys.size === 1 ? "" : "s"} you've edited. Continue?`
      );
      if (!confirmed) return;
    }

    setExtracting(true);
    try {
      const res = await fetch("/api/extract/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });

      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      const ext = data.extraction as ExtractionResult;
      setExtraction(ext);

      // Auto-select task type
      if (ext.detected_task_type) {
        setSelectedTaskType(ext.detected_task_type);
      }

      // Merge extracted fields into formData
      const merged: Record<string, unknown> = { ...formData };
      if (ext.base_fields) Object.assign(merged, ext.base_fields);
      if (ext.task_fields) Object.assign(merged, ext.task_fields);
      setFormData(merged);
      setManuallyEditedKeys(new Set());

      toast.success("Successfully extracted data from text");
    } catch {
      toast.error("Failed to extract data. Please try again or fill manually.");
    } finally {
      setExtracting(false);
    }
  }

  // Upload RFP file
  async function handleFileUpload(file: File) {
    setExtracting(true);

    if (manuallyEditedKeys.size > 0) {
      const confirmed = window.confirm(
        `This will replace ${manuallyEditedKeys.size} field${manuallyEditedKeys.size === 1 ? "" : "s"} you've edited. Continue?`
      );
      if (!confirmed) {
        setExtracting(false);
        return;
      }
    }

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/extract/rfp", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Extraction failed (${res.status})`);
      }
      const ext = data.extraction as ExtractionResult;
      setExtraction(ext);

      if (ext.detected_task_type) {
        setSelectedTaskType(ext.detected_task_type);
      }

      const merged: Record<string, unknown> = { ...formData };
      if (ext.base_fields) Object.assign(merged, ext.base_fields);
      if (ext.task_fields) Object.assign(merged, ext.task_fields);
      setFormData(merged);
      setManuallyEditedKeys(new Set());

      toast.success(`Extracted data from ${file.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to process file: ${msg}`);
    } finally {
      setExtracting(false);
    }
  }

  // Submit form
  async function handleSubmit() {
    // Clear previous errors
    setFieldErrors({});

    if (!selectedTaskType || !selectedSchema) {
      toast.error("Please select a task type first");
      return;
    }

    const title = formData.title as string;
    if (!title?.trim()) {
      setFieldErrors({ title: "Project name is required" });
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          task_type: selectedTaskType,
          urgency: formData.urgency || "standard",
          target_languages: formData.target_languages || [],
          target_regions: formData.target_regions || [],
          volume_needed: formData.volume_needed || null,
          form_data: formData,
          schema_version: selectedSchema.version,
        }),
      });

      if (!res.ok) {
        const err = await res.json();

        // Parse field-level validation errors from API
        if (err.errors && Array.isArray(err.errors)) {
          const errorMap: Record<string, string> = {};
          for (const e of err.errors) {
            if (e.field && e.message) {
              errorMap[e.field] = e.message;
            }
          }
          setFieldErrors(errorMap);

          // Scroll to first error field
          const firstErrorField = err.errors[0]?.field;
          if (firstErrorField) {
            const el = document.querySelector(`[data-field="${firstErrorField}"]`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }

          const errorCount = err.errors.length;
          toast.error(`${errorCount} required field${errorCount > 1 ? "s" : ""} missing — highlighted in red`);
          return;
        }

        throw new Error(err.error || "Failed to create request");
      }

      await res.json();
      toast.success("Request submitted — generation started automatically");
      router.push("/intake/submitted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="px-4 md:px-10 lg:px-12 xl:px-16 py-4 md:py-6 max-w-[1100px] mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6 cursor-pointer transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Pipeline
        </Link>

        <div className="bg-white border border-[var(--border)] rounded-[var(--radius-lg)] p-6 lg:p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
            New Intake Request
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mb-8">
            Choose how to get started, then fill in the details.
          </p>

          {/* ===== DUAL MODE ENTRY ===== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <button
              type="button"
              onClick={() => setEntryMode("manual")}
              className={`
                p-5 rounded-[var(--radius-md)] border-2 text-left transition-all cursor-pointer
                ${entryMode === "manual" ? "border-[var(--oneforma-charcoal)] bg-[var(--muted)]" : "border-[var(--border)] hover:border-[#d4d4d4]"}
              `}
            >
              <FileText size={24} className={entryMode === "manual" ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"} />
              <p className="text-sm font-semibold text-[var(--foreground)] mt-2">Fill Manually</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Select a task type and fill in each field
              </p>
            </button>

            <button
              type="button"
              onClick={() => setEntryMode("upload")}
              className={`
                p-5 rounded-[var(--radius-md)] border-2 text-left transition-all cursor-pointer
                ${entryMode === "upload" ? "border-[var(--oneforma-charcoal)] bg-[var(--muted)]" : "border-[var(--border)] hover:border-[#d4d4d4]"}
              `}
            >
              <Upload size={24} className={entryMode === "upload" ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"} />
              <p className="text-sm font-semibold text-[var(--foreground)] mt-2">Upload Client RFP</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Upload a PDF or document and AI will extract fields
              </p>
            </button>
          </div>

          {/* Upload dropzone */}
          {entryMode === "upload" && (
            <div className="mb-8">
              <label className="flex flex-col items-center justify-center p-10 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border)] bg-[var(--muted)] hover:border-[#d4d4d4] transition-colors cursor-pointer">
                {extracting ? (
                  <>
                    <Loader2 size={28} className="text-[var(--muted-foreground)] animate-spin mb-2" />
                    <p className="text-sm font-medium text-[var(--foreground)]">Extracting data...</p>
                  </>
                ) : (
                  <>
                    <Upload size={28} className="text-[var(--muted-foreground)] mb-2" />
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Drop your RFP here or click to browse
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      PDF, DOCX, or TXT files
                    </p>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  className="hidden"
                  disabled={extracting}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </label>
            </div>
          )}

          {/* Paste area */}
          <div className="mb-8">
            <button
              type="button"
              onClick={() => setEntryMode(entryMode === "paste" ? null : "paste")}
              className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors mb-3"
            >
              <ClipboardPaste size={14} />
              Or paste client brief text
            </button>
            {entryMode === "paste" && (
              <div className="space-y-3">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste client brief text here..."
                  rows={6}
                  disabled={extracting}
                  className="input-base resize-none"
                />
                <button
                  type="button"
                  onClick={handleExtractPaste}
                  disabled={extracting || !pasteText.trim()}
                  className="btn-primary cursor-pointer"
                >
                  {extracting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Extract with AI
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ===== TASK TYPE PICKER ===== */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">
              Select Task Type
            </h2>
            {schemasLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-28 rounded-[var(--radius-md)]" />
                ))}
              </div>
            ) : (
              <TaskTypePicker
                schemas={schemas}
                selected={selectedTaskType}
                onSelect={setSelectedTaskType}
              />
            )}
          </div>

          {/* ===== DYNAMIC FORM ===== */}
          {selectedSchema && (
            <div className="mb-8">
              <DynamicForm
                schema={selectedSchema}
                formData={formData}
                onChange={handleFormChange}
                extraction={extraction}
                disabled={isSubmitting}
                fieldErrors={fieldErrors}
                manuallyEditedKeys={manuallyEditedKeys}
              />
            </div>
          )}

          {/* ===== SUBMIT ===== */}
          {selectedSchema && (
            <div className="pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-primary w-full justify-center py-3 text-base cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Creating Request...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Create Intake Request
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
