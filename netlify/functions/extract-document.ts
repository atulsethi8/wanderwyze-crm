import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const parseJson = (text: string) => {
  const cleaned = (text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace < firstBrace) throw new Error('AI returned no JSON object');
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
};

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const token = event.headers.authorization?.replace(/^Bearer\s+/i, '');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!token || !supabaseUrl || !supabaseAnonKey) return json(401, { error: 'Authentication required' });
    if (!apiKey) return json(500, { error: 'Gemini API key is not configured in Netlify' });

    const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return json(401, { error: 'Invalid or expired session' });

    const { fileContent, mimeType, schema, promptText } = JSON.parse(event.body || '{}');
    if (!fileContent || !promptText) return json(400, { error: 'Document and extraction prompt are required' });
    if (fileContent.length > 7_000_000) return json(413, { error: 'PDF is too large. Please use a file under 5 MB.' });

    const ai = new GoogleGenAI({ apiKey });
    const documentPart = { inlineData: { data: fileContent, mimeType: mimeType || 'application/pdf' } };
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: promptText }, documentPart] },
        config: { responseMimeType: 'application/json', responseSchema: schema },
      });
    } catch (structuredError) {
      console.warn('Structured extraction failed; retrying without schema.', structuredError);
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: `${promptText}\nReturn only one valid JSON object without markdown fences.` }, documentPart] },
        config: { responseMimeType: 'application/json' },
      });
    }

    return json(200, { data: parseJson(response.text || '') });
  } catch (error: any) {
    console.error('Document extraction failed', error);
    return json(500, { error: error?.message || 'Document extraction failed' });
  }
};
