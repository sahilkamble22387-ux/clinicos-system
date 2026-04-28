import { generateClinicalSuggestions } from '../../lib/ai/features/clinicalSuggestions.ts';
import { aiUnavailable, type ApiRequest, type ApiResponse, clinicRateLimit, featureEnabled, methodGuard, readJsonBody, sendJson, withAILog } from './_shared.ts';

interface ClinicalSuggestionsRequest {
  symptoms?: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res)) return;
  if (!featureEnabled('AI_FEATURE_SUMMARIZER')) {
    sendJson(res, 503, { error: 'feature_disabled', message: 'AI suggestions are disabled' });
    return;
  }
  if (!clinicRateLimit(req, res, 'clinical-suggestions')) return;

  try {
    const body = await readJsonBody<ClinicalSuggestionsRequest>(req);
    if (!body.symptoms?.trim()) {
      sendJson(res, 400, { error: 'symptoms_required' });
      return;
    }

    const result = await withAILog(
      'clinical-suggestions',
      process.env.AI_MODEL_SUMMARIZER,
      { symptoms: body.symptoms },
      () => generateClinicalSuggestions({ symptoms: body.symptoms! })
    );

    sendJson(res, 200, result);
  } catch (error) {
    aiUnavailable(res, error);
  }
}
