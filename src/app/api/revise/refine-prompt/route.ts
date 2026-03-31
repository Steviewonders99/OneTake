import { auth } from '@clerk/nextjs/server';

/**
 * Prompt Refinement Layer — intercepts user's natural language revision request
 * and optimizes it for the target model using best practices.
 *
 * User types: "make the background nicer"
 * System returns: "Remove the cluttered background. Replace with a clean, modern home
 *   office setting with warm natural lighting from a window. Keep the person's face,
 *   pose, outfit, and skin tone exactly as they are. Maintain the same camera angle
 *   and depth of field."
 *
 * POST /api/revise/refine-prompt
 * { user_prompt: string, revision_type: "image" | "copy" | "creative", context: {} }
 */

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || '';
const NVIDIA_NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';

const REFINEMENT_PROMPTS: Record<string, string> = {
  image: `You are a prompt engineering expert specializing in Seedream 4.5 image editing.

Your job: Take a casual, vague user request and transform it into a precise, detailed Seedream edit prompt.

RULES FOR SEEDREAM EDIT PROMPTS:
- ALWAYS specify what to KEEP: "Keep the person's face, expression, pose, skin tone, and outfit exactly the same"
- ALWAYS specify what to CHANGE: Be precise about the edit — describe the desired result, not just "make it better"
- ALWAYS mention lighting: "Maintain warm natural lighting" or "Change to golden hour lighting"
- ALWAYS mention the background explicitly if relevant
- NEVER use vague words like "better", "nicer", "improve" — be SPECIFIC
- For clothing changes: describe the exact garment, color, and style
- For background changes: describe the specific setting, objects, colors, and mood
- For skin/face fixes: mention "natural skin pores, realistic texture, no airbrushing"
- For artifact removal: specify what artifacts to remove (extra fingers, distortions, blur)
- Keep the prompt under 200 words — Seedream works best with focused instructions

EXAMPLES:
User: "fix the background"
Refined: "Remove the cluttered background. Replace with a clean modern home office — tidy wooden desk, laptop, warm natural light streaming from a window on the left. Keep the person's face, expression, pose, outfit, and skin tone exactly as they are. Maintain the same camera angle and depth of field. Middle-class interior, not luxury."

User: "make her look more professional"
Refined: "Change the outfit to a smart casual blazer over a clean t-shirt. Keep the person's face, hairstyle, skin tone, and expression exactly the same. Maintain the current background and lighting. The clothing should look natural and wrinkle-free, appropriate for a professional LinkedIn photo."

User: "remove the weird stuff"
Refined: "Remove all AI artifacts: fix any extra fingers, smooth out any distorted edges on the face and hands, correct any unnaturally smooth or plastic-looking skin to have natural pores and texture. Keep the entire composition, pose, outfit, background, and lighting the same. Only fix the visible AI generation artifacts."

Return ONLY the refined prompt, nothing else.`,

  copy: `You are a prompt engineering expert specializing in recruitment ad copywriting.

Your job: Take a casual user revision request and transform it into a precise copywriting brief.

RULES:
- Always specify the TARGET PERSONA (who this copy speaks to)
- Always specify the PLATFORM (different platforms need different tones)
- Always specify WORD LIMITS (headlines: 3-7 words, subheadlines: 0-6 words, CTA: 2-3 words)
- Always specify the HOOK TYPE to use (earnings, identity, curiosity, social proof, effort minimization, loss aversion)
- Include what to KEEP (any good elements from the original)
- Include what to CHANGE (specific issues with the current copy)
- Mention the TONE (casual/professional/urgent/playful)

EXAMPLES:
User: "make it punchier"
Refined: "Rewrite the headline to be more scroll-stopping. Use a curiosity or earnings hook. Maximum 5 words. The headline should create tension or surprise — avoid generic statements like 'Join our team'. Consider using a number ('$25/hr'), a question ('Still job hunting?'), or a bold claim ('Your voice = your paycheck'). Keep the CTA action-oriented. Maintain the same persona targeting."

User: "too generic"
Refined: "The copy sounds generic and templated. Rewrite to be specific to THIS task (audio recording for voice tech) and THIS persona (bilingual students in Morocco). Use their actual pain point (class schedule conflicts) as the hook. Include a specific benefit number if possible. Replace vague words like 'opportunity' and 'flexible' with concrete details."

Return ONLY the refined prompt, nothing else.`,

  creative: `You are a prompt engineering expert specializing in ad creative overlay design.

Your job: Take a casual user revision request and transform it into a precise creative direction brief.

RULES:
- Specify which ELEMENTS to change (headline, subheadline, CTA, or all three)
- Specify WORD LIMITS (headline: 3-7 words, sub: 0-6 words, CTA: 2-3 words)
- Specify the HOOK TYPE to try (earnings, identity, curiosity, social proof)
- Mention the PLATFORM context (TikTok = raw/casual, LinkedIn = professional, IG = emotional)
- Mention the PERSONA the creative targets
- Include what's WORKING (any elements to keep)
- Include what's NOT WORKING (specific issues)

Return ONLY the refined prompt, nothing else.`,
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { user_prompt, revision_type, context } = await request.json();

  if (!user_prompt || !revision_type) {
    return Response.json({ error: 'Missing user_prompt or revision_type' }, { status: 400 });
  }

  const systemPrompt = REFINEMENT_PROMPTS[revision_type];
  if (!systemPrompt) {
    return Response.json({ error: `Unknown revision_type: ${revision_type}` }, { status: 400 });
  }

  // Build context string from asset data
  const contextStr = context
    ? `\nASSET CONTEXT:\n${JSON.stringify(context, null, 2).slice(0, 500)}`
    : '';

  try {
    const res = await fetch(`${NVIDIA_NIM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_NIM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-3-27b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `User's revision request: "${user_prompt}"${contextStr}\n\nRefine this into an optimized prompt for the ${revision_type} model.` },
        ],
        max_tokens: 512,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      // Fallback: return the user's prompt as-is
      return Response.json({ refined_prompt: user_prompt, was_refined: false });
    }

    const data = await res.json();
    const refined = data.choices?.[0]?.message?.content?.trim() || user_prompt;

    return Response.json({
      refined_prompt: refined,
      original_prompt: user_prompt,
      was_refined: true,
      revision_type,
    });
  } catch {
    // Fallback: return user's prompt as-is
    return Response.json({ refined_prompt: user_prompt, was_refined: false });
  }
}
