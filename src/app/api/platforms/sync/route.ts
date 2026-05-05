import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/permissions';

import { isMetaAdsConnected, syncMetaAds, normalizeMetaAds } from '@/lib/platforms/meta-ads';
import { isRedditAdsConnected, syncRedditAds, normalizeRedditAds } from '@/lib/platforms/reddit-ads';
import { isBrevoConnected, syncBrevo } from '@/lib/platforms/brevo';
import type { PlatformSyncResult, PlatformNormalizeResult } from '@/lib/platforms/types';

interface SyncResultEntry {
  sync: PlatformSyncResult;
  normalize?: PlatformNormalizeResult;
}

export async function POST(request: NextRequest) {
  const authCtx = await getAuthContext();
  if (!authCtx || authCtx.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const requestId = body.request_id as string | undefined;
  const platforms = body.platforms as string[] | undefined;
  const days = (body.days as number) || 7;

  const results: Record<string, SyncResultEntry> = {};
  let totalNormalized = 0;

  // Meta Ads
  if (isMetaAdsConnected() && (!platforms || platforms.includes('meta_ads'))) {
    const sync = await syncMetaAds(requestId, days);
    let normalize: PlatformNormalizeResult | undefined;
    if (sync.success && sync.rows_synced > 0) {
      normalize = await normalizeMetaAds(requestId);
      totalNormalized += normalize.rows_normalized;
    }
    results.meta_ads = { sync, normalize };
  }

  // Reddit Ads
  if (isRedditAdsConnected() && (!platforms || platforms.includes('reddit_ads'))) {
    const sync = await syncRedditAds(requestId, days);
    let normalize: PlatformNormalizeResult | undefined;
    if (sync.success && sync.rows_synced > 0) {
      normalize = await normalizeRedditAds(requestId);
      totalNormalized += normalize.rows_normalized;
    }
    results.reddit_ads = { sync, normalize };
  }

  // Brevo (email — separate table, no normalization into daily metrics)
  if (isBrevoConnected() && (!platforms || platforms.includes('brevo'))) {
    const sync = await syncBrevo(requestId, days);
    results.brevo = { sync };
  }

  const platformsSynced = Object.keys(results).filter(k => results[k].sync.success);

  return NextResponse.json({
    platforms_synced: platformsSynced,
    results,
    total_normalized: totalNormalized,
  });
}
