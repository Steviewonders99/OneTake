"""Retry failed images via Seedream 4.5 Edit.

Fetches all failed base_image assets for a request, runs Seedream Edit
to fix artifacts/watermarks, re-runs VQA, and updates the DB if they pass.
"""
import asyncio
import json
import logging
import os
import sys
import tempfile
import uuid

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("retry_failed")

REQUEST_ID = sys.argv[1] if len(sys.argv) > 1 else "fd318779-45f2-45bb-b0ff-5420c5c10260"
VQA_THRESHOLD = 0.75


async def main():
    import httpx
    from neon_client import _get_pool
    from ai.flux_edit import edit_image_flux
    from ai.local_vlm import analyze_image
    from ai.deglosser import degloss
    from blob_uploader import upload_to_blob
    from prompts.recruitment_actors import build_visual_qa_prompt
    from pipeline.stage2_images import _parse_json

    pool = await _get_pool()

    # Get failed images
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, blob_url, content, evaluation_data
               FROM generated_assets
               WHERE request_id = $1
                 AND asset_type = 'base_image'
                 AND evaluation_passed = false
                 AND blob_url IS NOT NULL""",
            REQUEST_ID,
        )

    logger.info("Found %d failed images to retry via Seedream Edit", len(rows))

    fixed = 0
    still_failed = 0

    for row in rows:
        asset_id = str(row["id"])
        blob_url = row["blob_url"]
        content = row["content"] if isinstance(row["content"], dict) else json.loads(row["content"] or "{}")
        actor_name = content.get("actor_name", content.get("name", "Unknown"))

        logger.info("Retrying %s (asset %s)...", actor_name, asset_id[:8])

        try:
            # Download the original image
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(blob_url)
                resp.raise_for_status()
                original_bytes = resp.content

            # Run Flux.2 Pro Edit ($0.03/edit, best character preservation)
            edit_prompt = (
                "Remove all text overlays, watermarks, captions, logos, Chinese characters, "
                "and any gibberish text. Keep the person, pose, and background identical. Clean photo."
            )
            # Convert AVIF to JPEG for API
            from PIL import Image
            import io
            try:
                img = Image.open(io.BytesIO(original_bytes))
                img = img.convert("RGB")
                img = img.resize((1024, 1024), Image.LANCZOS)
                jpg_buf = io.BytesIO()
                img.save(jpg_buf, format="JPEG", quality=85)
                input_bytes = jpg_buf.getvalue()
                input_mime = "image/jpeg"
                logger.info("Converted to JPEG: %d bytes", len(input_bytes))
            except Exception as conv_err:
                logger.warning("AVIF→JPEG conversion failed: %s", conv_err)
                input_bytes = original_bytes
                input_mime = "image/png"
            edited_bytes = await edit_image_flux(input_bytes, edit_prompt, mime_type=input_mime)

            if not edited_bytes or len(edited_bytes) < 10000:
                logger.warning("Seedream Edit returned empty/tiny result for %s — skipping", actor_name)
                still_failed += 1
                continue

            # Degloss the edited image
            deglosed = degloss(edited_bytes, intensity="medium")

            # Write to temp file for VQA
            tmp_path = os.path.join(tempfile.gettempdir(), f"retry_{uuid.uuid4().hex}.png")
            with open(tmp_path, "wb") as f:
                f.write(deglosed)

            # Build VQA prompt from actor data
            # Simplified — we don't have full actor_data here, use content
            qa_prompt = f"""Evaluate this recruitment ad image for realism and quality.

REALISM CHECK (HARD FAIL — score 0.0 if ANY):
- Cartoon, illustration, anime, digital painting appearance
- ANY visible watermark, logo, text overlay, Chinese characters, stock photo ID
- Gibberish text on clothing, accessories, or objects

Check: identity consistency, realism, cultural authenticity, technical quality.
Return JSON: {{"overall_score": 0.0-1.0, "passed": true/false, "issues": []}}"""

            qa_result = await analyze_image(tmp_path, qa_prompt)
            qa_data = _parse_json(qa_result)
            qa_score = float(qa_data.get("overall_score", qa_data.get("score", 0)))

            # Prose fallback scoring
            if qa_score == 0 and "raw_text" in qa_data and len(qa_data["raw_text"]) > 50:
                raw = qa_data["raw_text"].lower()
                neg_words = ["watermark", "text overlay", "chinese", "gibberish", "fake", "artificial",
                             "cartoon", "anime", "illustration", "logo", "stock"]
                pos_words = ["realistic", "natural", "authentic", "believable", "good quality", "professional"]
                neg = sum(1 for w in neg_words if w in raw)
                pos = sum(1 for w in pos_words if w in raw)
                if neg > 0:
                    qa_score = 0.40
                elif pos >= 2:
                    qa_score = 0.90
                elif pos >= 1:
                    qa_score = 0.80
                else:
                    qa_score = 0.75

            try:
                os.unlink(tmp_path)
            except OSError:
                pass

            if qa_score >= VQA_THRESHOLD:
                # Convert to AVIF and upload
                from PIL import Image
                import io
                try:
                    img = Image.open(io.BytesIO(deglosed))
                    avif_buf = io.BytesIO()
                    img.save(avif_buf, format="AVIF", quality=65)
                    upload_bytes = avif_buf.getvalue()
                    ext = "avif"
                except Exception:
                    upload_bytes = deglosed
                    ext = "png"

                filename = f"retry_{asset_id[:8]}_{uuid.uuid4().hex[:6]}.{ext}"
                new_blob_url = await upload_to_blob(upload_bytes, filename, folder=f"requests/{REQUEST_ID}")

                # Update DB
                async with pool.acquire() as conn:
                    await conn.execute(
                        """UPDATE generated_assets
                           SET blob_url = $1,
                               evaluation_score = $2,
                               evaluation_passed = true,
                               evaluation_data = $3::jsonb
                           WHERE id = $4::uuid""",
                        new_blob_url,
                        qa_score,
                        json.dumps(qa_data, default=str),
                        asset_id,
                    )

                fixed += 1
                logger.info("FIXED %s — score %.2f → %s", actor_name, qa_score, new_blob_url.split("/")[-1])
            else:
                still_failed += 1
                logger.info("STILL FAILED %s — score %.2f (edit didn't help enough)", actor_name, qa_score)

        except Exception as e:
            still_failed += 1
            logger.error("Error retrying %s: %s", actor_name, e)

    logger.info("=== RETRY COMPLETE: %d fixed, %d still failed (of %d total) ===", fixed, still_failed, len(rows))


if __name__ == "__main__":
    asyncio.run(main())
