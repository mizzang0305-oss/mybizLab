import { GoogleGenAI } from '@google/genai';
import { readPublicEnv } from '../../shared/lib/publicEnv.js';

const GEMINI_MODEL = 'gemini-2.5-flash';

export interface GeminiResult {
  source: 'gemini' | 'fallback';
  text: string;
  error?: string;
}

export async function generateGeminiSummary(prompt: string, fallback: string): Promise<GeminiResult> {
  const apiKey = readPublicEnv('VITE_GEMINI_API_KEY');

  if (!apiKey) {
    return {
      source: 'fallback',
      text: fallback,
      error: 'Missing VITE_GEMINI_API_KEY. Use a server-side proxy in production.',
    };
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = response.text?.trim();

    if (!text) {
      return {
        source: 'fallback',
        text: fallback,
        error: 'Gemini returned an empty response.',
      };
    }

    return {
      source: 'gemini',
      text,
    };
  } catch (error) {
    return {
      source: 'fallback',
      text: fallback,
      error: error instanceof Error ? error.message : 'Unknown Gemini error',
    };
  }
}
