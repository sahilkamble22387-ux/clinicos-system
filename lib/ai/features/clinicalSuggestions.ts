import { callAI } from '../client.ts';
import { ensureDisclaimer, extractJsonObject } from '../json.ts';
import { assertNoPIIKeys, sanitizeForAI } from '../sanitize.ts';

export interface ClinicalSuggestionsInput {
  symptoms: string;
}

export interface ClinicalSuggestion {
  diagnosis: string;
  protocol: string;
}

export interface ClinicalSuggestionsOutput {
  suggestions: ClinicalSuggestion[];
  _disclaimer: string;
}

const SYSTEM_PROMPT = `You are NirogAI, a clinical assistant for Indian clinics.
You receive a short symptom or note summary from a doctor.
Suggest up to 3 likely diagnoses and one concise treatment protocol for each.
Be brief and clinically useful.

Respond ONLY in JSON:
{
  "suggestions": [
    {
      "diagnosis": "short likely diagnosis",
      "protocol": "concise treatment or next-step protocol"
    }
  ],
  "_disclaimer": "AI-generated insight. Please verify with clinical judgment."
}`;

const ALLOWED_KEYS = ['symptoms'] as const;

export async function generateClinicalSuggestions(input: ClinicalSuggestionsInput, aiCaller = callAI): Promise<ClinicalSuggestionsOutput> {
  const safe = sanitizeForAI(input as unknown as Record<string, unknown>, ALLOWED_KEYS);
  assertNoPIIKeys(safe);

  const content = await aiCaller({
    model: process.env.AI_MODEL_SUMMARIZER ?? '',
    apiKey: process.env.AI_API_KEY_SUMMARIZER,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(safe) },
    ],
    temperature: 0.2,
    top_p: 0.8,
    response_format: { type: 'json_object' },
    max_tokens: 500,
  });

  const parsed = ensureDisclaimer(extractJsonObject<Partial<ClinicalSuggestionsOutput>>(content));
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error('AI response missing clinical suggestions');
  }

  return {
    suggestions: parsed.suggestions
      .filter((suggestion): suggestion is ClinicalSuggestion => !!suggestion?.diagnosis && !!suggestion?.protocol)
      .slice(0, 3),
    _disclaimer: parsed._disclaimer,
  };
}
