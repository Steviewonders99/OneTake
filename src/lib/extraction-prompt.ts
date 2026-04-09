import { listActiveSchemas } from '@/lib/db/schemas';
import type { TaskTypeSchema, FieldDefinition } from '@/lib/types';

function formatFieldKeys(fields: FieldDefinition[]): string {
  return fields
    .map((f) => {
      let desc = `  - "${f.key}" (${f.type}${f.required ? ', required' : ''}): ${f.label}`;
      if (f.options && f.options.length > 0) {
        const vals = f.options.map((o) => o.value).join(', ');
        desc += ` [options: ${vals}]`;
      }
      if (f.ai_help) {
        desc += `\n      What to capture: ${f.ai_help}`;
      }
      if (f.prefill_guidance) {
        desc += `\n      Extraction guidance: ${f.prefill_guidance}`;
      }
      return desc;
    })
    .join('\n');
}

function formatSchema(schema: TaskTypeSchema): string {
  const sections: string[] = [];

  sections.push(`### Task Type: "${schema.task_type}" — ${schema.display_name}`);
  sections.push(`Description: ${schema.description}`);

  if (schema.schema.base_fields.length > 0) {
    sections.push('Base fields (common across task types):');
    sections.push(formatFieldKeys(schema.schema.base_fields));
  }

  if (schema.schema.task_fields.length > 0) {
    sections.push('Task-specific fields:');
    sections.push(formatFieldKeys(schema.schema.task_fields));
  }

  if (schema.schema.conditional_fields.length > 0) {
    sections.push('Conditional fields (shown based on other field values):');
    sections.push(formatFieldKeys(schema.schema.conditional_fields));
  }

  if (schema.schema.common_fields.length > 0) {
    sections.push('Common fields:');
    sections.push(formatFieldKeys(schema.schema.common_fields));
  }

  return sections.join('\n');
}

export async function buildExtractionSystemPrompt(): Promise<string> {
  const schemas = await listActiveSchemas();
  const schemaDescriptions = schemas.map(formatSchema).join('\n\n---\n\n');

  return `You are an expert data extraction assistant for OneForma — the AI platform that sees the expert in everyone. OneForma runs a global network of experts contributing to AI development across translation, annotation, data collection, judging, transcription, and domain-specific evaluation. You receive source text describing a specific project and must map it to OneForma's intake schema.

Your job is to analyze RFP documents or project descriptions and extract structured data that maps to OneForma's intake request system. You must:

1. Detect which task type best matches the described project
2. Extract as many field values as possible from the text
3. Be honest about your confidence — clearly distinguish between fields you extracted directly, fields you inferred, and fields that are missing

## Available Task Types and Their Fields

${schemaDescriptions}

## Output Format

You MUST respond with valid JSON matching this exact structure (no markdown, no code fences, just raw JSON):

{
  "detected_task_type": "<task_type key from above>",
  "base_fields": {
    "<field_key>": "<extracted value>"
  },
  "task_fields": {
    "<field_key>": "<extracted value>"
  },
  "confidence_flags": {
    "fields_confidently_extracted": ["<field keys clearly stated in the text>"],
    "fields_inferred": ["<field keys you guessed or derived from context>"],
    "fields_missing": ["<field keys not found and not inferable>"],
    "notes": "<brief explanation of your reasoning>"
  },
  "extracted_details": {
    "client_name": "<if mentioned>",
    "project_deadline": "<if mentioned>",
    "quality_requirements": "<if mentioned>",
    "training_required": "<if mentioned>",
    "equipment_needed": "<if mentioned>",
    "data_sensitivity": "<if mentioned>"
  }
}

## Rules

- For multi_select and tags fields, return arrays of strings
- For select and button_group fields, return a single string value matching one of the available options
- For number fields, return a number
- For toggle fields, return a boolean
- For text/textarea fields, return a string
- If a field has predefined options, only use values from those options
- If a field value cannot be determined, omit it from base_fields/task_fields (do NOT set it to null)
- Always include it in confidence_flags.fields_missing instead
- The detected_task_type must be one of the task_type keys listed above
- extracted_details captures additional context that doesn't map directly to form fields
- **Shared "Job Requirements" fields** (qualifications_required, qualifications_preferred, location_scope, language_requirements, engagement_model, technical_requirements, context_notes) appear at the top of every task type's task_fields. These describe WHO can do the job, where they work, and what they need. Always attempt to populate ALL 7 of these fields using the "Extraction guidance" notes above — even if you must infer conservatively from context. These fields are pre-filled drafts for the recruiter to review and edit, so it is better to offer a reasonable draft than to omit them.
- For the 7 Job Requirements fields, do NOT add them to fields_missing unless the source text contains essentially no signal at all about who/where/how. Default to populating them.`;
}
