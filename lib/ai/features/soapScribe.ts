import { callAI } from '../client.ts';
import { ensureDisclaimer, extractJsonObject } from '../json.ts';
import { assertNoPIIKeys } from '../sanitize.ts';

export interface SoapNoteOutput {
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  confidence: 'high' | 'medium' | 'low';
  flag: string | null;
  _disclaimer: string;
}

const SYSTEM_PROMPT = `You are NirogAI, a clinical scribe for Indian clinics.
You receive a raw voice-note transcript from a doctor after a patient visit.
The transcript may be in mixed Hindi-English (Hinglish). Handle it gracefully.
Convert it into a structured SOAP note.

Output ONLY valid JSON:
{
  "soap": {
    "subjective": "Patient's reported complaints in plain language",
    "objective": "Vitals, exam findings, test results mentioned",
    "assessment": "Doctor's diagnosis or impression",
    "plan": "Medications prescribed, follow-up, lifestyle advice"
  },
  "confidence": "high | medium | low",
  "flag": "any clinical concern the AI noticed, or null",
  "_disclaimer": "AI-generated insight. Please verify with clinical judgment."
}`;

export async function generateSoapNote(transcript: string, aiCaller = callAI): Promise<SoapNoteOutput> {
  assertNoPIIKeys({ transcript });

  const content = await aiCaller({
    model: process.env.AI_MODEL_SCRIBE ?? '',
    apiKey: process.env.AI_API_KEY_SCRIBE,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: transcript },
    ],
    temperature: 0.2,
    top_p: 0.9,
    response_format: { type: 'json_object' },
    max_tokens: 1200,
  });

  const parsed = ensureDisclaimer(extractJsonObject<Partial<SoapNoteOutput>>(content));
  if (!parsed.soap?.subjective || !parsed.soap.objective || !parsed.soap.assessment || !parsed.soap.plan) {
    throw new Error('AI response missing SOAP sections');
  }

  return {
    soap: parsed.soap,
    confidence: parsed.confidence === 'high' || parsed.confidence === 'low' ? parsed.confidence : 'medium',
    flag: typeof parsed.flag === 'string' ? parsed.flag : null,
    _disclaimer: parsed._disclaimer,
  };
}
