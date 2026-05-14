import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * Cron endpoint — triggers daily metric sync jobs.
 *
 * Called by Vercel Cron every 6 hours. Inserts compute_jobs for:
 * 1. organic_sync — pulls Meta organic (FB + IG), LinkedIn, Reddit, GSC
 * 2. creative_sync — pulls Meta ad creatives + GA4 funnel enrichment
 *
 * Auth: Vercel Cron sends CRON_SECRET header automatically.
 * Fallback: accepts ?secret= query param for manual testing.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const querySecret = request.nextUrl.searchParams.get('secret');

  if (cronSecret) {
    const provided = authHeader?.replace('Bearer ', '') || querySecret;
    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const sql = getDb();
  const results: string[] = [];

  try {
    // 1. Queue organic sync (Meta organic, LinkedIn, Reddit, GSC)
    const organicJob = await sql`
      INSERT INTO compute_jobs (job_type, feedback_data, status)
      VALUES ('organic_sync', ${JSON.stringify({ days: 7 })}::jsonb, 'pending')
      RETURNING id
    `;
    results.push(`organic_sync: ${organicJob[0]?.id}`);
  } catch (err) {
    results.push(`organic_sync: error — ${(err as Error).message?.slice(0, 100)}`);
  }

  // 2. Refresh IG posts directly (lightweight — just API call + DB upsert)
  try {
    const igToken = process.env.META_PAGE_ACCESS_TOKEN;
    const igId = process.env.META_IG_BUSINESS_ID;

    if (igToken && igId) {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${igId}/media?fields=id,caption,media_type,timestamp,permalink,like_count,comments_count&limit=25&access_token=${igToken}`,
      );
      if (res.ok) {
        const data = await res.json();
        const posts = data.data || [];
        let synced = 0;
        const today = new Date().toISOString().split('T')[0];

        for (const post of posts) {
          const likes = post.like_count || 0;
          const comments = post.comments_count || 0;
          const mt = (post.media_type || 'IMAGE').toLowerCase();
          const pt = mt === 'video' ? 'video' : mt === 'carousel_album' ? 'carousel' : 'photo';

          // Parse timestamp
          let published: string | null = null;
          if (post.timestamp) {
            published = new Date(post.timestamp).toISOString();
          }

          await sql`
            INSERT INTO meta_organic_cache (
              page_id, post_id, post_type, platform, post_url, post_text,
              published_at, impressions, reach, engagement, likes, comments,
              shares, saves, clicks, video_views, date
            ) VALUES (
              '442340255625011', ${post.id}, ${pt}, 'instagram',
              ${post.permalink || ''}, ${(post.caption || '').slice(0, 2000)},
              ${published}::timestamptz, 0, 0, ${likes + comments}, ${likes}, ${comments},
              0, 0, 0, 0, ${today}::date
            )
            ON CONFLICT (page_id, post_id, date) DO UPDATE SET
              engagement = EXCLUDED.engagement,
              likes = EXCLUDED.likes,
              comments = EXCLUDED.comments,
              last_synced_at = NOW()
          `;
          synced++;
        }
        results.push(`ig_sync: ${synced} posts updated`);

        // Update follower count snapshot
        const profileRes = await fetch(
          `https://graph.facebook.com/v21.0/${igId}?fields=followers_count,media_count&access_token=${igToken}`,
        );
        if (profileRes.ok) {
          const profile = await profileRes.json();
          await sql`
            INSERT INTO social_account_snapshots (
              platform, account_id, account_name, followers, post_count, date
            ) VALUES (
              'instagram', ${igId}, 'oneforma.global',
              ${profile.followers_count || 0}, ${profile.media_count || 0},
              ${today}::date
            )
            ON CONFLICT (platform, account_id, date) DO UPDATE SET
              followers = EXCLUDED.followers,
              post_count = EXCLUDED.post_count,
              last_synced_at = NOW()
          `;
          results.push(`ig_snapshot: ${profile.followers_count} followers`);
        }
      }
    } else {
      results.push('ig_sync: skipped (no credentials)');
    }
  } catch (err) {
    results.push(`ig_sync: error — ${(err as Error).message?.slice(0, 100)}`);
  }

  // 3. Refresh FB organic posts
  try {
    const pageToken = process.env.META_PAGE_ACCESS_TOKEN;
    const pageId = '442340255625011';

    if (pageToken) {
      const since = Math.floor((Date.now() - 7 * 86400000) / 1000);
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/posts?fields=id,message,created_time,permalink_url&since=${since}&limit=50&access_token=${pageToken}`,
      );
      if (res.ok) {
        const data = await res.json();
        const posts = data.data || [];
        let synced = 0;
        const today = new Date().toISOString().split('T')[0];

        for (const post of posts) {
          let published: string | null = null;
          if (post.created_time) {
            published = new Date(post.created_time).toISOString();
          }

          await sql`
            INSERT INTO meta_organic_cache (
              page_id, post_id, platform, post_url, post_text, published_at,
              impressions, reach, engagement, likes, comments, shares, saves, clicks,
              video_views, date
            ) VALUES (
              ${pageId}, ${post.id}, 'facebook',
              ${post.permalink_url || ''}, ${(post.message || '').slice(0, 2000)},
              ${published}::timestamptz, 0, 0, 0, 0, 0, 0, 0, 0, 0, ${today}::date
            )
            ON CONFLICT (page_id, post_id, date) DO UPDATE SET
              post_text = EXCLUDED.post_text,
              post_url = EXCLUDED.post_url,
              last_synced_at = NOW()
          `;
          synced++;
        }
        results.push(`fb_sync: ${synced} posts updated`);
      }
    }
  } catch (err) {
    results.push(`fb_sync: error — ${(err as Error).message?.slice(0, 100)}`);
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
