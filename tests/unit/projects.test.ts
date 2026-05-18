import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('@/lib/db', () => ({
  getDb: () => mockSql,
}));

import {
  listProjects,
  getProject,
  getProjectByCodename,
  createProject,
  updateProject,
  deleteProject,
  addAlias,
  searchProjectsByFuzzy,
} from '@/lib/db/projects';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listProjects', () => {
  it('returns all projects ordered by codename', async () => {
    const mockProjects = [
      { id: '1', codename: 'centaurus', display_name: 'Centaurus', status: 'active' },
      { id: '2', codename: 'humus', display_name: 'Humus', status: 'active' },
    ];
    mockSql.mockResolvedValueOnce(mockProjects);

    const result = await listProjects();
    expect(result).toEqual(mockProjects);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('filters by status when provided', async () => {
    mockSql.mockResolvedValueOnce([]);
    await listProjects('archived');
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

describe('getProject', () => {
  it('returns project by id', async () => {
    const mockProject = { id: '1', codename: 'centaurus' };
    mockSql.mockResolvedValueOnce([mockProject]);

    const result = await getProject('1');
    expect(result).toEqual(mockProject);
  });

  it('returns null when not found', async () => {
    mockSql.mockResolvedValueOnce([]);
    const result = await getProject('nonexistent');
    expect(result).toBeNull();
  });
});

describe('getProjectByCodename', () => {
  it('returns project for matching codename', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1', codename: 'humus' }]);
    const result = await getProjectByCodename('  HUMUS  ');
    expect(result).toBeTruthy();
  });
});

describe('createProject', () => {
  it('creates project with lowercase codename', async () => {
    const mockProject = { id: '1', codename: 'kilo', display_name: 'Kilo NYC' };
    mockSql.mockResolvedValueOnce([mockProject]);

    const result = await createProject({ codename: 'Kilo', display_name: 'Kilo NYC' });
    expect(result.codename).toBe('kilo');
  });
});

describe('updateProject', () => {
  it('returns updated project', async () => {
    const updated = { id: '1', codename: 'humus', status: 'paused' };
    mockSql.mockResolvedValueOnce([updated]);

    const result = await updateProject('1', { status: 'paused' });
    expect(result?.status).toBe('paused');
  });

  it('returns null when project not found', async () => {
    mockSql.mockResolvedValueOnce([]);
    const result = await updateProject('nonexistent', { status: 'archived' });
    expect(result).toBeNull();
  });
});

describe('deleteProject', () => {
  it('returns true when deleted', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1' }]);
    expect(await deleteProject('1')).toBe(true);
  });

  it('returns false when not found', async () => {
    mockSql.mockResolvedValueOnce([]);
    expect(await deleteProject('nope')).toBe(false);
  });
});

describe('addAlias', () => {
  it('creates alias with lowercase trimmed value', async () => {
    const mockAlias = { id: '1', alias: 'hummus', source: 'manual', confidence: 1.0 };
    mockSql.mockResolvedValueOnce([mockAlias]);

    const result = await addAlias('proj-1', '  HUMMUS  ');
    expect(result.alias).toBe('hummus');
  });
});

describe('searchProjectsByFuzzy', () => {
  it('returns projects sorted by similarity', async () => {
    const results = [
      { id: '1', codename: 'humus', similarity: 0.9 },
      { id: '2', codename: 'hummus-twins', similarity: 0.6 },
    ];
    mockSql.mockResolvedValueOnce(results);

    const found = await searchProjectsByFuzzy('humus');
    expect(found).toHaveLength(2);
    expect(found[0].similarity).toBeGreaterThan(found[1].similarity);
  });
});
