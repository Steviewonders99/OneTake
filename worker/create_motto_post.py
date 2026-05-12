"""Create Motto job post — native English audio recording across 7 countries.

Project: Motto
Client: Isaac
Type: Audio data collection — natural English speech
Locales: 7 English-speaking countries, $3-$21.60/task

Run: python3 create_motto_post.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from wp_rest_client import WordPressClient

TITLE = "Record Yourself Speaking English Naturally — Help AI Understand Real Conversations"

SLUG = "motto"

EXCERPT = (
    "Use your iPhone to record yourself speaking naturally for at least 2 minutes. "
    "Chat about the news, tell a story, or riff on a topic you love — like recording "
    "a podcast. Native English speakers in 7 countries. Paid per completed session."
)

ACF_APPLY_JOB = [
    {"language": "English (Australia)", "apply_url": "https://my.oneforma.com/crowd/jobs/12240?from=list&tab=all"},
    {"language": "English (India)", "apply_url": "https://my.oneforma.com/crowd/jobs/12243?from=list&tab=all"},
    {"language": "English (Ireland)", "apply_url": "https://my.oneforma.com/crowd/jobs/12241?from=list&tab=all"},
    {"language": "English (New Zealand)", "apply_url": "https://my.oneforma.com/crowd/jobs/12242?from=list&tab=all"},
    {"language": "English (Singapore)", "apply_url": "https://my.oneforma.com/crowd/jobs/12245?from=list&tab=all"},
    {"language": "English (South Africa)", "apply_url": "https://my.oneforma.com/crowd/jobs/12244?from=list&tab=all"},
    {"language": "English (United Kingdom)", "apply_url": "https://my.oneforma.com/crowd/jobs/12239?from=list&tab=all"},
]

CONTENT = """\
<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">The way you speak English is exactly what AI needs to hear</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>AI speech models trained on scripted recordings miss the way people actually talk — the pace, the slang, the natural rhythm of a real conversation. Your everyday English, spoken in your own voice and your own environment, helps AI understand how real people communicate.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Use your iPhone to record yourself speaking naturally for at least 2 minutes per session — as if you're chatting with friends, recording a podcast, or telling a story. No scripts. No studio. Just you.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">What you'll do</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Record yourself speaking naturally in English for at least <strong>2 minutes per session</strong>. You can record solo or with up to 3 other people.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Pick from topics like:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list">
<li><strong>Talk about a news event</strong> you've been following</li>
<li><strong>Riff on a topic you love</strong>, as if recording a podcast</li>
<li><strong>Tell stories</strong> using fictitious names and places</li>
</ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>The goal is authentic, everyday speech — the kind of conversation you'd have at a coffee shop or on a voice note to a friend.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Why this matters</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>English sounds different in Dublin, Delhi, Auckland, and Sydney. AI needs to understand all of it — not just one accent or one speaking style. Your recordings help build speech models that work for English speakers everywhere, capturing the natural diversity of how the language is actually spoken around the world.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Compensation</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Pay is per completed session and varies by country:</p>
<!-- /wp:paragraph -->

<!-- wp:table -->
<figure class="wp-block-table"><table><thead><tr><th>Country</th><th>Rate per session</th></tr></thead><tbody><tr><td>Australia</td><td><strong>$21.60</strong></td></tr><tr><td>Ireland</td><td><strong>$21.60</strong></td></tr><tr><td>United Kingdom</td><td><strong>$21.31</strong></td></tr><tr><td>New Zealand</td><td><strong>$18.38</strong></td></tr><tr><td>South Africa</td><td><strong>$12.00</strong></td></tr><tr><td>Singapore</td><td><strong>$9.60</strong></td></tr><tr><td>India</td><td><strong>$3.00</strong></td></tr></tbody></table></figure>
<!-- /wp:table -->

<!-- wp:paragraph -->
<p>Payment is based on completed, approved sessions.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><strong>Select your country below to apply.</strong></p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">How it works</h2>
<!-- /wp:heading -->

<!-- wp:list {"ordered":true} -->
<ol class="wp-block-list">
<li><strong>Apply</strong> — select your country and confirm eligibility</li>
<li><strong>Get your guidelines</strong> — receive simple recording instructions</li>
<li><strong>Record</strong> — use your iPhone to capture at least 2 minutes of natural speech</li>
<li><strong>Submit</strong> — upload your audio for review</li>
<li><strong>Get paid</strong> — receive payment for each approved session</li>
</ol>
<!-- /wp:list -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Who can participate</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>You're eligible if you:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list">
<li>Are a <strong>native English speaker</strong></li>
<li>Live in one of the 7 eligible countries</li>
<li>Have an <strong>iPhone</strong></li>
<li>Are comfortable speaking naturally on everyday topics</li>
</ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>No prior experience required. No app download needed.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:paragraph -->
<p><strong>Ready to put your voice to work?</strong> Select your country below and apply.</p>
<!-- /wp:paragraph -->
"""


async def main():
    print("=" * 60)
    print("MOTTO JOB POST — CREATE")
    print("=" * 60)

    async with WordPressClient() as wp:
        # Check if slug exists
        print("\n[1/3] Checking if 'motto' slug exists...")
        resp = await wp._client.get(
            f"{wp._api_base}/job",
            params={"slug": SLUG, "per_page": 1},
        )
        if resp.status_code == 200 and resp.json():
            existing = resp.json()[0]
            print(f"  Exists: ID={existing['id']}, status={existing['status']}")
            print(f"  Updating...")
            update_resp = await wp._client.post(
                f"{wp._api_base}/job/{existing['id']}",
                json={
                    "title": TITLE,
                    "content": CONTENT,
                    "excerpt": EXCERPT,
                    "acf": {"apply_job": ACF_APPLY_JOB},
                },
            )
            if update_resp.status_code in (200, 201):
                r = update_resp.json()
                print(f"  Updated: ID={r['id']}, link={r.get('link')}")
            else:
                print(f"  ERROR: {update_resp.status_code} — {update_resp.text[:500]}")
            return

        # Create
        print("\n[2/3] Creating Motto job post...")
        payload = {
            "title": TITLE,
            "content": CONTENT,
            "excerpt": EXCERPT,
            "status": "draft",
            "slug": SLUG,
            "acf": {"apply_job": ACF_APPLY_JOB},
        }

        resp = await wp._client.post(f"{wp._api_base}/job", json=payload)

        if resp.status_code in (200, 201):
            result = resp.json()
            print(f"  ID:      {result.get('id')}")
            print(f"  Title:   {result.get('title', {}).get('rendered')}")
            print(f"  Status:  {result.get('status')}")
            print(f"  Slug:    {result.get('slug')}")
            print(f"  Link:    {result.get('link')}")
            content_len = len(result.get("content", {}).get("rendered", ""))
            print(f"  Content: {content_len} chars")
            acf = result.get("acf", {})
            apply_jobs = acf.get("apply_job", [])
            print(f"  ACF:     {len(apply_jobs)} locale entries")
            for e in apply_jobs:
                print(f"    - {e.get('language')}: {e.get('apply_url', '')[:60]}...")
        else:
            print(f"  ERROR: {resp.status_code}")
            print(f"  {resp.text[:500]}")
            return

        # Verify
        print(f"\n[3/3] Verifying...")
        post_id = result.get("id")
        verify = await wp._client.get(f"{wp._api_base}/job/{post_id}")
        if verify.status_code == 200:
            d = verify.json()
            print(f"  Title:   {d.get('title', {}).get('rendered')}")
            print(f"  Status:  {d.get('status')}")
            print(f"  ACF:     {len(d.get('acf', {}).get('apply_job', []))} entries")
            print(f"\n  Preview: {d.get('link')}")

    print("\n" + "=" * 60)
    print("DONE — Motto draft created")
    print("  7 locales, $3-$21.60/session, iPhone audio recording")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
