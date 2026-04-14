# Centaurus-Alpha Test Run — Issues Log

**Campaign:** Centaurus-Alpha (Canada, selfie video data collection)
**Run Date:** 2026-04-14
**Request ID:** 11c02668-7934-40f7-b611-72d80f96efba

---

## Stage 0: WordPress Auto-Publish

### Issue 1: Job posting URL not saved to Neon
- **Severity:** HIGH
- **What happened:** WP draft created successfully (ID: 178068, URL captured) but `upsert_campaign_landing_page` threw `'asyncpg.pgproto.pgproto.UUID' object is not subscriptable`
- **Root cause:** The `request_id` being passed is an asyncpg UUID object, not a string. Need to cast with `str(request_id)`.
- **Fix:** In `wp_job_publisher.py`, ensure `request_id` is cast to `str()` before passing to neon_client.
- **Impact:** Recruiter Link Builder won't auto-populate with the WP URL.

### Issue 2: Yoast SEO meta not set
- **Severity:** MEDIUM
- **What happened:** WP post created without Yoast SEO meta title or meta description. The JD copy prompt generates `seo_title` and `seo_description` but they're not being passed to the WP REST API.
- **Root cause:** `wp_rest_client.py` doesn't pass Yoast meta fields (`_yoast_wpseo_title`, `_yoast_wpseo_metadesc`) in the `meta` dict.
- **Fix:** Add Yoast fields to the meta payload in `wp_job_publisher.py`:
  ```python
  meta["_yoast_wpseo_title"] = jd_data.get("seo_title", title)
  meta["_yoast_wpseo_metadesc"] = jd_data.get("seo_description", "")
  ```
- **Impact:** WP post has "Needs improvement" SEO status instead of green.

### Issue 3: Job Tags taxonomy 404
- **Severity:** LOW
- **What happened:** `job_tags` REST endpoint returned 404 when trying to set/create taxonomy terms.
- **Root cause:** Custom taxonomy REST base might not be `job_tags` — could be `job-tags`, `job_tag`, or a custom slug. Need to check WP REST API discovery.
- **Fix:** Query `GET /wp-json/wp/v2/taxonomies` to discover the correct REST base for the Job Tags taxonomy.
- **Impact:** Posts created without tag categories (compensation type, location).

### Issue 4: Job Types taxonomy not attempted
- **Severity:** LOW
- **What happened:** Similar to Job Tags — the taxonomy endpoint may not match expected REST base.
- **Fix:** Same as Issue 3 — discover correct REST base.

---

## Stage 1: Strategic Intelligence

### Issue 5: Brand voice compliance gate too strict
- **Severity:** MEDIUM
- **What happened:** Brief rejected 3 times on `brand_voice_compliance` (scored 2/7 repeatedly) despite the actual content being high quality. Final brief accepted after max retries.
- **Root cause:** The evaluator's brand voice expectations may not align with data collection project types. The evaluator might be expecting consumer marketing voice when this is a recruitment/contributor project.
- **Fix:** Tune `eval_brief.py` — either lower the gate threshold for brand_voice from 7 to 5, or add project-type context to the evaluator prompt so it knows OneForma's recruitment voice is different from consumer brand voice.
- **Impact:** Stage 1 takes 28 min instead of ~15 min due to 3 retry cycles.

### Issue 6: Strategy evaluation also strict
- **Severity:** LOW
- **What happened:** Campaign strategy scored 0.78 after 3 attempts (threshold was higher). Saved anyway after max retries.
- **Fix:** Review strategy evaluator thresholds for data collection projects.
- **Impact:** Minor — strategy still saved and used.

---

## Stage 2: Image Generation

### Issue 7: Facial artifact (forehead scar)
- **Severity:** HIGH
- **What happened:** One actor image has a visible scar/wound artifact on the forehead. VQA didn't catch it — scored 0.80 (above threshold).
- **Root cause:** VQA prompt doesn't explicitly check for facial blemish/scar/wound artifacts. It checks for "face quality" generally but misses specific artifact types.
- **Fix:** Add to VQA prompt: "Check for facial artifacts: scars, wounds, blemishes, extra fingers, distorted features, asymmetrical eyes, unnatural skin texture."
- **Impact:** Miguel will reject this image immediately.

### Issue 8: Images still have "AI feel"
- **Severity:** HIGH
- **What happened:** Passing images (0.80-0.95 scores) still look AI-generated — too smooth, too perfect lighting, slightly uncanny skin texture.
- **Root cause:** Deglosser running at heavy/medium intensity but not enough to break the AI-sheen. Seedream 4.5 tends to produce overly polished outputs.
- **Fix options:**
  1. Strengthen Seedream negative prompt: add "airbrushed, overly smooth skin, perfect lighting, studio quality, CGI, 3D render, digital art"
  2. Add "heavy+" deglosser mode with additional grain, micro-texture, and subtle color grading
  3. Add a "realism pass" using Flux 2 specifically to add imperfections (pores, hair flyaways, uneven lighting)
- **Impact:** This is the #1 blocker for Miguel approval. Images must look like real photos, not AI renders.

### Issue 9: VQA JSON parsing failures
- **Severity:** MEDIUM
- **What happened:** VLM (Qwen3-VL / OpenRouter) returns prose analysis instead of structured JSON. Parser fails, falls back to negative signal counting from prose (counts words like "artifact", "unrealistic").
- **Root cause:** VLM prompt doesn't enforce JSON output strictly enough. The model writes an essay instead of structured evaluation.
- **Fix:** Add to VLM prompt: "OUTPUT ONLY VALID JSON. No commentary, no explanation, no markdown. Start with { and end with }."
- **Impact:** VQA scores are less reliable (0.40 fallback vs actual structured scoring). Some good images might get rejected, some bad ones might pass.

### Issue 10: 58% pass rate
- **Severity:** MEDIUM
- **What happened:** 11 of 19 images passed VQA (58%). 8 images generated but rejected.
- **Root cause:** Combination of VQA JSON parsing issues (false 0.40 scores) and genuine quality issues.
- **Fix:** Fix VQA JSON parsing (Issue 9) — this will likely improve pass rate to 70-80% since some 0.40 scores are parse failures, not actual quality failures.
- **Impact:** Wasted API calls and generation time on images that get rejected.

---

## Stage 3: Copy Generation

### Issue 11: NIM Gemma 27B intermittent 500 errors
- **Severity:** LOW (fallback works)
- **What happened:** Gemma 3 27B on NIM returns 500 Internal Server Error intermittently. Fallback to Kimi K2.5 on NIM catches it.
- **Root cause:** NIM free tier rate limiting or server-side issues.
- **Fix:** Already handled by fallback chain. Consider adding exponential backoff retry before falling back.
- **Impact:** Minor — copy still generates, just uses fallback model.

---

## Stage 4: Composition

### Issue 13: GLM-5 NIM rate limit — 0 compositions rendered
- **Severity:** CRITICAL
- **What happened:** 36 NIM calls to GLM-5 failed, 0 composed creatives generated. Every composition attempt returned empty — no HTML, no renders, no uploads.
- **Root cause:** NVIDIA NIM free tier rate limits on GLM-5 (`z-ai/glm5`). After Stage 1-3 consumed API quota with Qwen 3.5 and Gemma 4 calls, GLM-5 had no capacity left.
- **Fix options:**
  1. **Stagger NIM key rotation** — use different keys for different stages (key pool already exists in `.keys.json`)
  2. **Add retry with exponential backoff** — wait 30-60s between retries instead of immediate retry
  3. **Fallback to Kimi K2.5 for HTML generation** — Kimi can generate HTML/CSS (less specialized than GLM-5 but functional)
  4. **Queue compositions** — rate-limit to 2-3 NIM calls per minute instead of bursting
- **Impact:** TOTAL BLOCKER — no creatives generated. Pipeline produces personas, copy, and images but nothing to show Miguel.

---

## Stage 3: Copy Generation (cont.)

### Issue 12: Stage 3 NOT using diamond persona mini brief — DRIFT RISK
- **Severity:** HIGH
- **What happened:** Stage 3 uses `build_variation_prompts()` from `recruitment_copy.py` which builds its own inline persona context. It does NOT call `build_project_context()` from `prompts/project_context.py` — the diamond mini brief that Stages 4 and 6 use.
- **Root cause:** Stage 3 was built before the layered context system (design_base_knowledge + project_context) was introduced. It was never retrofitted.
- **Fix:** Inject `build_project_context()` output into `build_variation_prompts()` as an additional context block. This ensures Stage 3 copy is grounded in the same diamond brief as Stage 4 compositions and Stage 6 landing pages.
- **Impact:** Copy may drift from the persona psychology, cultural research, and job requirements that Stages 4 and 6 are using. The ad copy says one thing, the landing page says another. This is a consistency issue across the funnel.

---

## Priority Order for Fixes

### P0 — Blocks Miguel approval / causes drift
1. **Issue 8:** AI feel in images (Seedream prompt + deglosser tuning)
2. **Issue 7:** Facial artifact detection (VQA prompt update)
3. **Issue 12:** Stage 3 missing diamond persona brief — drift between copy and LP/composition

### P1 — Blocks full pipeline functionality
4. **Issue 1:** Job posting URL not saved (UUID string cast)
5. **Issue 2:** Yoast SEO meta not set (add meta fields)
6. **Issue 9:** VQA JSON parsing (stricter VLM prompt)

### P2 — Quality improvements
6. **Issue 5:** Brand voice gate too strict (evaluator tuning)
7. **Issue 3:** Job Tags taxonomy 404 (REST base discovery)
8. **Issue 10:** Pass rate improvement (follows from Issue 9 fix)
9. **Issue 6:** Strategy eval thresholds
10. **Issue 4:** Job Types taxonomy
11. **Issue 11:** NIM 500 retry logic

---

## Timeline

| Stage | Started | Completed | Duration |
|---|---|---|---|
| Stage 0: WP Publish | 09:30:14 | 09:30:55 | 41s |
| Stage 1: Intelligence | 09:30:14 | 09:58:01 | 28 min |
| Stage 2: Images | 09:58:01 | 10:16:03 | 18 min |
| Stage 3: Copy | 10:16:03 | running... | — |
| Stage 4: Composition | — | — | — |
| Stage 5: Video | — | — | — |
| Stage 6: Landing Pages | — | — | — |
| **Total** | 09:30:14 | — | **~46 min so far** |
