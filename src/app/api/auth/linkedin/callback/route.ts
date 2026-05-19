import { NextRequest, NextResponse } from 'next/server';

/**
 * LinkedIn OAuth 2.0 callback — exchanges auth code for access token.
 * One-time use for setting up organic sync credentials.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.json({ error, description: req.nextUrl.searchParams.get('error_description') }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'No code parameter' }, { status: 400 });
  }

  // Exchange code for access token
  const CLIENT_ID = '786lo3ivvkpbrb';
  const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || '';
  const REDIRECT_URI = 'https://onetake.oneforma.com/api/auth/linkedin/callback';

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'Token exchange failed', details: tokenData }, { status: 400 });
  }

  // Token obtained — now fetch org admin info to find the org ID
  const accessToken = tokenData.access_token;
  let orgInfo = null;

  try {
    const orgRes = await fetch('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName,vanityName)))', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    orgInfo = await orgRes.json();
  } catch {
    // Non-critical — we still have the token
  }

  return NextResponse.json({
    success: true,
    access_token: accessToken,
    expires_in: tokenData.expires_in,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
    org_info: orgInfo,
    instructions: 'Save the access_token as LI_TOKEN in your worker env. Find the org ID from org_info above.',
  });
}
