"""Update Centaurus job post (178019) — replace apply_job locale links.

Replaces the ACF apply_job repeater rows with the new simplified
MyOneForma signup links. Countries marked "on hold" are excluded.

Run: cd worker && python3 update_centaurus_links.py
"""
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from wp_rest_client import WordPressClient

# ─── New locale links ───────────────────────────────────────────────────

NEW_LOCALE_LINKS: list[dict[str, str]] = [
    {"language": "Australia", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819742646441985"},
    {"language": "Bulgaria", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815948340524033"},
    {"language": "Canada EN", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1817621663669249"},
    {"language": "Canada FR", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815950271647745"},
    {"language": "Chile", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815950480446465"},
    {"language": "Colombia", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621385729"},
    {"language": "Croatia", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621402113"},
    {"language": "Czech Republic", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621406209"},
    {"language": "Egypt", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819743078462465"},
    {"language": "Ireland", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621339649"},
    {"language": "France", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819745356365825"},
    {"language": "Germany", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621410305"},
    {"language": "Greece", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621380609"},
    {"language": "Hong Kong", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819745513711617"},
    {"language": "Israel", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819745884722177"},
    {"language": "Italy", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621346817"},
    {"language": "Japan", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819746090118145"},
    {"language": "Malaysia", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621350913"},
    {"language": "Mexico", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819746437460993"},
    {"language": "Morocco", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819746603143169"},
    {"language": "New Zealand", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819746836179969"},
    {"language": "Poland", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621355009"},
    {"language": "Portugal", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819747029368833"},
    {"language": "Romania", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621359105"},
    {"language": "Singapore", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819747212751873"},
    {"language": "South Africa", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621369345"},
    {"language": "Spain", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819747341632513"},
    {"language": "Turkey", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819747505868801"},
    {"language": "UAE", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819747667638273"},
    {"language": "USA", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1815956621372417"},
    {"language": "Vietnam", "apply_url": "https://my.oneforma.com/webapp/dataCollection/signup?requestId=1819747794577409"},
]

# Countries on hold (excluded from the repeater)
ON_HOLD = ["India", "Kenya"]

POST_ID = 178019


async def main():
    print("=" * 60)
    print("CENTAURUS — UPDATE LOCALE LINKS")
    print(f"  Post ID: {POST_ID}")
    print(f"  Countries: {len(NEW_LOCALE_LINKS)} active, {len(ON_HOLD)} on hold")
    print("=" * 60)

    async with WordPressClient() as wp:
        # Step 1: Fetch current state
        print("\n[1/3] Fetching current post...")
        resp = await wp._client.get(f"{wp._api_base}/job/{POST_ID}")
        if resp.status_code != 200:
            print(f"  ERROR: {resp.status_code} — {resp.text[:300]}")
            return

        current = resp.json()
        title = current.get("title", {}).get("rendered", "")
        print(f"  Title:  {title}")
        print(f"  Status: {current.get('status')}")

        # Show current ACF apply_job if available
        current_acf = current.get("acf", {})
        current_rows = current_acf.get("apply_job", [])
        print(f"  Current apply_job rows: {len(current_rows) if current_rows else 0}")
        if current_rows:
            for i, row in enumerate(current_rows[:5]):
                lang = row.get("language", "?")
                url = row.get("apply_url", "?")
                print(f"    [{i}] {lang}: {url[:60]}...")
            if len(current_rows) > 5:
                print(f"    ... and {len(current_rows) - 5} more")

        # Step 2: Update ACF fields
        print(f"\n[2/3] Updating apply_job with {len(NEW_LOCALE_LINKS)} rows...")
        acf_payload = {
            "acf": {
                "apply_job_title": f"This role is available in {len(NEW_LOCALE_LINKS)} countries",
                "apply_job_description": "Select your country to apply.",
                "apply_job": NEW_LOCALE_LINKS,
            }
        }

        resp = await wp._client.post(
            f"{wp._api_base}/job/{POST_ID}",
            json=acf_payload,
        )

        if resp.status_code in (200, 201):
            result = resp.json()
            print(f"  Status: {result.get('status')}")
            print(f"  Link:   {result.get('link')}")
            updated_acf = result.get("acf", {})
            updated_rows = updated_acf.get("apply_job", [])
            print(f"  Updated apply_job rows: {len(updated_rows) if updated_rows else 'N/A'}")
        else:
            print(f"  ERROR: {resp.status_code}")
            print(f"  {resp.text[:500]}")
            return

        # Step 3: Verify
        print("\n[3/3] Verifying update...")
        verify = await wp._client.get(f"{wp._api_base}/job/{POST_ID}")
        if verify.status_code == 200:
            data = verify.json()
            verify_acf = data.get("acf", {})
            verify_rows = verify_acf.get("apply_job", [])
            print(f"  Verified apply_job rows: {len(verify_rows) if verify_rows else 0}")

            if verify_rows:
                # Spot-check first and last
                first = verify_rows[0]
                last = verify_rows[-1]
                print(f"  First: {first.get('language')} → {first.get('apply_url', '')[:60]}...")
                print(f"  Last:  {last.get('language')} → {last.get('apply_url', '')[:60]}...")

                # Verify all rows match
                mismatches = []
                for i, (expected, actual) in enumerate(zip(NEW_LOCALE_LINKS, verify_rows)):
                    if expected["apply_url"] != actual.get("apply_url", ""):
                        mismatches.append(expected["language"])
                if mismatches:
                    print(f"\n  WARNING: Mismatches in: {', '.join(mismatches)}")
                else:
                    print(f"\n  ALL {len(verify_rows)} ROWS VERIFIED OK")
            print(f"\n  DONE. Live at: {data.get('link')}")
        else:
            print(f"  Verify failed: {verify.status_code}")

    print("\n" + "=" * 60)
    print("CHANGES SUMMARY:")
    print(f"  - apply_job: updated to {len(NEW_LOCALE_LINKS)} country rows")
    print(f"  - On hold (excluded): {', '.join(ON_HOLD)}")
    print(f"  - All links point to my.oneforma.com/webapp/dataCollection/signup")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
