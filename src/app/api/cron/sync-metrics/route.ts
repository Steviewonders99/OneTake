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

  // 4. GA4 sessions + funnel events (last 7 days refresh)
  try {
    // Get Google token via ADC refresh
    let ga4Token: string | null = null;
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN || '',
        }),
      });
      if (tokenRes.ok) {
        ga4Token = (await tokenRes.json()).access_token;
      }
    } catch { /* no Google creds in env */ }

    if (ga4Token) {
      const propertyId = process.env.GA4_PROPERTY_ID || '330157295';
      const since = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const until = new Date().toISOString().split('T')[0];

      // GA4 sessions by source/medium/campaign/country/device
      const sessionsBody = JSON.stringify({
        dateRanges: [{ startDate: since, endDate: until }],
        dimensions: [
          { name: 'date' }, { name: 'sessionSource' }, { name: 'sessionMedium' },
          { name: 'sessionCampaignName' }, { name: 'country' }, { name: 'deviceCategory' },
        ],
        metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'conversions' }],
        limit: 10000,
      });

      const sessRes = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        { method: 'POST', headers: { Authorization: `Bearer ${ga4Token}`, 'Content-Type': 'application/json' }, body: sessionsBody, signal: AbortSignal.timeout(30000) },
      );

      if (sessRes.ok) {
        const sessData = await sessRes.json();
        let sessionsSynced = 0;
        for (const row of sessData.rows || []) {
          const dims = row.dimensionValues?.map((d: any) => d.value) || [];
          const mets = row.metricValues?.map((m: any) => m.value) || [];
          let dateStr = dims[0] || since;
          if (dateStr.length === 8) dateStr = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;

          await sql`
            INSERT INTO ga4_session_cache (property_id, date, source, medium, campaign, country, device_category, sessions, engaged_sessions, conversions)
            VALUES (${propertyId}, ${dateStr}::date, ${dims[1] || '(not set)'}, ${dims[2] || '(not set)'}, ${dims[3] || '(not set)'}, ${dims[4] || 'GLOBAL'}, ${dims[5] || 'ALL'}, ${parseInt(mets[0]||'0')}, ${parseInt(mets[1]||'0')}, ${parseInt(mets[2]||'0')})
            ON CONFLICT (property_id, date, source, medium, campaign, country, device_category) DO UPDATE SET
              sessions=EXCLUDED.sessions, engaged_sessions=EXCLUDED.engaged_sessions, conversions=EXCLUDED.conversions, synced_at=NOW()
          `.catch(() => {});
          sessionsSynced++;
        }
        results.push(`ga4_sessions: ${sessionsSynced} rows`);
      }

      // GA4 funnel events
      const funnelEvents = ['session_start', 'sign_up', 'purchase', 'apply_click', 'generate_lead', 'begin_checkout', 'AdToHomepageView', 'Job Details Page', 'Onboarding', 'UserEnterLoginPage'];
      const funnelBody = JSON.stringify({
        dateRanges: [{ startDate: since, endDate: until }],
        dimensions: [{ name: 'date' }, { name: 'eventName' }, { name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'sessionCampaignName' }, { name: 'country' }],
        metrics: [{ name: 'eventCount' }, { name: 'conversions' }],
        dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: funnelEvents } } },
        limit: 25000,
      });

      const funnelRes = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        { method: 'POST', headers: { Authorization: `Bearer ${ga4Token}`, 'Content-Type': 'application/json' }, body: funnelBody, signal: AbortSignal.timeout(30000) },
      );

      if (funnelRes.ok) {
        const funnelData = await funnelRes.json();
        let funnelSynced = 0;
        for (const row of funnelData.rows || []) {
          const dims = row.dimensionValues?.map((d: any) => d.value) || [];
          const mets = row.metricValues?.map((m: any) => m.value) || [];
          let dateStr = dims[0] || since;
          if (dateStr.length === 8) dateStr = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;

          await sql`
            INSERT INTO ga4_funnel_events (property_id, date, event_name, source, medium, campaign, country, event_count, conversions)
            VALUES (${propertyId}, ${dateStr}::date, ${dims[1] || ''}, ${dims[2] || '(not set)'}, ${dims[3] || '(not set)'}, ${dims[4] || '(not set)'}, ${dims[5] || 'GLOBAL'}, ${parseInt(mets[0]||'0')}, ${parseInt(mets[1]||'0')})
            ON CONFLICT (property_id, date, event_name, source, medium, campaign, country) DO UPDATE SET
              event_count=EXCLUDED.event_count, conversions=EXCLUDED.conversions, synced_at=NOW()
          `.catch(() => {});
          funnelSynced++;
        }
        results.push(`ga4_funnel: ${funnelSynced} rows`);
      }
    } else {
      results.push('ga4: skipped (no Google credentials in env)');
    }
  } catch (err) {
    results.push(`ga4: error — ${(err as Error).message?.slice(0, 100)}`);
  }

  // 5. Meta Ads paid metrics (last 7 days)
  try {
    const metaToken = process.env.META_ADS_ACCESS_TOKEN;
    const adAccountId = process.env.META_ADS_AD_ACCOUNT_ID;

    if (metaToken && adAccountId) {
      const since = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const until = new Date().toISOString().split('T')[0];

      const adRes = await fetch(
        `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?` +
        `fields=campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,actions` +
        `&time_range={"since":"${since}","until":"${until}"}&time_increment=1&level=adset&limit=500` +
        `&access_token=${metaToken}`,
        { signal: AbortSignal.timeout(30000) },
      );

      if (adRes.ok) {
        const adData = await adRes.json();
        let adsSynced = 0;
        for (const row of adData.data || []) {
          const conversions = (row.actions || [])
            .filter((a: any) => ['offsite_conversion', 'lead', 'purchase'].includes(a.action_type))
            .reduce((sum: number, a: any) => sum + parseInt(a.value || '0'), 0);

          await sql`
            INSERT INTO meta_ads_cache (ad_account_id, campaign_id, campaign_name, adset_id, adset_name, impressions, clicks, conversions, spend, date)
            VALUES (${adAccountId}, ${row.campaign_id}, ${row.campaign_name}, ${row.adset_id || ''}, ${row.adset_name || ''}, ${parseInt(row.impressions||'0')}, ${parseInt(row.clicks||'0')}, ${conversions}, ${parseFloat(row.spend||'0')}, ${row.date_start}::date)
            ON CONFLICT (ad_account_id, campaign_id, adset_id, date) DO UPDATE SET
              impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks, conversions=EXCLUDED.conversions,
              spend=EXCLUDED.spend, campaign_name=EXCLUDED.campaign_name, last_synced_at=NOW()
          `.catch(() => {});
          adsSynced++;
        }
        results.push(`meta_ads: ${adsSynced} rows`);
      }
    } else {
      results.push('meta_ads: skipped (no credentials)');
    }
  } catch (err) {
    results.push(`meta_ads: error — ${(err as Error).message?.slice(0, 100)}`);
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
