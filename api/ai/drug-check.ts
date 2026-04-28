import { checkDrugConflicts, type DrugCheckerInput } from '../../lib/ai/features/drugChecker.ts';
import { createServerSupabaseClient } from '../../lib/ai/serverSupabase.ts';
import { aiUnavailable, type ApiRequest, type ApiResponse, clinicRateLimit, featureEnabled, methodGuard, readJsonBody, sendJson, withAILog } from './_shared.ts';

interface DrugCheckRequest extends DrugCheckerInput {
  frontDeskId?: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res)) return;
  if (!featureEnabled('AI_FEATURE_DRUG_CHECKER')) {
    sendJson(res, 503, { error: 'feature_disabled', message: 'AI drug checker is disabled' });
    return;
  }
  if (!clinicRateLimit(req, res, 'drug-check')) return;

  try {
    const body = await readJsonBody<DrugCheckRequest>(req);
    if (!body.new_drug) {
      sendJson(res, 400, { error: 'new_drug_required' });
      return;
    }

    const input: DrugCheckerInput = {
      new_drug: body.new_drug,
      existing_medications: body.existing_medications ?? [],
      known_conditions: body.known_conditions ?? [],
      allergies: body.allergies ?? [],
    };

    const result = await withAILog('drug-check', process.env.AI_MODEL_DRUG_CHECKER, input, () => checkDrugConflicts(input));

    if (body.frontDeskId) {
      const supabase = createServerSupabaseClient();
      const { data: existing } = await supabase
        .from('patient_ai_cache')
        .select('drug_check_log')
        .eq('front_desk_id', body.frontDeskId)
        .single();

      const log = Array.isArray(existing?.drug_check_log) ? existing.drug_check_log : [];
      await supabase.from('patient_ai_cache').upsert({
        front_desk_id: body.frontDeskId,
        drug_check_log: [...log.slice(-49), { checked_at: new Date().toISOString(), result }],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'front_desk_id' });
    }

    sendJson(res, 200, result);
  } catch (error) {
    aiUnavailable(res, error);
  }
}
