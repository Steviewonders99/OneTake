import crypto from 'crypto';

export function testId(): string {
  return `test-${crypto.randomUUID().slice(0, 8)}`;
}

export function testEmail(prefix: string): string {
  return `${prefix}-${testId()}@test.nova.local`;
}

export interface MockProfile {
  id: string;
  request_id: string;
  ring: string;
  demographics: Record<string, unknown>;
  skills: Record<string, unknown>;
  languages: string[];
  regions: string[];
  sample_size: number;
  confidence: string;
  source: string;
  captured_at: string;
}

export function makeProfile(overrides: Partial<MockProfile> & { ring: string }): MockProfile {
  return {
    id: testId(),
    request_id: overrides.request_id ?? testId(),
    ring: overrides.ring,
    demographics: overrides.demographics ?? {},
    skills: overrides.skills ?? {},
    languages: overrides.languages ?? [],
    regions: overrides.regions ?? [],
    sample_size: overrides.sample_size ?? 10,
    confidence: overrides.confidence ?? 'medium',
    source: overrides.source ?? 'test',
    captured_at: overrides.captured_at ?? new Date().toISOString(),
  };
}
