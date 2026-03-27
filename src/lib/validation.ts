import type {
  ShowWhenCondition,
  TaskTypeSchema,
  FieldDefinition,
  FieldError,
  ValidationResult,
} from '@/lib/types';

/**
 * Evaluate a show_when condition against form data.
 */
export function evaluateCondition(
  condition: ShowWhenCondition,
  formData: Record<string, unknown>
): boolean {
  const value = formData[condition.field];

  if (condition.equals !== undefined) {
    return value === condition.equals;
  }

  if (condition.not_equals !== undefined) {
    return value !== condition.not_equals;
  }

  if (condition.contains !== undefined) {
    if (Array.isArray(value)) {
      return value.includes(condition.contains);
    }
    return false;
  }

  if (condition.greater_than !== undefined) {
    return typeof value === 'number' && value > condition.greater_than;
  }

  if (condition.is_truthy !== undefined) {
    return condition.is_truthy ? !!value : !value;
  }

  return true;
}

/**
 * Validate a single field against form data.
 */
function validateField(
  field: FieldDefinition,
  formData: Record<string, unknown>
): FieldError | null {
  const value = formData[field.key];

  // Required check
  if (field.required) {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return {
        field: field.key,
        message:
          field.validation?.custom_message ??
          `${field.label} is required`,
      };
    }
  }

  // Skip further validation if value is empty and not required
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const v = field.validation;
  if (!v) return null;

  // String-based validations
  if (typeof value === 'string') {
    if (v.min_length !== undefined && value.length < v.min_length) {
      return {
        field: field.key,
        message:
          v.custom_message ??
          `${field.label} must be at least ${v.min_length} characters`,
      };
    }

    if (v.max_length !== undefined && value.length > v.max_length) {
      return {
        field: field.key,
        message:
          v.custom_message ??
          `${field.label} must be at most ${v.max_length} characters`,
      };
    }

    if (v.pattern !== undefined) {
      const regex = new RegExp(v.pattern);
      if (!regex.test(value)) {
        return {
          field: field.key,
          message:
            v.custom_message ??
            `${field.label} does not match the required pattern`,
        };
      }
    }
  }

  // Numeric validations
  if (typeof value === 'number') {
    if (v.min !== undefined && value < v.min) {
      return {
        field: field.key,
        message:
          v.custom_message ??
          `${field.label} must be at least ${v.min}`,
      };
    }

    if (v.max !== undefined && value > v.max) {
      return {
        field: field.key,
        message:
          v.custom_message ??
          `${field.label} must be at most ${v.max}`,
      };
    }
  }

  // Array length validations
  if (Array.isArray(value)) {
    if (v.min_length !== undefined && value.length < v.min_length) {
      return {
        field: field.key,
        message:
          v.custom_message ??
          `${field.label} must have at least ${v.min_length} items`,
      };
    }

    if (v.max_length !== undefined && value.length > v.max_length) {
      return {
        field: field.key,
        message:
          v.custom_message ??
          `${field.label} must have at most ${v.max_length} items`,
      };
    }
  }

  return null;
}

/**
 * Validate form data against a task type schema.
 *
 * - base_fields, task_fields, common_fields are always validated
 * - conditional_fields are only validated when their show_when condition is met
 */
export function validateFormData(
  schema: TaskTypeSchema,
  formData: Record<string, unknown>
): ValidationResult {
  const errors: FieldError[] = [];
  const { base_fields, task_fields, conditional_fields, common_fields } =
    schema.schema;

  // Always validate base, task, and common fields
  const alwaysValidate = [
    ...base_fields,
    ...task_fields,
    ...common_fields,
  ];

  for (const field of alwaysValidate) {
    const error = validateField(field, formData);
    if (error) {
      errors.push(error);
    }
  }

  // Validate conditional fields only when their condition is met
  for (const field of conditional_fields) {
    if (field.show_when && !evaluateCondition(field.show_when, formData)) {
      continue;
    }
    const error = validateField(field, formData);
    if (error) {
      errors.push(error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
