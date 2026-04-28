import { callAI } from '../client.ts';
import { ensureDisclaimer, extractJsonObject } from '../json.ts';
import { assertNoPIIKeys, PATIENT_SAFE_KEYS, sanitizeForAI } from '../sanitize.ts';

export interface CaseSummaryInput {
  front_desk_id: string;
  age?: number;
  gender?: string;
  diagnoses?: string[];
  medications?: string[];
  vitals?: unknown[];
  visit_history?: unknown[];
  chief_complaints?: string[];
  allergies?: string[];
  missed_doses_flag?: boolean;
  last_visit_notes?: string;
}

export interface CaseSummaryOutput {
  summary: string;
  _disclaimer: string;
}

const SYSTEM_PROMPT = `You are NirogAI, a clinical assistant for Indian clinics.
You receive anonymized patient data (no names, no phone numbers).
Your job: write ONE sentence summarizing the patient's current clinical picture.
Focus on: chronic conditions, last vitals, medication adherence issues.
Always include "_disclaimer": "AI-generated insight. Please verify with clinical judgment."
Respond ONLY in JSON: { "summary": "...", "_disclaimer": "AI-generated insight. Please verify with clinical judgment." }`;

export async function generateCaseSummary(input: CaseSummaryInput, aiCaller = callAI): Promise<CaseSummaryOutput> {
  const safe = sanitizeForAI(input as unknown as Record<string, unknown>, PATIENT_SAFE_KEYS);
  assertNoPIIKeys(safe);

  const content = await aiCaller({
    model: process.env.AI_MODEL_SUMMARIZER ?? '',
    apiKey: process.env.AI_API_KEY_SUMMARIZER,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(safe) },
    ],
    temperature: 0.3,
    top_p: 0.9,
    response_format: { type: 'json_object' },
    max_tokens: 220,
  });

  const parsed = ensureDisclaimer(extractJsonObject<{ summary?: string; _disclaimer?: string }>(content));
  if (!parsed.summary) throw new Error('AI response missing summary');

  return {
    summary: parsed.summary,
    _disclaimer: parsed._disclaimer,
  };
}
