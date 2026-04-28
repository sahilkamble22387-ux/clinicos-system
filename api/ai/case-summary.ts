import { generateCaseSummary } from '../../lib/ai/features/caseSummary.ts';
import { createServerSupabaseClient } from '../../lib/ai/serverSupabase.ts';
import { aiUnavailable, type ApiRequest, type ApiResponse, clinicRateLimit, featureEnabled, methodGuard, readJsonBody, sendJson, withAILog } from './_shared.ts';

interface CaseSummaryRequest {
  frontDeskId: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res)) return;
  if (!featureEnabled('AI_FEATURE_SUMMARIZER')) {
    sendJson(res, 503, { error: 'feature_disabled', message: 'AI case summarizer is disabled' });
    return;
  }
  if (!clinicRateLimit(req, res, 'case-summary')) return;

  try {
    const { frontDeskId } = await readJsonBody<CaseSummaryRequest>(req);
    if (!frontDeskId) {
      sendJson(res, 400, { error: 'frontDeskId_required' });
      return;
    }

    const supabase = createServerSupabaseClient();
    const { data: patient, error } = await supabase
      .from('patients')
      .select('id, front_desk_id, gender, dob')
      .eq('front_desk_id', frontDeskId)
      .single();

    if (error || !patient) {
      sendJson(res, 404, { error: 'patient_not_found' });
      return;
    }

    const [{ data: records }, { data: appointments }] = await Promise.all([
      supabase
        .from('medical_records')
        .select('id, diagnosis, doctor_notes, created_at')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('appointments')
        .select('chief_complaint, bp_systolic, bp_diastolic, heart_rate, weight_kg, temperature_f, created_at')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const recordIds = (records ?? []).map((record) => record.id);
    const { data: items } = recordIds.length > 0
      ? await supabase
        .from('prescription_items')
        .select('medical_record_id, medicine_name, dosage, duration')
        .in('medical_record_id', recordIds)
      : { data: [] as Array<{ medical_record_id: string; medicine_name: string; dosage: string; duration: string }> };

    const age = patient.dob
      ? Math.max(0, new Date().getFullYear() - new Date(patient.dob).getFullYear())
      : undefined;

    const safePatientContext = {
      front_desk_id: patient.front_desk_id,
      age,
      gender: patient.gender ?? undefined,
      diagnoses: (records ?? []).map((record) => record.diagnosis).filter(Boolean),
      medications: (items ?? []).map((item) => item.medicine_name).filter(Boolean),
      vitals: (appointments ?? []).map((appointment) => ({
        date: appointment.created_at,
        bp: appointment.bp_systolic && appointment.bp_diastolic ? `${appointment.bp_systolic}/${appointment.bp_diastolic}` : null,
        heart_rate: appointment.heart_rate,
        weight_kg: appointment.weight_kg,
        temperature_f: appointment.temperature_f,
      })),
      chief_complaints: (appointments ?? []).map((appointment) => appointment.chief_complaint).filter(Boolean),
      last_visit_notes: records?.[0]?.doctor_notes ?? undefined,
      visit_history: (records ?? []).map((record) => ({
        date: record.created_at,
        diagnosis: record.diagnosis,
        notes: record.doctor_notes,
      })),
    };

    const result = await withAILog('case-summary', process.env.AI_MODEL_SUMMARIZER, safePatientContext, () => generateCaseSummary(safePatientContext));

    await supabase.from('patient_ai_cache').upsert({
      front_desk_id: frontDeskId,
      case_summary: result.summary,
      case_summary_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'front_desk_id' });

    sendJson(res, 200, result);
  } catch (error) {
    aiUnavailable(res, error);
  }
}
