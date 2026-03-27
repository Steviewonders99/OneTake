import { auth } from '@clerk/nextjs/server';
import { uploadToBlob } from '@/lib/blob';
import { callKimiK25 } from '@/lib/openrouter';
import { buildExtractionSystemPrompt } from '@/lib/extraction-prompt';
import type { ExtractionResult } from '@/lib/types';

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
    let extractedText: string;
    const fileType = file.type.toLowerCase();

    if (
      fileType.startsWith('image/')
    ) {
      // Images require OCR — not yet implemented
      extractedText = `[Image file uploaded: ${file.name}. OCR not implemented yet. File URL: ${blobUrl}]`;
    } else {
      // For PDF, DOCX, and text files, read the raw text content
      const arrayBuffer = await file.arrayBuffer();
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      extractedText = textDecoder.decode(arrayBuffer);

      // If the decoded text is mostly non-printable characters, it's likely a binary format
      const printableRatio = extractedText.replace(/[^\x20-\x7E\n\r\t]/g, '').length / extractedText.length;
      if (printableRatio < 0.5) {
        extractedText = `[Binary file uploaded: ${file.name} (${fileType}). Raw text extraction may be incomplete. File URL: ${blobUrl}]`;
      }
    }

    // Build the system prompt with all active schemas
    const systemPrompt = await buildExtractionSystemPrompt();

    // Call Kimi K2.5 for extraction
    const rawResponse = await callKimiK25(
      systemPrompt,
      `Please analyze the following RFP/project document and extract structured data:\n\n${extractedText}`
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
          blob_url: blobUrl,
        },
        { status: 502 }
      );
    }

    return Response.json({
      extraction,
      blob_url: blobUrl,
      file_name: file.name,
      file_type: fileType,
    });
  } catch (error) {
    console.error('[api/extract/rfp] Extraction failed:', error);
    return Response.json(
      { error: 'Failed to process RFP file' },
      { status: 500 }
    );
  }
}
