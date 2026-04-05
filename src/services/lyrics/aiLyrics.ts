import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.0-flash';
const TIMEOUT_MS = 30_000;

let aiInstance: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI | null => {
  if (!GEMINI_API_KEY) return null;
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ vertexai: false, apiKey: GEMINI_API_KEY });
  }
  return aiInstance;
};

export const isAIAvailable = (): boolean => {
  return !!GEMINI_API_KEY;
};

const callGemini = async (prompt: string): Promise<string | null> => {
  const ai = getAI();
  if (!ai) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });

    clearTimeout(timeoutId);
    return response.text?.trim() || null;
  } catch (error) {
    console.error('[AI Lyrics] Gemini API error:', error);
    return null;
  }
};

export const generateLyricsWithAI = async (
  title: string,
  artist: string,
  language?: string,
): Promise<string | null> => {
  const lang = language || 'the same language as the song title';
  const prompt = `Generate LRC-format lyrics for the song "${title}" by ${artist}.

Rules:
- Use ONLY [mm:ss.xx] timestamp format, one per line
- Timestamps should progress naturally (roughly 2-5 seconds per line)
- Start from [00:00.00]
- Write lyrics in ${lang}
- Return ONLY the LRC content, no explanations, no markdown code blocks
- If you don't know the actual lyrics, create plausible ones that match the song's theme

Example format:
[00:00.00]First line of lyrics
[00:03.50]Second line of lyrics
[00:07.00]Third line of lyrics`;

  const result = await callGemini(prompt);
  if (!result) return null;

  // Strip markdown code blocks if present
  const cleaned = result.replace(/^```(?:lrc)?\n?/gm, '').replace(/```$/gm, '').trim();
  return cleaned || null;
};

export const translateLyricsWithAI = async (
  lrcContent: string,
  targetLanguage: string,
): Promise<string | null> => {
  const prompt = `Translate the following LRC-format lyrics to ${targetLanguage}.

CRITICAL RULES:
- Preserve ALL timestamps EXACTLY as they are - do NOT change any [mm:ss.xx] values
- Only translate the text after each timestamp
- Keep the same number of lines in the same order
- Return ONLY the translated LRC content, no explanations, no markdown code blocks

Input LRC:
${lrcContent}`;

  const result = await callGemini(prompt);
  if (!result) return null;

  const cleaned = result.replace(/^```(?:lrc)?\n?/gm, '').replace(/```$/gm, '').trim();
  return cleaned || null;
};
