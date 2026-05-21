/**
 * NVIDIA NIM client for server-side LLM calls.
 *
 * Uses Kimi K2.5 as primary (fastest for structured extraction).
 * Falls back to Gemma 4 31B on NIM if Kimi fails.
 * Falls back to OpenRouter Kimi K2.5 as last resort.
 */

const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NIM_MODEL_FALLBACK = "google/gemma-4-31b-it";

export async function callNIM(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  // OpenRouter primary — reliable, no 429 risk
  if (openrouterKey) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 15000,
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        if (content.length > 10) return content;
      }
    } catch (err) {
      console.warn("[callNIM] OpenRouter failed, trying NIM:", (err as Error).message?.slice(0, 100));
    }
  }

  // Fallback: NIM Gemma 4
  if (nimKey) {
    try {
      const result = await nimCall(nimKey, NIM_MODEL_FALLBACK, systemPrompt, userPrompt);
      if (result) return result;
    } catch (err) {
      console.warn("[callNIM] NIM Gemma 4 failed:", (err as Error).message?.slice(0, 100));
    }
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
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NIM ${model} error: ${response.status} ${error.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}
