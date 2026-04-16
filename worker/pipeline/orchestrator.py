"""Pipeline orchestrator -- runs stages 1-6 sequentially.

Handles full generation and single-stage regeneration. Each stage
receives a shared *context* dict that accumulates results. On failure
the request is returned to 'draft' status and Teams is notified.
"""
from __future__ import annotations

import logging

from neon_client import get_actors, update_request_status
from teams_notify import notify_generation_complete, notify_generation_failed

from pipeline.stage1_intelligence import run_stage1
from pipeline.stage2_images import run_stage2
from pipeline.stage3_copy import run_stage3
from pipeline.stage4_compose_v3 import run_stage4
from pipeline.stage4_organic_carousel import run_organic_carousels
from pipeline.stage5_video import run_stage5 as run_video_stage
from pipeline.stage6_landing_pages import run_stage6

logger = logging.getLogger(__name__)


async def run_pipeline(job: dict) -> None:
    """Run the full Creative OS pipeline for a compute job.

    Parameters
    ----------
    job:
        A dict from ``fetch_pending_jobs`` containing at minimum
        ``request_id``, ``job_type``, and optionally ``stage_target``
        and ``feedback``.
    """
    request_id: str = job["request_id"]
    job_type: str = job["job_type"]
    stage_target = job.get("stage_target")
    feedback = job.get("feedback")

    # ── Campaign Splitter: check if multinational RFP needs splitting ──
    # If 3+ countries, split into per-country child campaigns.
    # Each child gets its own pipeline run with city-level targeting.
    if job_type == "generate":
        from neon_client import get_intake_request as _get_request

        from pipeline.campaign_splitter import should_split, split_campaign
        request = await _get_request(request_id)
        if await should_split(request):
            logger.info("Multinational campaign detected — splitting into per-country campaigns")
            children = await split_campaign(request, request_id)
            logger.info(
                "Split complete: %d child campaigns. Parent job done. "
                "Children will be picked up on next poll cycle.",
                len(children),
            )
            # Mark parent job as complete (children are independent jobs)
            return

    stages = [
        (1, "Strategic Intelligence", run_stage1),
        (2, "Character-Driven Image Generation", run_stage2),
        (3, "Copy Generation", run_stage3),
        (4, "Layout Composition", run_stage4),
        (5, "Video Generation", run_video_stage),
        (6, "Landing Page Generation", run_stage6),
    ]

    # If regenerating a specific stage, only run that one.
    if job_type == "regenerate_stage" and stage_target is not None:
        target = int(stage_target)
        stages = [(n, name, fn) for n, name, fn in stages if n == target]

    # If resuming from a stage, run that stage through the end.
    if job_type == "resume_from" and stage_target is not None:
        target = int(stage_target)
        stages = [(n, name, fn) for n, name, fn in stages if n >= target]
        logger.info("Resuming pipeline from Stage %d (stages %s)", target, [n for n, _, _ in stages])

    context: dict = {
        "request_id": request_id,
        "feedback": feedback,
    }

    # ── Load brief + request data from Neon ──────────────────────
    # Always load if starting at stage > 1 (resume, regenerate, or auto-skip)
    first_stage = stages[0][0] if stages else 1
    if first_stage >= 1:
        try:
            from neon_client import get_brief, get_intake_request
            existing_brief = await get_brief(request_id)
            if existing_brief:
                import json
                brief_data = existing_brief.get("brief_data")
                if isinstance(brief_data, str):
                    brief_data = json.loads(brief_data)
                if brief_data and "campaign_objective" in brief_data:
                    request = await get_intake_request(request_id)
                    context.update({
                        "request_title": request.get("title", "Untitled"),
                        "brief": brief_data,
                        "personas": brief_data.get("personas", []),
                        "cultural_research": brief_data.get("cultural_research", {}),
                        "design_direction": existing_brief.get("design_direction", {}),
                        "target_languages": request.get("target_languages", []),
                        "target_regions": request.get("target_regions", []),
                        "form_data": request.get("form_data", {}),
                    })
                    if first_stage == 1:
                        logger.info("SKIPPING Stage 1 — brief already exists in Neon (campaign: %s)", brief_data.get("campaign_objective", "")[:80])
                        stages = [(n, name, fn) for n, name, fn in stages if n > 1]
                    else:
                        logger.info("Loaded brief from Neon for resume/regen (campaign: %s)", brief_data.get("campaign_objective", "")[:80])
        except Exception as e:
            logger.info("Could not check for existing brief: %s — continuing with empty brief", e)

    for stage_num, stage_name, stage_fn in stages:
        logger.info("Running Stage %d: %s", stage_num, stage_name)

        # Stages 4+ need actors in context — load from Neon if not already present
        if stage_num >= 4 and "actors" not in context:
            try:
                actors = await get_actors(request_id)
                context["actors"] = actors
                logger.info("Loaded %d actors from Neon for stage %d", len(actors), stage_num)
            except Exception as e:
                logger.warning("Could not load actors: %s", e)
                context["actors"] = []

        try:
            result = await stage_fn(context)
            context.update(result)  # each stage can pass data to the next
            logger.info("Stage %d passed.", stage_num)

            # After Stage 4: generate organic carousels (LinkedIn + IG)
            if stage_num == 4:
                try:
                    logger.info("Generating organic carousels...")
                    organic_result = await run_organic_carousels(context)
                    context.update(organic_result)
                    logger.info(
                        "Organic carousels: %d generated",
                        organic_result.get("organic_carousel_count", 0),
                    )
                except Exception as org_exc:
                    logger.warning("Organic carousel generation failed (non-fatal): %s", org_exc)

        except Exception as exc:
            logger.error("Stage %d failed: %s", stage_num, exc, exc_info=True)
            await update_request_status(request_id, "draft")
            await notify_generation_failed(
                context.get("request_title", "Unknown"),
                str(exc),
            )
            raise

    # All stages passed.
    await update_request_status(request_id, "review")
    await notify_generation_complete(
        context.get("request_title", "Unknown"),
        context.get("asset_count", 0),
        request_id,
    )
