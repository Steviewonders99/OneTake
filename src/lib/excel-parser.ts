/**
 * Parse locale Excel files for the locale_add edit action.
 * Required columns: country, url
 * Optional columns: label
 */

import * as XLSX from 'xlsx';

export interface LocaleRow {
  country: string;  // ISO code (BR, MX, CO)
  url: string;      // Aidaform or job posting URL
  label?: string;   // Display name (defaults to country)
}

export function parseLocaleExcel(buffer: Buffer): LocaleRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const results: LocaleRow[] = [];

  for (const row of rows) {
    // Normalize column names (case-insensitive, trim whitespace)
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.toLowerCase().trim()] = String(value || '').trim();
    }

    const country = normalized.country || normalized.country_code || normalized.locale || '';
    const url = normalized.url || normalized.link || normalized.aidaform || '';

    if (!country || !url) continue;

    // Validate URL
    try {
      new URL(url);
    } catch {
      continue; // Skip invalid URLs
    }

    results.push({
      country: country.toUpperCase().slice(0, 3),
      url,
      label: normalized.label || normalized.name || undefined,
    });
  }

  return results;
}
