import { generateTakeHomeCardContent, type PatientCardInput } from '../../lib/ai/features/takeHomeCard.ts';
import { generatePatientCardPdf } from '../../lib/pdf/generatePatientCard.ts';
import { createServerSupabaseClient } from '../../lib/ai/serverSupabase.ts';
import { aiUnavailable, type ApiRequest, type ApiResponse, clinicRateLimit, featureEnabled, methodGuard, readJsonBody, sendJson, withAILog } from './_shared.ts';

interface PatientCardRequest extends PatientCardInput {
  clinicId?: string;
  format?: 'json' | 'pdf';
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res)) return;
  if (!featureEnabled('AI_FEATURE_PATIENT_CARD')) {
    sendJson(res, 503, { error: 'feature_disabled', message: 'AI patient card is disabled' });
    return;
  }
  if (!clinicRateLimit(req, res, 'patient-card')) return;

  try {
    const body = await readJsonBody<PatientCardRequest>(req);
    if (!body.front_desk_id || !Array.isArray(body.prescriptions)) {
      sendJson(res, 400, { error: 'front_desk_id_and_prescriptions_required' });
      return;
    }

    const input: PatientCardInput = {
      front_desk_id: body.front_desk_id,
      language: body.language ?? 'hindi',
      age: body.age,
      gender: body.gender,
      diagnosis_today: body.diagnosis_today,
      prescriptions: body.prescriptions,
      follow_up_date: body.follow_up_date,
      doctor_advice: body.doctor_advice,
    };

    const content = await withAILog('patient-card', process.env.AI_MODEL_PATIENT_CARD, input, () => generateTakeHomeCardContent(input));

    if (body.format !== 'pdf') {
      sendJson(res, 200, { card: content });
      return;
    }

    let clinicLogoBase64: string | undefined;
    if (body.clinicId) {
      const supabase = createServerSupabaseClient();
      const { data: clinic } = await supabase.from('clinics').select('stamp_base64, doctor_signature_base64').eq('id', body.clinicId).single();
      clinicLogoBase64 = clinic?.stamp_base64 ?? clinic?.doctor_signature_base64 ?? undefined;
    }

    const pdf = generatePatientCardPdf({
      frontDeskId: input.front_desk_id,
      content,
      clinicLogoBase64,
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="nirogai-${input.front_desk_id}.pdf"`);
    res.end(Buffer.from(pdf));
  } catch (error) {
    aiUnavailable(res, error);
  }
}
