import { describe, it, expect } from 'vitest';
import { parseFrameName, buildFrameName, type NovaFrameRouting } from '../figma-helpers';

// ============================================================
// Roundtrip: parseFrameName(buildFrameName(x)) === x
// ============================================================

describe('parseFrameName <-> buildFrameName roundtrip', () => {
  it('standard routing roundtrips correctly', () => {
    const routing: NovaFrameRouting = {
      persona: 'Maria',
      version: 'V1',
      platform: 'ig_feed',
      width: 1080,
      height: 1080,
    };
    const frameName = buildFrameName(routing);
    const parsed = parseFrameName(frameName);
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(routing);
  });

  it('roundtrips 100 randomly generated valid routings', () => {
    const personas = ['Maria', 'Alex', 'Priya', 'Chen', 'Olga', 'James', 'Sofia', 'Ahmed'];
    const platforms = ['ig_feed', 'ig_story', 'linkedin_feed', 'facebook_feed', 'tiktok_feed'];
    const dims: [number, number][] = [[1080, 1080], [1080, 1920], [1200, 627], [1080, 1350], [1280, 720]];

    for (let i = 0; i < 100; i++) {
      const routing: NovaFrameRouting = {
        persona: personas[i % personas.length],
        version: `V${(i % 10) + 1}`,
        platform: platforms[i % platforms.length],
        width: dims[i % dims.length][0],
        height: dims[i % dims.length][1],
      };

      const frameName = buildFrameName(routing);
      const parsed = parseFrameName(frameName);

      expect(parsed).not.toBeNull();
      expect(parsed!.persona).toBe(routing.persona);
      expect(parsed!.version).toBe(routing.version);
      expect(parsed!.platform).toBe(routing.platform);
      expect(parsed!.width).toBe(routing.width);
      expect(parsed!.height).toBe(routing.height);
    }
  });

  it('roundtrips all known platforms', () => {
    const platforms = [
      'ig_feed', 'ig_story', 'ig_carousel',
      'linkedin_feed', 'facebook_feed', 'tiktok_feed',
      'telegram_card', 'twitter_post', 'google_display',
      'indeed_banner', 'whatsapp_story',
    ];

    for (const platform of platforms) {
      const routing: NovaFrameRouting = {
        persona: 'TestUser',
        version: 'V1',
        platform,
        width: 1080,
        height: 1080,
      };
      const parsed = parseFrameName(buildFrameName(routing));
      expect(parsed).not.toBeNull();
      expect(parsed!.platform).toBe(platform);
    }
  });

  it('roundtrips all versions V1-V20', () => {
    for (let v = 1; v <= 20; v++) {
      const routing: NovaFrameRouting = {
        persona: 'Maria',
        version: `V${v}`,
        platform: 'ig_feed',
        width: 1080,
        height: 1080,
      };
      const parsed = parseFrameName(buildFrameName(routing));
      expect(parsed).not.toBeNull();
      expect(parsed!.version).toBe(`V${v}`);
    }
  });

  it('roundtrips various persona names', () => {
    const personas = ['Maria', 'Alex', 'Priya', 'Chen', 'Muhammad', 'Olga'];
    for (const persona of personas) {
      const routing: NovaFrameRouting = {
        persona,
        version: 'V1',
        platform: 'ig_feed',
        width: 1080,
        height: 1080,
      };
      const parsed = parseFrameName(buildFrameName(routing));
      expect(parsed).not.toBeNull();
      expect(parsed!.persona).toBe(persona);
    }
  });

  it('roundtrips various dimensions', () => {
    const dimensions: [number, number][] = [
      [1080, 1080], [1080, 1920], [1200, 627], [1200, 628],
      [1280, 720], [1200, 675], [1080, 1350],
    ];
    for (const [w, h] of dimensions) {
      const routing: NovaFrameRouting = {
        persona: 'Maria',
        version: 'V1',
        platform: 'ig_feed',
        width: w,
        height: h,
      };
      const parsed = parseFrameName(buildFrameName(routing));
      expect(parsed).not.toBeNull();
      expect(parsed!.width).toBe(w);
      expect(parsed!.height).toBe(h);
    }
  });

  it('roundtrips edge case dimensions: 1x1 and 9999x9999', () => {
    for (const [w, h] of [[1, 1], [9999, 9999]] as [number, number][]) {
      const routing: NovaFrameRouting = {
        persona: 'Edge',
        version: 'V1',
        platform: 'ig_feed',
        width: w,
        height: h,
      };
      const parsed = parseFrameName(buildFrameName(routing));
      expect(parsed).not.toBeNull();
      expect(parsed!.width).toBe(w);
      expect(parsed!.height).toBe(h);
    }
  });

  it('handles single-segment platform (no underscores) — regex requires [a-z_]+', () => {
    // The regex pattern is [a-z_]+ which means a platform without underscores
    // like "reddit" should still match (it's one or more lowercase letters)
    const routing: NovaFrameRouting = {
      persona: 'Maria',
      version: 'V1',
      platform: 'reddit',
      width: 1080,
      height: 1080,
    };
    const frameName = buildFrameName(routing);
    expect(frameName).toBe('Nova_Maria_V1_reddit_1080x1080');
    const parsed = parseFrameName(frameName);
    // HOWEVER: the regex is greedy with [a-z_]+ before _\d+x\d+
    // "Nova_Maria_V1_reddit_1080x1080" → the [a-z_]+ will greedily match "reddit"
    // then expects _\d+x\d+ which is _1080x1080 → should work
    expect(parsed).not.toBeNull();
    expect(parsed!.platform).toBe('reddit');
  });

  it('buildFrameName output always starts with "Nova_"', () => {
    const names = [
      { persona: 'A', version: 'V1', platform: 'x', width: 1, height: 1 },
      { persona: 'LongPersonaName', version: 'V99', platform: 'ig_feed', width: 9999, height: 9999 },
      { persona: 'Z', version: 'V1', platform: 'a_b_c', width: 100, height: 200 },
    ];
    for (const routing of names) {
      const frameName = buildFrameName(routing);
      expect(frameName.startsWith('Nova_')).toBe(true);
    }
  });

  it('buildFrameName output structure: Nova + 4 underscore-separated segments', () => {
    // Pattern: Nova_{persona}_{version}_{platform}_{WxH}
    // For a platform WITHOUT underscores, there are exactly 4 underscores:
    //   Nova _ persona _ version _ platform _ WxH
    // For a platform WITH underscores (like ig_feed), there are more.
    // The fixed structure is: starts with "Nova_", then persona, version, platform, dims
    const routing: NovaFrameRouting = {
      persona: 'Maria',
      version: 'V1',
      platform: 'ig_feed',
      width: 1080,
      height: 1080,
    };
    const frameName = buildFrameName(routing);
    expect(frameName).toBe('Nova_Maria_V1_ig_feed_1080x1080');
    // For ig_feed (has underscore), total underscores = 5
    const underscoreCount = (frameName.match(/_/g) || []).length;
    expect(underscoreCount).toBe(5);

    // For a platform without underscores, total underscores = 4
    const routing2: NovaFrameRouting = {
      persona: 'Alex',
      version: 'V2',
      platform: 'reddit',
      width: 800,
      height: 600,
    };
    const frameName2 = buildFrameName(routing2);
    const underscoreCount2 = (frameName2.match(/_/g) || []).length;
    expect(underscoreCount2).toBe(4);
  });
});

// ============================================================
// parseFrameName — edge cases and invalids
// ============================================================

describe('parseFrameName edge cases', () => {
  it('returns null for empty string', () => {
    expect(parseFrameName('')).toBeNull();
  });

  it('returns null for frame name without Nova_ prefix', () => {
    expect(parseFrameName('Maria_V1_ig_feed_1080x1080')).toBeNull();
  });

  it('returns null for Nova_ with missing segments', () => {
    expect(parseFrameName('Nova_Maria')).toBeNull();
    expect(parseFrameName('Nova_Maria_V1')).toBeNull();
    expect(parseFrameName('Nova_Maria_V1_ig_feed')).toBeNull();
  });

  it('returns null when version lacks V prefix', () => {
    expect(parseFrameName('Nova_Maria_1_ig_feed_1080x1080')).toBeNull();
  });

  it('returns null when dimensions use wrong separator', () => {
    expect(parseFrameName('Nova_Maria_V1_ig_feed_1080-1080')).toBeNull();
    expect(parseFrameName('Nova_Maria_V1_ig_feed_1080*1080')).toBeNull();
  });

  it('returns null for uppercase platform', () => {
    expect(parseFrameName('Nova_Maria_V1_IG_FEED_1080x1080')).toBeNull();
  });

  it('correctly parses platform with multiple underscores (greedy match)', () => {
    // The regex [a-z_]+ is greedy. For "Nova_Maria_V1_a_b_c_1080x1080":
    // It needs to match persona=Maria, version=V1, platform=[a-z_]+, dims=1080x1080
    // The greedy [a-z_]+ will try to eat "a_b_c_1080x1080" but _\d+x\d+$ anchors it
    // Actually the full regex is: ^Nova_(\w+)_(V\d+)_([a-z_]+)_(\d+)x(\d+)$
    // So [a-z_]+ followed by _ then \d+x\d+ at end
    // For "a_b_c", the regex engine will backtrack to find the last _ before \d+x\d+$
    const parsed = parseFrameName('Nova_Maria_V1_a_b_c_1080x1080');
    expect(parsed).not.toBeNull();
    expect(parsed!.platform).toBe('a_b_c');
    expect(parsed!.width).toBe(1080);
  });
});

// ============================================================
// buildFrameName — output format
// ============================================================

describe('buildFrameName output format', () => {
  it('produces exact expected string', () => {
    const routing: NovaFrameRouting = {
      persona: 'Maria',
      version: 'V1',
      platform: 'ig_feed',
      width: 1080,
      height: 1080,
    };
    expect(buildFrameName(routing)).toBe('Nova_Maria_V1_ig_feed_1080x1080');
  });

  it('preserves numeric precision (no floating point)', () => {
    const routing: NovaFrameRouting = {
      persona: 'Test',
      version: 'V1',
      platform: 'ig_feed',
      width: 1200,
      height: 628,
    };
    const name = buildFrameName(routing);
    expect(name).toContain('1200x628');
    expect(name).not.toContain('.');
  });
});
