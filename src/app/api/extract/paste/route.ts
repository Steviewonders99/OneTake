import { auth } from '@clerk/nextjs/server';
import { callNIM } from '@/lib/nim';
import { buildExtractionSystemPrompt } from '@/lib/extraction-prompt';
import type { ExtractionResult } from '@/lib/types';

export const maxDuration = 300;

export async function POST(request: Request) {
  const t0 = Date.now();
  const { userId } = await auth();
  console.log(`[extract/paste] auth: ${Date.now() - t0}ms`);

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const text = body.text;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return Response.json({ error: 'Missing or empty text' }, { status: 400 });
    }

    // Build system prompt (DB query for schemas)
    const t1 = Date.now();
    const systemPrompt = await buildExtractionSystemPrompt();
    console.log(`[extract/paste] schema: ${Date.now() - t1}ms, prompt: ${systemPrompt.length} chars`);

    // Call LLM
    const t2 = Date.now();
    const rawResponse = await callNIM(
      systemPrompt,
      `Analyze this project description and extract structured data. Be generous with inference — fill in reasonable defaults for fields you can guess from context. It is better to provide a draft value than to leave it blank.\n\n${text}`
    );
    console.log(`[extract/paste] LLM: ${Date.now() - t2}ms, response: ${rawResponse.length} chars`);

    // Parse JSON — aggressively strip markdown fences and surrounding text
    let extraction: ExtractionResult;
    try {
      let cleaned = rawResponse;
      // Strip markdown code fences
      cleaned = cleaned.replace(/^```(?:json)?\s*/gm, '').replace(/\s*```\s*$/gm, '').trim();
      // If response starts with text before JSON, extract just the JSON
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
      }
      extraction = JSON.parse(cleaned) as ExtractionResult;
    } catch {
      console.error('[extract/paste] JSON parse failed. Raw:', rawResponse.slice(0, 300));
      return Response.json(
        { error: 'Failed to parse extraction result from AI', raw_response: rawResponse.slice(0, 500) },
        { status: 502 },
      );
    }

    console.log(`[extract/paste] total: ${Date.now() - t0}ms, type: ${extraction.detected_task_type}`);
    return Response.json({ extraction });
  } catch (error) {
    console.error('[extract/paste] failed:', error);
    return Response.json({ error: 'Failed to extract from pasted text' }, { status: 500 });
  }
}
