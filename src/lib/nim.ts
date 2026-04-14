/**
 * NVIDIA NIM client for server-side LLM calls.
 *
 * Uses the free NIM API with Gemma 4 31B for extraction tasks.
 * Falls back to Kimi K2.5 on NIM if Gemma fails.
 * Falls back to OpenRouter Kimi K2.5 as last resort.
 */

const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NIM_MODEL_PRIMARY = "google/gemma-4-31b-it";
const NIM_MODEL_FALLBACK = "moonshotai/kimi-k2.5";

export async function callNIM(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  // Try NIM Gemma 4 first
  if (nimKey) {
    try {
      const result = await nimCall(nimKey, NIM_MODEL_PRIMARY, systemPrompt, userPrompt);
      if (result) return result;
    } catch (err) {
      console.warn("[NIM] Gemma 4 failed, trying Kimi K2.5 fallback:", (err as Error).message?.slice(0, 100));
    }

    // Fallback: NIM Kimi K2.5
    try {
      const result = await nimCall(nimKey, NIM_MODEL_FALLBACK, systemPrompt, userPrompt);
      if (result) return result;
    } catch (err) {
      console.warn("[NIM] Kimi K2.5 fallback failed:", (err as Error).message?.slice(0, 100));
    }
  }

  // Last resort: OpenRouter
  if (openrouterKey) {
    console.info("[NIM] Falling back to OpenRouter Kimi K2.5");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "moonshotai/kimi-k2.5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter error: ${response.status} ${error.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  throw new Error("No LLM API keys configured (NVIDIA_NIM_API_KEY or OPENROUTER_API_KEY)");
}

async function nimCall(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NIM ${model} error: ${response.status} ${error.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}
