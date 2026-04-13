import { describe, it, expect } from 'vitest';
import { DARK, LIGHT, FONT, FIGMA_ICON } from '../tokens';

describe('Design Token consistency', () => {
  it('DARK and LIGHT have identical keys', () => {
    const darkKeys = Object.keys(DARK).sort();
    const lightKeys = Object.keys(LIGHT).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it('all DARK values are non-empty strings', () => {
    for (const [key, value] of Object.entries(DARK)) {
      expect(value, `DARK.${key} should be non-empty`).toBeTruthy();
      expect(typeof value, `DARK.${key} should be string`).toBe('string');
    }
  });

  it('all LIGHT values are non-empty strings', () => {
    for (const [key, value] of Object.entries(LIGHT)) {
      expect(value, `LIGHT.${key} should be non-empty`).toBeTruthy();
      expect(typeof value, `LIGHT.${key} should be string`).toBe('string');
    }
  });

  it('all DARK color values are valid CSS colors (# or rgba)', () => {
    for (const [key, value] of Object.entries(DARK)) {
      expect(
        value.startsWith('#') || value.startsWith('rgba'),
        `DARK.${key} = "${value}" should start with # or rgba`
      ).toBe(true);
    }
  });

  it('all LIGHT color values are valid CSS colors (# or rgba)', () => {
    for (const [key, value] of Object.entries(LIGHT)) {
      expect(
        value.startsWith('#') || value.startsWith('rgba'),
        `LIGHT.${key} = "${value}" should start with # or rgba`
      ).toBe(true);
    }
  });

  it('FONT.sans is a non-empty string', () => {
    expect(FONT.sans).toBeTruthy();
    expect(typeof FONT.sans).toBe('string');
  });

  it('FONT.mono is a non-empty string', () => {
    expect(FONT.mono).toBeTruthy();
    expect(typeof FONT.mono).toBe('string');
  });

  it('FIGMA_ICON contains valid SVG markup', () => {
    expect(FIGMA_ICON.trim().startsWith('<svg')).toBe(true);
    expect(FIGMA_ICON.trim().endsWith('</svg>')).toBe(true);
  });

  it('FIGMA_ICON contains all 5 Figma brand colors', () => {
    const brandColors = ['#1ABCFE', '#0ACF83', '#FF7262', '#F24E1E', '#A259FF'];
    for (const color of brandColors) {
      expect(
        FIGMA_ICON.includes(color),
        `FIGMA_ICON should contain ${color}`
      ).toBe(true);
    }
  });

  it('DARK.bg differs from LIGHT.bg (distinct themes)', () => {
    expect(DARK.bg).not.toBe(LIGHT.bg);
  });

  it('DARK.text differs from LIGHT.text (distinct themes)', () => {
    expect(DARK.text).not.toBe(LIGHT.text);
  });

  it('DARK.rowHover exists and is a string', () => {
    expect(DARK.rowHover).toBeDefined();
    expect(typeof DARK.rowHover).toBe('string');
  });

  it('LIGHT.rowHover exists and is a string', () => {
    expect(LIGHT.rowHover).toBeDefined();
    expect(typeof LIGHT.rowHover).toBe('string');
  });

  it('DARK accent color matches LIGHT accent color (shared brand)', () => {
    expect(DARK.accent).toBe(LIGHT.accent);
  });
});
