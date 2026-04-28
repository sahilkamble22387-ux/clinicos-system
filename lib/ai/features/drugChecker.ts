import { callAI } from '../client.ts';
import { ensureDisclaimer, extractJsonObject } from '../json.ts';
import { assertNoPIIKeys, sanitizeForAI } from '../sanitize.ts';

export interface DrugCheckerInput {
  new_drug: string;
  existing_medications?: string[];
  known_conditions?: string[];
  allergies?: string[];
}

export interface DrugConflict {
  type: 'drug-drug' | 'drug-condition' | 'allergy';
  with: string;
  reason: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
}

export interface DrugCheckerOutput {
  risk_level: 'none' | 'low' | 'moderate' | 'high' | 'critical';
  conflicts: DrugConflict[];
  recommendation: string;
  _disclaimer: string;
}

const SYSTEM_PROMPT = `You are NirogAI, a clinical safety assistant for Indian clinics.
You receive a new drug being considered and the patient's existing medications and conditions.
Check for: drug-drug interactions, drug-condition contraindications, allergy conflicts.
Use your pharmacological knowledge. Be concise, be accurate.

Respond ONLY in JSON:
{
  "risk_level": "none | low | moderate | high | critical",
  "conflicts": [
    {
      "type": "drug-drug | drug-condition | allergy",
      "with": "the existing drug or condition it conflicts with",
      "reason": "brief clinical explanation",
      "severity": "low | moderate | high | critical"
    }
  ],
  "recommendation": "one-line actionable recommendation for the doctor",
  "_disclaimer": "AI-generated insight. Please verify with clinical judgment."
}`;

const ALLOWED_KEYS = ['new_drug', 'existing_medications', 'known_conditions', 'allergies'] as const;

export async function checkDrugConflicts(input: DrugCheckerInput, aiCaller = callAI): Promise<DrugCheckerOutput> {
  const safe = sanitizeForAI(input as unknown as Record<string, unknown>, ALLOWED_KEYS);
  assertNoPIIKeys(safe);

  const content = await aiCaller({
    model: process.env.AI_MODEL_DRUG_CHECKER ?? '',
    apiKey: process.env.AI_API_KEY_DRUG_CHECKER,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(safe) },
    ],
    temperature: 0.2,
    top_p: 0.8,
    response_format: { type: 'json_object' },
    max_tokens: 700,
  });

  const parsed = ensureDisclaimer(extractJsonObject<Partial<DrugCheckerOutput>>(content));
  if (!parsed.risk_level || !Array.isArray(parsed.conflicts) || !parsed.recommendation) {
    throw new Error('AI response missing drug conflict fields');
  }

  return {
    risk_level: parsed.risk_level,
    conflicts: parsed.conflicts,
    recommendation: parsed.recommendation,
    _disclaimer: parsed._disclaimer,
  };
}
