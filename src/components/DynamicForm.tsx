"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Plus, ChevronDown } from "lucide-react";
import ConfidenceIndicator from "./ConfidenceIndicator";
import type {
  TaskTypeSchema,
  FieldDefinition,
  ShowWhenCondition,
  FieldOption,
  ExtractionResult,
} from "@/lib/types";

// ============================================================
// TYPES
// ============================================================

type FormData = Record<string, unknown>;
type ConfidenceMap = Record<string, "extracted" | "inferred" | "missing" | "none">;

interface DynamicFormProps {
  schema: TaskTypeSchema;
  formData: FormData;
  onChange: (data: FormData) => void;
  extraction?: ExtractionResult | null;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
  /** Field keys that the user has manually edited after extraction. These fields
   *  will have their AI-drafted confidence badge downgraded to "none". */
  manuallyEditedKeys?: Set<string>;
}

// ============================================================
// CONDITION EVALUATION
// ============================================================

function evaluateCondition(cond: ShowWhenCondition, data: FormData): boolean {
  const val = data[cond.field];

  if (cond.equals !== undefined) return val === cond.equals;
  if (cond.not_equals !== undefined) return val !== cond.not_equals;
  if (cond.is_truthy) return !!val;
  if (cond.contains !== undefined) {
    if (Array.isArray(val)) return val.includes(cond.contains);
    if (typeof val === "string") return val.includes(cond.contains);
    return false;
  }
  if (cond.greater_than !== undefined) {
    return typeof val === "number" && val > cond.greater_than;
  }

  return true;
}

// ============================================================
// CONFIDENCE HELPERS
// ============================================================

function buildConfidenceMap(extraction: ExtractionResult | null | undefined): ConfidenceMap {
  if (!extraction?.confidence_flags) return {};
  const map: ConfidenceMap = {};
  for (const f of extraction.confidence_flags.fields_confidently_extracted) {
    map[f] = "extracted";
  }
  for (const f of extraction.confidence_flags.fields_inferred) {
    map[f] = "inferred";
  }
  for (const f of extraction.confidence_flags.fields_missing) {
    map[f] = "missing";
  }
  return map;
}

// ============================================================
// REGISTRY HOOK
// ============================================================

function useRegistryOptions(source: string | undefined) {
  const [options, setOptions] = useState<FieldOption[]>([]);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!source || fetchedRef.current === source) return;
    fetchedRef.current = source;

    fetch(`/api/registries/${source}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOptions(
            data.map((item: { option_value: string; option_label: string }) => ({
              value: item.option_value,
              label: item.option_label,
            }))
          );
        }
      })
      .catch(() => {
        // Silently fail — options just won't load
      });
  }, [source]);

  return options;
}

// ============================================================
// FIELD COMPONENTS
// ============================================================

function TextField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      disabled={disabled}
      className="input-base"
    />
  );
}

function TextareaField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      disabled={disabled}
      rows={4}
      className="input-base resize-none"
      style={{ minHeight: 80 }}
    />
  );
}

function NumberField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition;
  value: number | "";
  onChange: (val: number | "") => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          const next = (typeof value === "number" ? value : 0) - 1;
          const min = field.validation?.min;
          if (min !== undefined && next < min) return;
          onChange(next);
        }}
        disabled={disabled}
        className="w-9 h-9 rounded-lg border border-[var(--border)] bg-white flex items-center justify-center hover:bg-[var(--muted)] cursor-pointer transition-colors text-[var(--foreground)] font-medium disabled:opacity-40"
      >
        -
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? "" : Number(v));
        }}
        placeholder={field.placeholder}
        disabled={disabled}
        min={field.validation?.min}
        max={field.validation?.max}
        className="input-base text-center flex-1"
      />
      <button
        type="button"
        onClick={() => {
          const next = (typeof value === "number" ? value : 0) + 1;
          const max = field.validation?.max;
          if (max !== undefined && next > max) return;
          onChange(next);
        }}
        disabled={disabled}
        className="w-9 h-9 rounded-lg border border-[var(--border)] bg-white flex items-center justify-center hover:bg-[var(--muted)] cursor-pointer transition-colors text-[var(--foreground)] font-medium disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

function SelectField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const registryOptions = useRegistryOptions(field.options_source);
  const options = field.options || registryOptions;

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input-base appearance-none pr-10 cursor-pointer"
      >
        <option value="">{field.placeholder || "Select..."}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none"
      />
    </div>
  );
}

function MultiSelectField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition;
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const registryOptions = useRegistryOptions(field.options_source);
  const options = field.options || registryOptions;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(
    (opt) =>
      !value.includes(opt.value) &&
      opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      {/* Selected tags */}
      <div
        className="input-base min-h-[42px] flex flex-wrap gap-1.5 items-center cursor-text"
        onClick={() => !disabled && setDropdownOpen(true)}
      >
        {value.map((v) => {
          const opt = options.find((o) => o.value === v);
          return (
            <span key={v} className="tag-pill flex items-center gap-1">
              {opt?.label ?? v}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((x) => x !== v));
                }}
                className="cursor-pointer hover:text-[var(--foreground)]"
              >
                <X size={10} />
              </button>
            </span>
          );
        })}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setDropdownOpen(true)}
          placeholder={value.length === 0 ? field.placeholder : ""}
          disabled={disabled}
          className="flex-1 min-w-[80px] border-none outline-none bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
        />
      </div>

      {/* Dropdown */}
      {dropdownOpen && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-[var(--border)] rounded-[var(--radius-sm)] shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange([...value, opt.value]);
                setSearch("");
                setDropdownOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--muted)] cursor-pointer transition-colors"
            >
              <span className="text-[var(--foreground)]">{opt.label}</span>
              {opt.description && (
                <span className="block text-xs text-[var(--muted-foreground)]">
                  {opt.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ButtonGroupField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const options = field.options || [];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`
            px-5 py-2 rounded-full text-sm font-medium transition-all cursor-pointer
            ${
              value === opt.value
                ? "bg-[var(--oneforma-charcoal)] text-white"
                : "bg-white border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
            }
          `}
          title={opt.description}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CheckboxGroupField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition;
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
}) {
  const registryOptions = useRegistryOptions(field.options_source);
  const options = field.options || registryOptions;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((opt) => {
        const checked = value.includes(opt.value);
        return (
          <label
            key={opt.value}
            className={`
              flex items-start gap-3 p-3 rounded-[var(--radius-sm)] border cursor-pointer transition-all
              ${
                checked
                  ? "border-[var(--oneforma-charcoal)] bg-[#f8f8f8]"
                  : "border-[var(--border)] hover:border-[#d4d4d4]"
              }
            `}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                if (checked) {
                  onChange(value.filter((v) => v !== opt.value));
                } else {
                  onChange([...value, opt.value]);
                }
              }}
              className="mt-0.5 cursor-pointer accent-[var(--oneforma-charcoal)]"
            />
            <div className="min-w-0">
              <span className="text-sm font-medium text-[var(--foreground)]">{opt.label}</span>
              {opt.description && (
                <span className="block text-xs text-[var(--muted-foreground)] mt-0.5">
                  {opt.description}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}

function ToggleField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition;
  value: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`
          relative w-10 h-6 rounded-full transition-colors cursor-pointer
          ${value ? "bg-[var(--oneforma-charcoal)]" : "bg-[#d4d4d4]"}
        `}
      >
        <span
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm
            ${value ? "translate-x-4" : "translate-x-0"}
          `}
        />
      </button>
      <span className="text-sm text-[var(--foreground)]">
        {field.toggle_label || field.label}
      </span>
    </label>
  );
}

function ToggleWithTextField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition;
  value: { enabled: boolean; text: string };
  onChange: (val: { enabled: boolean; text: string }) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <ToggleField
        field={field}
        value={value.enabled}
        onChange={(enabled) => onChange({ ...value, enabled })}
        disabled={disabled}
      />
      {value.enabled && (
        <textarea
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder={field.text_placeholder || field.placeholder}
          disabled={disabled}
          rows={3}
          className="input-base resize-none"
        />
      )}
    </div>
  );
}

function TagsField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition;
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");

  function addTag() {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((tag) => (
          <span key={tag} className="tag-pill flex items-center gap-1">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="cursor-pointer hover:text-[var(--foreground)]"
              disabled={disabled}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={field.placeholder || "Type and press Enter"}
          disabled={disabled}
          className="input-base flex-1"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={disabled || !input.trim()}
          className="btn-secondary px-3 py-2 cursor-pointer"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function FileDropzone({
  field,
  disabled,
}: {
  field: FieldDefinition;
  disabled?: boolean;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <label
      className={`
        flex flex-col items-center justify-center p-8 rounded-[var(--radius-md)]
        border-2 border-dashed border-[var(--border)] bg-[var(--muted)]
        hover:border-[#d4d4d4] transition-colors cursor-pointer
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <Plus size={24} className="text-[var(--muted-foreground)] mb-2" />
      <p className="text-sm text-[var(--foreground)] font-medium">
        {fileName || "Click to upload or drag and drop"}
      </p>
      <p className="text-xs text-[var(--muted-foreground)] mt-1">
        {field.description || "PDF, DOCX, or image files"}
      </p>
      <input
        type="file"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFileName(f.name);
        }}
      />
    </label>
  );
}

// ============================================================
// FIELD RENDERER
// ============================================================

function FieldRenderer({
  field,
  value,
  onChange,
  confidence,
  disabled,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (val: unknown) => void;
  confidence: "extracted" | "inferred" | "missing" | "none";
  disabled?: boolean;
}) {
  const wrap = (content: React.ReactNode) => (
    <ConfidenceIndicator level={confidence}>{content}</ConfidenceIndicator>
  );

  switch (field.type) {
    case "text":
      return wrap(
        <TextField field={field} value={(value as string) ?? ""} onChange={onChange} disabled={disabled} />
      );
    case "textarea":
      return wrap(
        <TextareaField field={field} value={(value as string) ?? ""} onChange={onChange} disabled={disabled} />
      );
    case "number":
      return wrap(
        <NumberField
          field={field}
          value={typeof value === "number" ? value : ""}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "select":
      return wrap(
        <SelectField field={field} value={(value as string) ?? ""} onChange={onChange} disabled={disabled} />
      );
    case "multi_select":
      return wrap(
        <MultiSelectField
          field={field}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "button_group":
      return (
        <ButtonGroupField
          field={field}
          value={(value as string) ?? ""}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "checkbox_group":
      return (
        <CheckboxGroupField
          field={field}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "toggle":
      return (
        <ToggleField
          field={field}
          value={!!value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "toggle_with_text":
      return (
        <ToggleWithTextField
          field={field}
          value={
            typeof value === "object" && value !== null
              ? (value as { enabled: boolean; text: string })
              : { enabled: false, text: "" }
          }
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "tags":
      return wrap(
        <TagsField
          field={field}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "file":
      return <FileDropzone field={field} disabled={disabled} />;
    case "divider":
      return <hr className="border-[var(--border)]" />;
    case "heading":
      return (
        <h3 className="text-base font-semibold text-[var(--foreground)] pt-2">
          {field.label}
        </h3>
      );
    default:
      return wrap(
        <TextField field={field} value={(value as string) ?? ""} onChange={onChange} disabled={disabled} />
      );
  }
}

// ============================================================
// SECTION RENDERER
// ============================================================

function FieldSection({
  title,
  fields,
  formData,
  onChange,
  confidenceMap,
  disabled,
  fieldErrors,
  manuallyEditedKeys,
}: {
  title: string;
  fields: FieldDefinition[];
  formData: FormData;
  onChange: (key: string, val: unknown) => void;
  confidenceMap: ConfidenceMap;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
  manuallyEditedKeys?: Set<string>;
}) {
  const visibleFields = fields.filter((f) => {
    if (!f.show_when) return true;
    return evaluateCondition(f.show_when, formData);
  });

  if (visibleFields.length === 0) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          {title}
        </span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
        {visibleFields.map((field) => {
          const isFullWidth =
            field.width === "full" ||
            ["textarea", "checkbox_group", "toggle_with_text", "tags", "file", "divider", "heading"].includes(
              field.type
            );
          const error = fieldErrors?.[field.key];

          return (
            <div
              key={field.key}
              className={isFullWidth ? "sm:col-span-2" : ""}
            >
              {field.type !== "divider" && field.type !== "heading" && (
                <label className={`block text-sm font-medium mb-1.5 ${error ? "text-[var(--oneforma-error)]" : "text-[var(--foreground)]"}`}>
                  {field.label}
                  {field.required && (
                    <span className="text-[var(--oneforma-error)] ml-0.5">*</span>
                  )}
                </label>
              )}
              {field.description && field.type !== "divider" && field.type !== "heading" && (
                <p className="text-xs text-[var(--muted-foreground)] mb-2">
                  {field.description}
                </p>
              )}
              <div className={error ? "ring-2 ring-[var(--oneforma-error)] rounded-[var(--radius-md)]" : ""}>
                <FieldRenderer
                  field={field}
                  value={formData[field.key]}
                  onChange={(val) => onChange(field.key, val)}
                  confidence={
                    manuallyEditedKeys?.has(field.key)
                      ? "none"
                      : confidenceMap[field.key] || "none"
                  }
                  disabled={disabled}
                />
              </div>
              {error && (
                <p className="text-xs text-[var(--oneforma-error)] mt-1 font-medium">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function DynamicForm({
  schema,
  formData,
  onChange,
  extraction,
  disabled,
  fieldErrors,
  manuallyEditedKeys,
}: DynamicFormProps) {
  const confidenceMap = buildConfidenceMap(extraction);

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      onChange({ ...formData, [key]: value });
    },
    [formData, onChange]
  );

  const { base_fields, task_fields, conditional_fields, common_fields } = schema.schema;

  return (
    <div className="space-y-8">
      <FieldSection
        title="Basic Information"
        fields={base_fields}
        formData={formData}
        onChange={handleFieldChange}
        confidenceMap={confidenceMap}
        disabled={disabled}
        fieldErrors={fieldErrors}
        manuallyEditedKeys={manuallyEditedKeys}
      />
      <FieldSection
        title={`${schema.display_name} Details`}
        fields={task_fields}
        formData={formData}
        onChange={handleFieldChange}
        confidenceMap={confidenceMap}
        disabled={disabled}
        fieldErrors={fieldErrors}
        manuallyEditedKeys={manuallyEditedKeys}
      />
      {conditional_fields.length > 0 && (
        <FieldSection
          title="Additional Details"
          fields={conditional_fields}
          formData={formData}
          onChange={handleFieldChange}
          confidenceMap={confidenceMap}
          disabled={disabled}
          fieldErrors={fieldErrors}
          manuallyEditedKeys={manuallyEditedKeys}
        />
      )}
      <FieldSection
        title="Project Settings"
        fields={common_fields}
        formData={formData}
        onChange={handleFieldChange}
        confidenceMap={confidenceMap}
        disabled={disabled}
        fieldErrors={fieldErrors}
        manuallyEditedKeys={manuallyEditedKeys}
      />
    </div>
  );
}
