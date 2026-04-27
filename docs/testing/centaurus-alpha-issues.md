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

## Stage 3: Copy Generation (cont.)

### Issue 14: Copy scores averaging 0.58-0.69 — missing conversion science context
- **Severity:** HIGH
- **What happened:** Stage 3 copy quality scores consistently land 20-30% below the 0.85 PASS_THRESHOLD. Most copy technically fails but gets saved anyway after max retries.
- **Root cause:** The full conversion science context (CONVERSION_SCIENCE constant, copy benchmarks, words-that-convert) only lives in Stage 4's `creative_overlay.py`. Stage 3's `recruitment_copy.py` builds prompts without this context — Gemma 27B doesn't know what "good" looks like.
- **Fix:** Inject the CONVERSION_SCIENCE rules + COPY_BENCHMARKS from `creative_overlay.py` into `build_variation_prompts()` in `recruitment_copy.py`. The model needs the same conversion playbook that Stage 4 uses.
- **Impact:** Copy reads as generic recruitment boilerplate instead of high-converting ad copy. Downstream, Stage 4 compositions inherit weak headlines.

### Issue 15: Pillar confusion penalty too soft (-0.05)
- **Severity:** MEDIUM
- **What happened:** Copy scored for "earn" pillar can still pass VQA even when "grow" or "shape" signals dominate. The -0.05 penalty for pillar confusion is negligible against a 0.85 threshold.
- **Root cause:** `_score_copy_quality()` detects pillar confusion via PILLAR_SIGNALS dict but only applies -0.05 penalty. A copy piece with 4 "grow" signals and 1 "earn" signal still scores high enough on other criteria to pass.
- **Fix:** Increase pillar confusion penalty to -0.15, or auto-fail if non-target pillar has 2x+ the signal count of the target pillar.
- **Impact:** Recruiter gets "earn" copy that reads like "grow" copy — confuses the messaging angle per audience segment.

### Issue 16: Cultural research truncated at 2000 chars
- **Severity:** MEDIUM
- **What happened:** Per-region cultural research blocks (AI fatigue, gig perception, economic context, trust signals) get hard-truncated at 2000 chars before injection into copy prompts.
- **Root cause:** Token budget management in `build_variation_prompts()` — defensive truncation to avoid blowing context window.
- **Fix:** Increase to 3500 chars, or switch to structured key-value extraction (top 5 cultural signals per region) instead of prose truncation. The most actionable insights (local payment methods, trust anchors, competitor landscape) are often in the second half of the research block.
- **Impact:** Copy for Brazil mentions Payoneer but misses that Pix is the dominant payment rail. Copy for Morocco misses French-language nuance.

### Issue 17: No per-persona pillar filtering
- **Severity:** LOW
- **What happened:** All 3 pillar variations (earn/grow/shape) generated for every persona even when `pillar_weighting` says one pillar is near-zero (e.g., `{"earn": 0.7, "grow": 0.25, "shape": 0.05}`).
- **Root cause:** `build_variation_prompts()` iterates all 3 pillars unconditionally. The weighting data is logged but not used to skip low-weight pillars.
- **Fix:** Skip pillar generation when weight < 0.10. For `{"earn": 0.7, "grow": 0.25, "shape": 0.05}`, only generate earn + grow variations. Saves 33% API calls and avoids low-quality forced-fit copy.
- **Impact:** Wasted NIM calls + weak copy for pillars that don't fit the campaign type.

### Issue 18: No quality-based copy ranking for Stage 4 consumption
- **Severity:** MEDIUM
- **What happened:** Stage 4's `_build_copy_lookup()` picks copy by platform match, not by quality score. If a 0.62-scored copy exists for the exact pillar+platform, it wins over a 0.84-scored copy tagged as "global".
- **Root cause:** Copy lookup is keyed by `[pillar][platform]` — first match wins, no score comparison.
- **Fix:** When building copy_lookup, if multiple candidates exist for the same pillar+platform slot, keep the highest-scoring one. Add `vqa_score` or `copy_score` to the asset metadata in Stage 3 saves.
- **Impact:** Stage 4 compositions sometimes use the worst copy variant instead of the best one.

---

## Stage 4: Composition (cont.)

### Issue 19: Gold money highlight color violates brand
- **Severity:** MEDIUM
- **What happened:** `compositor.py` line ~290 uses `brand.get("money_color", "#FFD700")` — gold/yellow default. OneForma brand rules explicitly prohibit gold/yellow. Money highlights should use sapphire or pink from the brand palette.
- **Root cause:** Hardcoded default from VYRA copy, never updated for OneForma brand.
- **Fix:** Change default to `"#237DFB"` (sapphire 60%) or better, reference `oneforma.py` brand colors directly. Add brand color validation to compositor init.
- **Impact:** Composed creatives have off-brand gold "$45/hr" highlights that clash with the purple/pink design system.

### Issue 20: Grain overlay opacity wrong (0.015 vs 0.004)
- **Severity:** MEDIUM
- **What happened:** `compositor.py` line ~349 hardcodes noise grain at `opacity: 0.015` (1.5%). Steven's feedback explicitly set grain_intensity to 0.004 (0.4%) — "barely visible."
- **Root cause:** Deglosser settings weren't updated after the Stage 4 v2 feedback round.
- **Fix:** Change `opacity:0.015` to `opacity:0.004` in compositor.py grain overlay. Also audit vintage/chromatic aberration settings — feedback said "SUPER subtle."
- **Impact:** Creatives look over-processed with visible film grain. Deglosser should be invisible at normal viewing distance.

### Issue 21: "Powered by Centific" hardcoded in v1 compose
- **Severity:** LOW
- **What happened:** `stage4_compose.py` line ~172 has `"proof_badge": "Powered by Centific"`. Should reference OneForma brand, not internal parent company name.
- **Root cause:** Never updated from initial scaffold. v3 may not use this path, but v1 is still importable/fallback.
- **Fix:** Replace with dynamic brand reference from `oneforma.py`, or hardcode "OneForma" if brand source isn't wired.
- **Impact:** If v1 code path ever triggers, creatives show wrong brand name.

### Issue 22: Social proof metric hardcoded
- **Severity:** LOW
- **What happened:** `stage4_compose.py` line ~179 has `"metric_claim": "50,000+ contributors worldwide"`. This should come from brief data or brand config, not be baked into pipeline code.
- **Root cause:** Quick scaffold, never parameterized.
- **Fix:** Pull from `oneforma.py` brand constants or brief metadata. OneForma claims 500K+ contributors on their website — the hardcoded number is 10x too low.
- **Impact:** Stale/incorrect social proof undermines credibility.

### Issue 23: Device mockup (task contextualizer) fails silently
- **Severity:** MEDIUM
- **What happened:** `generate_task_contextualizer()` can fail without blocking composition. GLM-5 composes without device mockup context, reducing the "task clarity" VQA dimension score.
- **Root cause:** Task contextualizer is wrapped in try/except with fallback to None. No retry, no warning surfaced to VQA.
- **Fix:** If contextualizer fails, inject a flag into VQA context so it doesn't penalize missing device mockup (it wasn't available, not omitted). Alternatively, add 1 retry with backoff.
- **Impact:** VQA scores task context dimension poorly when the input data wasn't there to begin with — false quality signal.

### Issue 24: No layout diversity enforcement across batch
- **Severity:** MEDIUM
- **What happened:** GLM-5 can select the same archetype (e.g., gradient_hero) for all 3 creatives in a persona batch. No variety check.
- **Root cause:** Each composition task runs independently via semaphore — no cross-task coordination on archetype selection.
- **Fix:** Pre-assign archetypes before dispatching: if 3 creatives per persona, force 1× floating_props + 1× gradient_hero + 1× photo_feature. Pass the assignment into the compositor prompt.
- **Impact:** Miguel sees 3 identical-looking creatives with different copy. Defeats the purpose of multiple variations.

### Issue 25: No competitive reference injection
- **Severity:** LOW
- **What happened:** GLM-5 generates HTML creatives without seeing what top-performing recruitment/gig economy ads actually look like.
- **Root cause:** No reference injection pipeline. The model works from artifact catalog + archetype rules + brand constraints, but never sees real-world benchmarks.
- **Fix:** Scrape Facebook Ads Library for top performers in recruitment/gig categories. Inject 3-5 screenshot URLs or HTML snippets as "visual benchmarks" in the compositor prompt.
- **Impact:** Creatives feel "AI-designed" rather than "agency-designed." Missing the competitive visual vocabulary.

### Issue 26: GLM-5.1 response truncation / empty content
- **Severity:** CRITICAL
- **What happened:** Active debugging (uncommitted change in `stage4_compose_v3.py`) shows GLM-5.1 via OpenRouter sometimes returns `None` content, truncated HTML, or malformed JSON. `finish_reason` logging added to diagnose whether responses hit token limit (`length`) or complete normally (`stop`).
- **Root cause:** Likely a combination of: (a) OpenRouter rate limiting, (b) GLM-5.1 max_tokens too low for complex HTML output, (c) model context window overflow from large artifact catalogs.
- **Fix:** Check `max_tokens` setting (currently 16384 from earlier fix). If `finish_reason == "length"`, increase. If content is None, implement retry with smaller prompt (fewer artifacts). Add structured error classification before retry.
- **Impact:** CRITICAL — this is Issue 13's cousin. Even with paid OpenRouter, responses fail or truncate, producing 0 compositions.

### Issue 27: Channel name deduplication (Stage 3 → Stage 4 mismatch)
- **Severity:** MEDIUM
- **What happened:** Stage 3 saves copy with Title Case platform names ("Facebook Feed", "Instagram Stories"). Stage 4 uses snake_case keys ("facebook_feed", "ig_story"). The `toChannel()` normalizer exists in frontend but the backend copy lookup can miss matches.
- **Root cause:** No canonical normalization at the copy_asset save layer. Stage 3's `build_variation_prompts()` uses human-readable channel names; Stage 4's `CHANNEL_TO_PLATFORM` dict expects lowercase.
- **Fix:** Normalize platform names to snake_case at Stage 3 save time (in `stage3_copy.py`), or add case-insensitive + alias matching in `_build_copy_lookup()` in v3.
- **Impact:** Stage 4 falls through the copy lookup chain and grabs wrong-platform or global fallback copy instead of the exact match.

### Issue 28: Actor count limited to 2 per persona
- **Severity:** LOW
- **What happened:** Stage 4 v2 has `ranked_actors[:2]` — only top 2 actors composed per persona. Steven wants 3.
- **Root cause:** Hardcoded slice in v2. v3 may have same limit — needs verification.
- **Fix:** Change to `[:3]` in both v2 and v3. Check `run_stage4()` in `stage4_compose_v3.py` for actor selection logic.
- **Impact:** Fewer creative variations per persona for Miguel to choose from.

---

## Priority Order for Fixes

### P0 — Blocks pipeline output / Miguel approval
1. **Issue 13:** GLM-5 NIM rate limit — 0 compositions rendered (TOTAL BLOCKER)
2. **Issue 26:** GLM-5.1 response truncation / empty content via OpenRouter (active debugging)
3. **Issue 8:** AI feel in images (Seedream prompt + deglosser tuning)
4. **Issue 7:** Facial artifact detection (VQA prompt update)
5. **Issue 12:** Stage 3 missing diamond persona brief — drift between copy and LP/composition
6. **Issue 14:** Copy scores 0.58-0.69, missing conversion science context

### P1 — Blocks full pipeline quality
7. **Issue 1:** Job posting URL not saved (UUID string cast)
8. **Issue 2:** Yoast SEO meta not set (add meta fields)
9. **Issue 9:** VQA JSON parsing (stricter VLM prompt)
10. **Issue 18:** No quality-based copy ranking — Stage 4 uses worst copy instead of best
11. **Issue 27:** Channel name deduplication — Stage 3/4 platform key mismatch
12. **Issue 24:** No layout diversity enforcement — same archetype repeated across batch
13. **Issue 15:** Pillar confusion penalty too soft (-0.05)

### P2 — Quality & polish
14. **Issue 19:** Gold money highlight violates brand (#FFD700 → sapphire/pink)
15. **Issue 20:** Grain opacity wrong (0.015 → 0.004)
16. **Issue 16:** Cultural research truncated at 2000 chars
17. **Issue 23:** Task contextualizer fails silently
18. **Issue 5:** Brand voice gate too strict (evaluator tuning)
19. **Issue 3:** Job Tags taxonomy 404 (REST base discovery)
20. **Issue 10:** Pass rate improvement (follows from Issue 9 fix)

### P3 — Nice to have
21. **Issue 17:** No per-persona pillar filtering (skip low-weight pillars)
22. **Issue 25:** No competitive reference injection
23. **Issue 28:** Actor count limited to 2 per persona (want 3)
24. **Issue 21:** "Powered by Centific" hardcoded in v1
25. **Issue 22:** Social proof metric hardcoded (50K vs actual 500K+)
26. **Issue 6:** Strategy eval thresholds
27. **Issue 4:** Job Types taxonomy
28. **Issue 11:** NIM 500 retry logic

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
