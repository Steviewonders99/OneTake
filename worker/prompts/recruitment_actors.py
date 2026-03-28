"""Recruitment-specific prompts for actor/character generation (Stage 2).

Actors are fictional but culturally authentic contributors used in
recruitment ads. They should look like real people you would see on a
bus or in a coffee shop — NOT corporate stock photos.

Every image prompt includes the 10 REALISM ANCHORS to ensure Seedream
generates UGC-style photography, not polished studio shots.
"""
from __future__ import annotations

ACTOR_SYSTEM_PROMPT = (
    "You are a casting director for OneForma recruitment ads. You create "
    "fictional but culturally authentic contributor personas for specific "
    "regions. Each actor should feel like a REAL person — someone you would "
    "meet at a coffee shop, library, or co-working space. They are NOT "
    "corporate employees, models, or stock photo subjects."
)

# ---------------------------------------------------------------------------
# The 10 Realism Anchors
# ---------------------------------------------------------------------------
# These are appended to every Seedream image prompt to ensure the generated
# images look like authentic UGC (user-generated content) rather than
# polished studio photography.

REALISM_ANCHORS = [
    "Shot on iPhone 15 Pro, natural lighting, no studio setup, slight camera sensor grain visible",
    "Slight asymmetry in facial features — real face, not AI-perfected, not symmetrical",
    "SKIN TEXTURE IS CRITICAL: visible pores on nose and forehead, slight under-eye shadows, natural skin roughness — NOT smooth, NOT airbrushed, NOT glossy. Real skin has micro-bumps, tiny imperfections, slight oiliness on T-zone, visible follicles",
    "Hair with natural flyaways, baby hairs at temples catching backlight, not salon-styled",
    "Clothing with visible FABRIC TEXTURE: weave pattern, slight pilling, natural wrinkles at elbow/waist bends, not freshly pressed or digitally smooth",
    "Environment with lived-in details: coffee cup with slight stain, notebooks with bent corners, phone charger cable, sticky notes, real clutter",
    "Natural body posture — slightly leaning, weight on one side, relaxed, not model-posed or AI-stiff",
    "Ambient background blur (shallow depth of field, f/1.8) with slight chromatic aberration at edges",
    "Mixed color temperature lighting: warm lamp + cool window = slight color cast variation across the frame, not uniform color",
    "Candid expression — mid-conversation or focused concentration, real muscle tension in face, not AI-smooth plastic expression",
]

# Anti-gloss prompt addition — appended to every Seedream prompt
ANTI_GLOSS_INSTRUCTION = """
ANTI-AI-GLOSS — SUBJECT (the person MUST NOT look AI-generated):
- NO smooth plastic skin. Visible pores, micro-bumps, T-zone oiliness, under-eye texture.
- NO perfect hair. Flyaways, baby hairs, natural frizz, texture visible.
- NO pristine clothing. Wrinkles at elbows/waist, fabric weave visible, slight wear/pilling.
- NO uniform lighting on face. Mixed warm/cool sources = slight shadows under chin, nose shadow.
- NO oversaturation. Slightly muted like real iPhone — not AI-vibrant.
- Film grain from camera sensor. Not clean digital — slight noise especially in shadows.

ANTI-AI-GLOSS — BACKGROUND & ENVIRONMENT (just as important as the person):
- WALLS: Must have texture — paint brush strokes, slight scuff marks, nail holes, light switch plates, power outlets visible. NOT smooth gradients. Real walls have imperfections.
- FURNITURE: Visible wood grain on tables/desks, slight scratches, ring marks from cups, wear on chair edges. NOT pristine showroom furniture.
- FLOORS: Visible tile grout, carpet texture/flattening, slight dust in corners, scuff marks. NOT perfectly clean.
- SURFACES: Real items have shadows and dust. Laptop has fingerprints on screen edge. Phone has a case with slight wear. Coffee cup has a drip stain.
- LIGHTING ON ENVIRONMENT: Different color temperature on different surfaces — warm lamp on desk, cool daylight on wall near window. Hard shadows from objects (not soft AI ambient).
- WINDOW: If visible, slight overexposure (blown highlights), curtain/blind with uneven folds, real view outside (not AI-gradient sky).
- CLUTTER: Real spaces have clutter — visible wires, a charger cable, a water bottle, sticky notes, an open notebook, crumbs, a pen. NOT minimalist showroom.
- DEPTH: Background objects should be at different distances — some sharp, some blurred. Not everything at the same focal plane.
- Slight lens vignette at corners (real lenses darken at edges).
"""

REALISM_ANCHORS_TEXT = "\n".join(f"  {i+1}. {a}" for i, a in enumerate(REALISM_ANCHORS))

# Region-specific setting suggestions for authentic backgrounds.
REGION_SETTINGS: dict[str, list[str]] = {
    "Latin America": [
        "bright kitchen with tiled walls",
        "small home office with plant on desk",
        "outdoor balcony with city view",
        "local coffee shop with wooden tables",
    ],
    "Southeast Asia": [
        "small apartment desk near window with fan",
        "co-working space with tropical plants",
        "balcony overlooking green neighbourhood",
        "university library corner",
    ],
    "Eastern Europe": [
        "compact apartment with bookshelves",
        "kitchen table with tea and laptop",
        "co-working space in renovated building",
        "park bench with autumn leaves",
    ],
    "South Asia": [
        "home desk with chai cup and phone",
        "rooftop workspace at golden hour",
        "small room with colourful textiles visible",
        "university campus common area",
    ],
    "Africa": [
        "bright room with patterned curtains",
        "shared workspace with concrete walls",
        "outdoor seating under shade tree",
        "small business centre table",
    ],
    "Middle East": [
        "modern apartment study corner",
        "coffee shop with Arabic calligraphy decor",
        "home office with warm wood tones",
        "university common room",
    ],
    "CIS": [
        "apartment kitchen with tiled backsplash",
        "home desk near radiator and window",
        "co-working space with exposed brick",
        "cafe table with winter light through glass",
    ],
    "East Asia": [
        "compact desk in tidy apartment",
        "convenience store cafe corner",
        "library carrel with stacked books",
        "rooftop garden workspace",
    ],
    "Global": [
        "home desk with laptop and coffee",
        "co-working space with natural light",
        "coffee shop corner table",
        "outdoor park bench with laptop",
    ],
}


def build_actor_prompt(brief: dict, region: str, language: str) -> str:
    """Build the prompt for generating an actor identity card.

    The JSON output matches the DB schema: face_lock, prompt_seed,
    outfit_variations, signature_accessory, backdrops — following
    the UGC actor system for consistent character generation across
    all ad variants.
    """
    audience = brief.get("target_audience", {})
    persona = audience.get("persona", "A multilingual freelancer looking for flexible remote work")
    profile_types = audience.get("profile_types", ["students", "freelancers"])
    settings = REGION_SETTINGS.get(region, REGION_SETTINGS["Global"])

    return f"""Create an AI UGC actor identity card for a OneForma recruitment ad campaign.

TARGET REGION: {region}
TARGET LANGUAGE: {language}
CAMPAIGN PERSONA: {persona}
PROFILE TYPES: {", ".join(profile_types)}

This actor will appear across MULTIPLE ad creatives (feed, stories, carousel panels).
Their identity must be LOCKED — same person in every image. They must feel REAL and
RELATABLE to people in {region} who speak {language}.

Return ONLY valid JSON matching this EXACT schema:
{{
  "name": "A culturally appropriate first name for {region}",
  "face_lock": {{
    "skin_tone_hex": "#HEXCOLOR (realistic skin tone for someone from {region})",
    "eye_color": "specific eye color (brown, dark brown, hazel, etc.)",
    "jawline": "face shape description (round, defined, soft oval, angular, etc.)",
    "hair": "specific hairstyle common in {region} (include color, length, texture)",
    "nose_shape": "specific description (broad bridge, delicate, straight, etc.)",
    "age_range": "e.g. 22-26",
    "distinguishing_marks": "1-2 unique features (light stubble, dimple, beauty mark, laugh lines, glasses)"
  }},
  "prompt_seed": "One dense paragraph (80-120 words) describing this EXACT person that gets pasted into EVERY Seedream generation for consistency. Include: ethnicity, age, skin tone hex, face shape, hair, eye color, distinguishing marks, default expression. This is the IDENTITY LOCK — if you generate 20 images with this seed, they should all clearly be the same person.",
  "outfit_variations": {{
    "at_home_working": "What they wear while annotating data at home (e.g., casual t-shirt, headphones on, comfortable pants)",
    "at_home_relaxed": "Relaxed version — hoodie/sweater, sitting on couch or bed with laptop",
    "cafe_working": "What they wear to a cafe to work (slightly more put-together but still casual)",
    "celebrating_earnings": "Casual outfit, looking at phone with satisfied expression — just got paid"
  }},
  "signature_accessory": "ONE item they ALWAYS have visible (over-ear headphones, wireless earbuds, specific watch, bracelet, hair clip, glasses — pick something relevant to data annotation work)",
  "backdrops": [
    "A realistic {region} home setting (kitchen table, bedroom desk, etc.)",
    "A realistic {region} cafe or public workspace",
    "A realistic {region} outdoor or balcony setting",
    "A close-up framing for story/portrait format"
  ]
}}

RULES:
- Face lock = the person's PERMANENT features. Same in every image.
- Prompt seed = the dense text that Seedream uses for EVERY generation. It's the identity.
- Outfit variations = 4 different looks for different ad contexts.
- Signature accessory = appears in EVERY image (creates recognition across ad set).
- Backdrops = 4 realistic settings from {region} (NOT generic Western settings).
- Age 18-35 (the OneForma contributor demographic).
- NO stock-photo vibes. NO corporate attire. NO model-like appearance.
- They should look like a real {language}-speaking person in {region} who does gig work from home."""


def build_image_prompt(
    actor: dict,
    outfit_key: str = "at_home_working",
    backdrop_index: int = 0,
    design: dict | None = None,
    region: str = "Global",
    image_index: int = 0,
    used_compositions: list[str] | None = None,
) -> tuple[str, str]:
    """Build the Seedream image generation prompt for an actor.

    Uses the actor's prompt_seed (identity lock) + selected outfit
    variation + backdrop + all 10 realism anchors + COMPOSITION TECHNIQUE
    selected by the composition engine based on content intent.

    Parameters
    ----------
    actor:
        The actor identity card (face_lock, prompt_seed, outfits, etc.)
    outfit_key:
        Which outfit variation to use — also determines composition intent.
    backdrop_index:
        Index into the actor's backdrops array.
    design:
        Design direction from Stage 1 (optional, for style hints).
    region:
        Target region name for context.
    image_index:
        Which image number this is (0-based) — used for composition variety.
    used_compositions:
        Compositions already used for this actor — avoids repetition.

    Returns
    -------
    tuple of (prompt_string, composition_key_used)
        The composition_key should be tracked and passed as used_compositions
        for subsequent images to ensure variety.
    """
    from prompts.composition_engine import build_composition_block

    face_lock = actor.get("face_lock", {})
    prompt_seed = actor.get("prompt_seed", "")
    outfits = actor.get("outfit_variations", {})
    outfit = outfits.get(outfit_key, outfits.get("at_home_working", "casual clothes, headphones"))
    backdrops = actor.get("backdrops", ["home office with laptop"])
    backdrop = backdrops[backdrop_index % len(backdrops)] if backdrops else "home office"
    accessory = actor.get("signature_accessory", "headphones")

    # Extract structured art direction (koda-stack-inspired)
    d = design or {}
    photo_dir = d.get("photography_direction", {})
    if isinstance(photo_dir, str):
        photo_dir = {"style": photo_dir}
    environment = d.get("environment", {})
    texture = d.get("texture", {})
    lighting = d.get("lighting", {})
    do_not = d.get("do_not", [])

    # Select composition based on content intent
    composition_block, composition_key = build_composition_block(
        intent=outfit_key,
        image_index=image_index,
        used=used_compositions,
    )

    # Build do-not block
    do_not_block = ""
    if do_not:
        do_not_block = "\nDO NOT (banned for this campaign):\n" + "\n".join(f"- {x}" for x in do_not)

    prompt = f"""{prompt_seed}

OUTFIT FOR THIS SHOT: {outfit}
SIGNATURE ACCESSORY (MUST be visible): {accessory}
BACKDROP: {backdrop}

ART DIRECTION:
- Style: {photo_dir.get("style", "UGC candid")}
- Lens: {photo_dir.get("lens", "50mm equivalent")}
- Depth of field: {photo_dir.get("depth_of_field", "shallow f/1.8")}
- Film stock: {photo_dir.get("film_stock", "iPhone 15 Pro sensor look")}
- Mood: {d.get("mood", "Approachable, authentic, opportunity-focused")}

LIGHTING:
- Type: {lighting.get("type", "Natural mixed — window daylight + warm lamp")}
- Color temperature: {lighting.get("color_temperature", "mixed warm/cool")}
- Shadows: {lighting.get("shadows", "mixed — soft from window, hard from objects")}

ENVIRONMENT TEXTURE (backgrounds must NOT look AI-generated):
- Setting: {environment.get("setting_type", backdrop)}
- Surface textures: {environment.get("surface_textures", "paint strokes on walls, wood grain on furniture, visible floor texture")}
- Lived-in details: {environment.get("lived_in_details", "charger cable, water bottle, sticky notes, open notebook, pen")}
- Light on surfaces: {environment.get("lighting_on_environment", "warm pool on desk, cool wash on wall")}

TEXTURE REQUIREMENTS:
- Skin: {texture.get("skin", "Natural pores, micro-bumps, slight oiliness — NOT airbrushed")}
- Fabric: {texture.get("fabric", "Visible weave, wrinkles at joints, slight pilling")}
- Surfaces: {texture.get("surfaces", "Wood grain, scuff marks, fingerprints on screens")}
- Film grain: {texture.get("film_grain", "Subtle sensor noise, stronger in shadows")}

FACE LOCK (these features MUST match the identity above):
- Skin tone: {face_lock.get("skin_tone_hex", "natural")}
- Eye color: {face_lock.get("eye_color", "brown")}
- Jawline: {face_lock.get("jawline", "natural")}
- Hair: {face_lock.get("hair", "natural")}
- Nose: {face_lock.get("nose_shape", "natural")}
- Distinguishing marks: {face_lock.get("distinguishing_marks", "none specified")}
{composition_block}

REALISM ANCHORS (MANDATORY — the image MUST exhibit ALL of these):
{REALISM_ANCHORS_TEXT}
{ANTI_GLOSS_INSTRUCTION}
{do_not_block}

The final image should look like it was taken by a friend with an iPhone,
not by a professional photographer in a studio. This is for a recruitment
ad targeting real people in {region}."""

    return prompt, composition_key


def build_visual_qa_prompt(actor: dict, region: str, outfit_key: str = "at_home_working") -> str:
    """Build the VLM visual QA prompt for evaluating a generated actor image."""
    face_lock = actor.get("face_lock", {})
    outfits = actor.get("outfit_variations", {})
    outfit = outfits.get(outfit_key, "casual clothes")
    accessory = actor.get("signature_accessory", "headphones")

    return f"""Evaluate this recruitment ad image for identity consistency, cultural authenticity, and realism.

EXPECTED ACTOR IDENTITY (face_lock — these MUST match):
- Name: {actor.get("name", "unknown")}
- Skin tone: {face_lock.get("skin_tone_hex", "unknown")}
- Eye color: {face_lock.get("eye_color", "unknown")}
- Jawline: {face_lock.get("jawline", "unknown")}
- Hair: {face_lock.get("hair", "unknown")}
- Nose: {face_lock.get("nose_shape", "unknown")}
- Distinguishing marks: {face_lock.get("distinguishing_marks", "none")}
- Age range: {face_lock.get("age_range", "20-35")}

EXPECTED OUTFIT: {outfit}
SIGNATURE ACCESSORY (must be visible): {accessory}
REGION: {region}

Check EACH of these and score 0.0-1.0:

1. IDENTITY CONSISTENCY: Does the person match the face_lock description above?
   - Check: skin tone matches hex, eye color matches, hair matches, jawline matches
   - Check: distinguishing marks present (stubble, beauty mark, glasses, etc.)
   - Check: age looks correct for the specified range
   - Red flags: wrong skin tone, different hair, missing distinguishing features
   - THIS IS THE MOST IMPORTANT DIMENSION — the actor must be recognizable across all images

2. REALISM: Does this look like a real iPhone photo, not AI-generated or stock?
   - Check for: natural skin pores, realistic lighting imperfections, candid pose
   - Check for: fabric texture/wrinkles, environmental noise (real objects)
   - Red flags: plastic skin, perfect symmetry, uncanny valley, studio lighting, extra fingers

3. CULTURAL AUTHENTICITY: Does this person look like they belong in {region}?
   - Check for: appropriate ethnicity, realistic clothing for the region, authentic setting
   - Red flags: generic/ambiguous ethnicity, Western-default clothing, mismatched setting

4. ACCESSORY CHECK: Is the signature accessory ({accessory}) visible in the image?
   - Must be clearly present — this creates recognition across the ad campaign
   - Red flag: accessory missing or wrong item shown

5. BRAND FIT: Would this work for a OneForma contributor recruitment ad?
   - Check for: approachable, relatable, working-from-home/cafe vibe
   - Red flags: corporate attire, model-like appearance, luxury setting

6. TECHNICAL QUALITY: Is the image usable for an ad?
   - Check for: proper framing, no artifacts, face clearly visible, good resolution
   - Red flags: distorted features, extra fingers, blurry face, watermarks

Return ONLY valid JSON:
{{
  "overall_score": 0.0,
  "score": 0.0,
  "dimensions": {{
    "identity_consistency": {{"score": 0.0, "feedback": "Does the face match the face_lock?"}},
    "realism": {{"score": 0.0, "feedback": "..."}},
    "cultural_authenticity": {{"score": 0.0, "feedback": "..."}},
    "accessory_check": {{"score": 0.0, "feedback": "Is {accessory} visible?"}},
    "brand_fit": {{"score": 0.0, "feedback": "..."}},
    "technical_quality": {{"score": 0.0, "feedback": "..."}}
  }},
  "issues": ["List any problems that need fixing"],
  "passed": true
}}"""


# =========================================================================
# MULTI-ACTOR SCENES & RELATIONSHIPS
# =========================================================================

RELATIONSHIP_TYPES = {
    "independent": "Two separate individuals who happen to be in the same scene",
    "twins_identical": "Identical twins — same face, different outfits/accessories",
    "twins_fraternal": "Fraternal twins — same family features, different faces",
    "colleagues": "Coworkers/friends — different people, same setting/vibe",
    "community": "Group of diverse contributors — variety of ages, ethnicities",
}


def build_twin_actor_prompt(
    source_actor: dict,
    region: str,
    language: str,
    twin_type: str = "twins_identical",
) -> str:
    """Build a twin actor identity card derived from a source actor.

    For identical twins: copies face_lock exactly, changes outfit +
    distinguishing marks + accessory.
    For fraternal twins: shares skin_tone + hair color, changes everything else.
    """
    source_face = source_actor.get("face_lock", {})
    source_name = source_actor.get("name", "unknown")

    if twin_type == "twins_identical":
        face_instruction = f"""The twin has the EXACT SAME face_lock as {source_name}:
- skin_tone_hex: {source_face.get("skin_tone_hex", "same")}
- eye_color: {source_face.get("eye_color", "same")}
- jawline: {source_face.get("jawline", "same")}
- hair: {source_face.get("hair", "same")} (can be slightly different length/style)
- nose_shape: {source_face.get("nose_shape", "same")}
- age_range: {source_face.get("age_range", "same")}
Only change: distinguishing_marks (different scar/mole/glasses to tell them apart)"""
    else:
        face_instruction = f"""Fraternal twin of {source_name} — same family, different person:
- skin_tone_hex: SAME as {source_face.get("skin_tone_hex", "source")}
- eye_color: can differ slightly
- jawline: different shape
- hair: same COLOR but different style/length
- nose_shape: different
- age_range: {source_face.get("age_range", "same")}
They should look like siblings, not like the same person."""

    return f"""Create an AI UGC actor who is the {"identical" if twin_type == "twins_identical" else "fraternal"} twin of {source_name}.

SOURCE ACTOR: {source_name}
{face_instruction}

TARGET REGION: {region}
TARGET LANGUAGE: {language}

Return ONLY valid JSON with the same schema as a regular actor:
{{
  "name": "A different culturally appropriate name (they are siblings)",
  "face_lock": {{...same schema as regular actor...}},
  "prompt_seed": "Include 'identical twin of {source_name}' in the prompt seed. Reference the source actor's validated_seed_url if available.",
  "outfit_variations": {{...4 variations, DIFFERENT from {source_name}'s outfits...}},
  "signature_accessory": "DIFFERENT from {source_name}'s accessory (this is how viewers tell them apart)",
  "backdrops": ["Same region-appropriate settings as {source_name}"]
}}

The twin must be DISTINGUISHABLE from {source_name} by:
1. Different signature accessory
2. Different outfit preferences
3. Different distinguishing marks
But RECOGNIZABLE as their twin by: same skin, same build, same age."""


def build_scene_prompt(
    actors: list[dict],
    scene_type: str,
    design: dict | None = None,
    region: str = "Global",
) -> str:
    """Build a multi-actor scene prompt for Seedream.

    Combines multiple actors' prompt seeds into one image with interaction
    cues and composition direction.

    Parameters
    ----------
    actors:
        List of actor identity cards (each with face_lock, prompt_seed).
    scene_type:
        Type of scene: "collaboration", "celebration", "community",
        "video_call", "side_by_side".
    design:
        Design direction from Stage 1.
    region:
        Target region for setting context.
    """
    actor_count = len(actors)
    photography_dir = (design or {}).get("photography_direction", "candid, natural, UGC-style")

    # Build per-actor identity descriptions
    actor_descriptions = []
    for i, actor in enumerate(actors):
        face = actor.get("face_lock", {})
        seed = actor.get("prompt_seed", f"Person {i + 1}")
        accessory = actor.get("signature_accessory", "")
        actor_descriptions.append(
            f"PERSON {i + 1} ({actor.get('name', f'Actor {i + 1}')}):\n"
            f"  Identity: {seed}\n"
            f"  Signature accessory (MUST be visible): {accessory}\n"
            f"  Skin tone: {face.get('skin_tone_hex', 'natural')}"
        )

    actors_block = "\n\n".join(actor_descriptions)

    # Scene-specific composition direction
    scene_directions = {
        "collaboration": (
            f"{actor_count} people working together at a shared table or "
            f"co-working space. Laptops open, casual conversation, natural "
            f"body language. One person pointing at a screen, others engaged."
        ),
        "celebration": (
            f"{actor_count} people celebrating — high-five, fist bump, or "
            f"laughing together. Casual setting. Genuine joy, not posed. "
            f"One person holding phone showing a notification/achievement."
        ),
        "community": (
            f"Group shot of {actor_count} diverse contributors. Arranged "
            f"naturally (not in a line). Mixed seating — some standing, "
            f"some sitting. Each with their own device. Community vibe."
        ),
        "video_call": (
            f"Split-screen or over-shoulder view of a video call between "
            f"{actor_count} people. Each in their own home/cafe setting. "
            f"Laptop screens visible showing video tiles of the others."
        ),
        "side_by_side": (
            f"{actor_count} people side by side — portrait composition. "
            f"Each looking at camera or at their screen. Individual "
            f"identity clear. Good for carousel or comparison layout."
        ),
    }

    scene_dir = scene_directions.get(scene_type, scene_directions["collaboration"])

    settings = REGION_SETTINGS.get(region, REGION_SETTINGS["Global"])

    return f"""Group photograph of {actor_count} people for a OneForma recruitment ad.

SCENE TYPE: {scene_type}
COMPOSITION: {scene_dir}

{actors_block}

SETTING: {settings[0]} (or similar realistic {region} location)
STYLE: {photography_dir}

CRITICAL RULES:
- Each person's face must match their identity description above
- Each person's signature accessory must be visible
- Natural interaction — NOT posed, NOT corporate team photo
- Different body types, heights, postures (realistic group)
- Correct number of people: exactly {actor_count} (no more, no less)
- Each person must be distinguishable from the others

REALISM ANCHORS (MANDATORY):
{REALISM_ANCHORS_TEXT}

This should look like a friend took a group photo at a real {region} location."""


def build_scene_qa_prompt(actors: list[dict], scene_type: str, region: str) -> str:
    """Build VQA prompt for evaluating a multi-actor scene image."""
    actor_count = len(actors)
    actor_checks = []
    for i, actor in enumerate(actors):
        face = actor.get("face_lock", {})
        accessory = actor.get("signature_accessory", "")
        actor_checks.append(
            f"Person {i + 1} ({actor.get('name', '?')}): "
            f"skin={face.get('skin_tone_hex', '?')}, "
            f"hair={face.get('hair', '?')}, "
            f"accessory={accessory}"
        )

    checks_block = "\n".join(f"  - {c}" for c in actor_checks)

    return f"""Evaluate this multi-actor recruitment ad image.

EXPECTED: {actor_count} people in a {scene_type} scene in {region}.

IDENTITY CHECK (each person must match):
{checks_block}

Score 0.0-1.0 on each:

1. HEADCOUNT: Are there exactly {actor_count} people? (1.0 = correct, 0.0 = wrong count)
2. IDENTITY: Does each person match their description? (average across all actors)
3. ACCESSORIES: Is each person's signature accessory visible?
4. INTERACTION: Does the scene feel natural? (not posed, real body language)
5. REALISM: iPhone-quality photo? (skin texture, lighting imperfections, etc.)
6. CULTURAL: Setting appropriate for {region}?

Return ONLY valid JSON:
{{
  "overall_score": 0.0,
  "dimensions": {{
    "headcount": {{"score": 0.0, "feedback": "..."}},
    "identity": {{"score": 0.0, "feedback": "..."}},
    "accessories": {{"score": 0.0, "feedback": "..."}},
    "interaction": {{"score": 0.0, "feedback": "..."}},
    "realism": {{"score": 0.0, "feedback": "..."}},
    "cultural": {{"score": 0.0, "feedback": "..."}}
  }},
  "per_actor": [
    {{"name": "...", "matched": true, "feedback": "..."}}
  ],
  "issues": [],
  "passed": true
}}"""
