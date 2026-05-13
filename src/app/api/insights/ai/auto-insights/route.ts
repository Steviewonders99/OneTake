import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { callNIM } from '@/lib/nim';

const SYSTEM_PROMPT = `You are a concise marketing analytics advisor for OneForma.

Given widget data from a dashboard, generate ONE short insight per widget.

Rules:
1. Each insight is ONE sentence, max 120 characters
2. Focus on: what changed, why it matters, what to do
3. Classify each as: info, positive, warning, or alert
4. Use specific numbers — never say "the data shows"

Respond with ONLY JSON:
{
  "widget-id": { "text": "insight text", "type": "positive" }
}`;

export async function POST(request: NextRequest) {
  await requireAuth();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ insights: {} });
  }
  const widgetData = body.widgets as Record<string, { type: string; title: string; summary: string }>;

  if (!widgetData || Object.keys(widgetData).length === 0) {
    return NextResponse.json({ insights: {} });
  }

  const userPrompt = Object.entries(widgetData)
    .map(([id, w]) => `Widget "${w.title}" (${w.type}):\n${w.summary}`)
    .join('\n\n');

  try {
    const raw = await callNIM(SYSTEM_PROMPT, userPrompt);
    let jsonStr = raw.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const insights = JSON.parse(jsonStr);
    return NextResponse.json({ insights });
  } catch (err) {
    console.error('[Auto-Insights] Error:', err);
    return NextResponse.json({ insights: {} });
  }
}
