import { auth } from '@clerk/nextjs/server';
import { uploadToBlob } from '@/lib/blob';
import { callKimiK25 } from '@/lib/openrouter';
import { buildExtractionSystemPrompt } from '@/lib/extraction-prompt';
import type { ExtractionResult } from '@/lib/types';

async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // PDF — use pdf-parse for proper text extraction
  if (fileType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      const pdfModule = await import('pdf-parse');
      const pdfParse = (pdfModule as any).default || pdfModule;
      const data = await pdfParse(buffer);
      if (data.text && data.text.trim().length > 50) {
        return data.text;
      }
      return `[PDF parsed but text content was too short. Pages: ${data.numpages}. File: ${file.name}]`;
    } catch (e) {
      console.error('[extract/rfp] PDF parse failed:', e);
      return `[PDF parse failed for ${file.name}. Error: ${e instanceof Error ? e.message : 'unknown'}]`;
    }
  }

  // DOCX — extract raw text (basic but works for most docs)
  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
    try {
      // DOCX is a zip of XML files — extract text from word/document.xml
      const text = buffer.toString('utf-8');
      // Strip XML tags to get raw text
      const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (stripped.length > 100) {
        return stripped;
      }
    } catch {
      // Fall through to plain text
    }
  }

  // Images — send description (OCR needs vision model)
  if (fileType.startsWith('image/')) {
    return `[Image file: ${file.name}. Please describe the content you see and extract any text, tables, or structured data.]`;
  }

  // Plain text, CSV, etc
  const textDecoder = new TextDecoder('utf-8', { fatal: false });
  const text = textDecoder.decode(arrayBuffer);
  const printableRatio = text.replace(/[^\x20-\x7E\n\r\t]/g, '').length / Math.max(text.length, 1);

  if (printableRatio > 0.5) {
    return text;
  }

  return `[Binary file: ${file.name} (${fileType}). Could not extract readable text.]`;
}

async function callLLMForExtraction(systemPrompt: string, userPrompt: string): Promise<string> {
  // Try NIM K2.5 first (free), fallback to OpenRouter
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  if (nimKey) {
    try {
      const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nimKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'moonshotai/kimi-k2.5',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 8192,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content ?? '';
        if (content.length > 10) {
          console.log('[extract/rfp] Used NIM K2.5 for extraction');
          return content;
        }
      }
    } catch (e) {
      console.warn('[extract/rfp] NIM K2.5 failed, falling back to OpenRouter:', e);
    }
  }

  // Fallback: OpenRouter K2.5
  return callKimiK25(systemPrompt, userPrompt);
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json(
        { error: 'No file provided. Send a file in the "file" form field.' },
        { status: 400 }
      );
    }

    // Upload file to Vercel Blob
    const blobUrl = await uploadToBlob(file, 'rfp-uploads');

    // Extract text content from the file
    const extractedText = await extractTextFromFile(file);
    console.log(`[extract/rfp] Extracted ${extractedText.length} chars from ${file.name} (${file.type})`);

    // Build the system prompt with all active schemas
    const systemPrompt = await buildExtractionSystemPrompt();

    // Call K2.5 for extraction (NIM first, OpenRouter fallback)
    const rawResponse = await callLLMForExtraction(
      systemPrompt,
      `Please analyze the following RFP/project document and extract structured data:\n\n${extractedText}`
    );

    // Parse the JSON response
    let extraction: ExtractionResult;
    try {
      // Strip potential markdown code fences
      let cleaned = rawResponse.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

      // Try direct parse
      try {
        extraction = JSON.parse(cleaned) as ExtractionResult;
      } catch {
        // Brace-depth search for JSON object
        let depth = 0, start = -1, last = '';
        for (let i = 0; i < cleaned.length; i++) {
          if (cleaned[i] === '{') { if (depth === 0) start = i; depth++; }
          else if (cleaned[i] === '}') {
            depth--;
            if (depth === 0 && start >= 0) {
              const candidate = cleaned.slice(start, i + 1);
              try { JSON.parse(candidate); last = candidate; } catch {}
              start = -1;
            }
          }
        }
        if (last) {
          extraction = JSON.parse(last) as ExtractionResult;
        } else {
          throw new Error('No valid JSON found in response');
        }
      }
    } catch {
      return Response.json(
        {
          error: 'Failed to parse extraction result from AI',
          raw_response: rawResponse.slice(0, 500),
          blob_url: blobUrl,
        },
        { status: 502 }
      );
    }

    return Response.json({
      extraction,
      blob_url: blobUrl,
      file_name: file.name,
      file_type: file.type,
    });
  } catch (error) {
    console.error('[api/extract/rfp] Extraction failed:', error);
    return Response.json(
      { error: 'Failed to process RFP file' },
      { status: 500 }
    );
  }
}
