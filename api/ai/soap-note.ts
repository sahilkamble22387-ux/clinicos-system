import { generateSoapNote } from '../../lib/ai/features/soapScribe.ts';
import { createServerSupabaseClient } from '../../lib/ai/serverSupabase.ts';
import { aiUnavailable, type ApiRequest, type ApiResponse, clinicRateLimit, featureEnabled, methodGuard, readJsonBody, sendJson, withAILog } from './_shared.ts';

interface SoapNoteRequest {
  transcript: string;
  visitId?: string;
  medicalRecordId?: string;
  frontDeskId?: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res)) return;
  if (!featureEnabled('AI_FEATURE_SCRIBE')) {
    sendJson(res, 503, { error: 'feature_disabled', message: 'AI SOAP scribe is disabled' });
    return;
  }
  if (!clinicRateLimit(req, res, 'soap-note')) return;

  try {
    const body = await readJsonBody<SoapNoteRequest>(req);
    if (!body.transcript) {
      sendJson(res, 400, { error: 'transcript_required' });
      return;
    }

    const result = await withAILog('soap-note', process.env.AI_MODEL_SCRIBE, { transcript: body.transcript }, () => generateSoapNote(body.transcript));
    const supabase = createServerSupabaseClient();

    if (body.medicalRecordId) {
      await supabase.from('medical_records').update({
        soap_note: result,
        ai_scribe_transcript: body.transcript,
        ai_flags: result.flag ? { soap_flag: result.flag } : null,
      }).eq('id', body.medicalRecordId);
    }

    if (body.frontDeskId) {
      const { data: existing } = await supabase
        .from('patient_ai_cache')
        .select('soap_notes')
        .eq('front_desk_id', body.frontDeskId)
        .single();

      const notes = Array.isArray(existing?.soap_notes) ? existing.soap_notes : [];
      await supabase.from('patient_ai_cache').upsert({
        front_desk_id: body.frontDeskId,
        soap_notes: [...notes, { visit_id: body.visitId ?? null, medical_record_id: body.medicalRecordId ?? null, created_at: new Date().toISOString(), ...result }],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'front_desk_id' });
    }

    sendJson(res, 200, result);
  } catch (error) {
    aiUnavailable(res, error);
  }
}
