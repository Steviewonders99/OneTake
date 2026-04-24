import { describe, it, expect } from 'vitest';
import { WIDGET_REGISTRY, WIDGET_CATEGORIES } from '@/components/insights/widgetRegistry';
import type { WidgetType, WidgetCategory } from '@/components/insights/types';

describe('Widget Registry', () => {
  const registryEntries = Object.entries(WIDGET_REGISTRY);
  const categoryIds = WIDGET_CATEGORIES.map(c => c.id);

  it('has exactly 30 widget entries', () => {
    expect(registryEntries.length).toBe(30);
  });

  it('every entry has a valid category from WIDGET_CATEGORIES', () => {
    for (const [type, entry] of registryEntries) {
      expect(categoryIds).toContain(entry.category);
    }
  });

  it('every entry has a non-empty label', () => {
    for (const [type, entry] of registryEntries) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty description', () => {
    for (const [type, entry] of registryEntries) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('every entry has defaultSize with w > 0 and h > 0', () => {
    for (const [type, entry] of registryEntries) {
      expect(entry.defaultSize.w).toBeGreaterThan(0);
      expect(entry.defaultSize.h).toBeGreaterThan(0);
    }
  });

  it('every entry has minSize <= defaultSize', () => {
    for (const [type, entry] of registryEntries) {
      expect(entry.minSize.w).toBeLessThanOrEqual(entry.defaultSize.w);
      expect(entry.minSize.h).toBeLessThanOrEqual(entry.defaultSize.h);
    }
  });
});
