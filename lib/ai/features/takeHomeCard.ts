import { callAI } from '../client.ts';
import { ensureDisclaimer, extractJsonObject } from '../json.ts';
import { assertNoPIIKeys, sanitizeForAI } from '../sanitize.ts';

export type PatientCardLanguage = 'hindi' | 'marathi' | 'english';

export interface PatientCardInput {
  front_desk_id: string;
  language: PatientCardLanguage;
  age?: number;
  gender?: string;
  diagnosis_today?: string;
  prescriptions: Array<{
    drug: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
  follow_up_date?: string;
  doctor_advice?: string;
}

export interface PatientCardContent {
  title: string;
  intro: string;
  medications: Array<{
    drug_simple_name: string;
    why: string;
    how: string;
    warning: string;
  }>;
  lifestyle_tips: string[];
  follow_up: string;
  footer: string;
  _disclaimer: string;
}

const ALLOWED_KEYS = [
  'front_desk_id',
  'language',
  'age',
  'gender',
  'diagnosis_today',
  'prescriptions',
  'follow_up_date',
  'doctor_advice',
] as const;

export async function generateTakeHomeCardContent(input: PatientCardInput, aiCaller = callAI): Promise<PatientCardContent> {
  const language = input.language ?? 'hindi';
  const safe = sanitizeForAI(input as unknown as Record<string, unknown>, ALLOWED_KEYS);
  assertNoPIIKeys(safe);

  const systemPrompt = `You are NirogAI, a patient education assistant for Indian clinics.
You receive a patient's prescription details.
Write a friendly, simple patient take-home card in ${language}.
Use simple words. Avoid all medical jargon. Explain WHY they are taking each medicine.
Write as if talking to a 50-year-old Indian patient with 8th-grade education.
Do NOT use the patient's name. Use "Aap" (Hindi) or "Tumhi" (Marathi) to address them.

Output ONLY valid JSON:
{
  "title": "Aapki Dawaiyan aur Sehat - Aaj Ki Jaankari",
  "intro": "friendly 1-2 sentence intro about today's visit",
  "medications": [
    {
      "drug_simple_name": "BP ki dawai",
      "why": "plain language explanation of why they need this",
      "how": "when and how to take it",
      "warning": "one simple warning if any"
    }
  ],
  "lifestyle_tips": ["tip 1", "tip 2"],
  "follow_up": "plain language follow-up reminder",
  "footer": "Yeh card AI ne banaya hai. Apne doctor se poochh-taachh zaroor karein.",
  "_disclaimer": "AI-generated insight. Please verify with clinical judgment."
}`;

  const content = await aiCaller({
    model: process.env.AI_MODEL_PATIENT_CARD ?? '',
    apiKey: process.env.AI_API_KEY_PATIENT_CARD,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(safe) },
    ],
    temperature: 0.5,
    top_p: 0.9,
    frequency_penalty: 0,
    presence_penalty: 0,
    response_format: { type: 'json_object' },
    max_tokens: 1400,
  });

  const parsed = ensureDisclaimer(extractJsonObject<Partial<PatientCardContent>>(content));
  if (!parsed.title || !parsed.intro || !Array.isArray(parsed.medications)) {
    throw new Error('AI response missing patient card fields');
  }

  return {
    title: parsed.title,
    intro: parsed.intro,
    medications: parsed.medications,
    lifestyle_tips: Array.isArray(parsed.lifestyle_tips) ? parsed.lifestyle_tips : [],
    follow_up: parsed.follow_up ?? '',
    footer: parsed.footer ?? 'AI-generated. Verify with clinical judgment.',
    _disclaimer: parsed._disclaimer,
  };
}
