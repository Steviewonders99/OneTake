import { auth } from '@clerk/nextjs/server';
import { callNIM } from '@/lib/nim';
import { buildExtractionSystemPrompt } from '@/lib/extraction-prompt';
import type { ExtractionResult } from '@/lib/types';

export const maxDuration = 300;

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const text = body.text;

    if (!text || typeof text !== 'string') {
      return Response.json(
        { error: 'Missing or invalid "text" field in request body' },
        { status: 400 }
      );
    }

    if (text.trim().length === 0) {
      return Response.json(
        { error: 'Text content cannot be empty' },
        { status: 400 }
      );
    }

    // Build the system prompt with all active schemas
    const systemPrompt = await buildExtractionSystemPrompt();

    // Call Gemma 4 via NIM for extraction (free, fast)
    // Falls back to Kimi K2.5 on NIM, then OpenRouter as last resort
    const rawResponse = await callNIM(
      systemPrompt,
      `Please analyze the following project description or RFP text and extract structured data:\n\n${text}`
    );

    // Parse the JSON response
    let extraction: ExtractionResult;
    try {
      // Strip potential markdown code fences
      const cleaned = rawResponse.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
      extraction = JSON.parse(cleaned) as ExtractionResult;
    } catch {
      return Response.json(
        {
          error: 'Failed to parse extraction result from AI',
          raw_response: rawResponse,
        },
        { status: 502 }
      );
    }

    return Response.json({ extraction });
  } catch (error) {
    console.error('[api/extract/paste] Extraction failed:', error);
    return Response.json(
      { error: 'Failed to extract from pasted text' },
      { status: 500 }
    );
  }
}
