import { transcribeAudio } from '../../lib/ai/client.ts';
import { createServerSupabaseClient } from '../../lib/ai/serverSupabase.ts';
import { aiUnavailable, type ApiRequest, type ApiResponse, clinicRateLimit, featureEnabled, methodGuard, readJsonBody, sendJson, withAILog } from './_shared.ts';

interface TranscribeRequest {
  audioBase64?: string;
  mimeType?: string;
  filename?: string;
  typedTranscript?: string;
  storagePath?: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res)) return;
  if (!featureEnabled('AI_FEATURE_SCRIBE')) {
    sendJson(res, 503, { error: 'feature_disabled', message: 'AI transcription is disabled' });
    return;
  }
  if (!clinicRateLimit(req, res, 'transcribe')) return;

  try {
    const body = await readJsonBody<TranscribeRequest>(req);
    if (body.typedTranscript) {
      sendJson(res, 200, { transcript: body.typedTranscript, source: 'typed_fallback' });
      return;
    }
    if (!body.audioBase64) {
      sendJson(res, 400, { error: 'audioBase64_or_typedTranscript_required' });
      return;
    }
    if (!process.env.AI_TRANSCRIPTION_URL) {
      sendJson(res, 503, { error: 'transcription_unavailable', message: 'Typed transcript fallback is available' });
      return;
    }

    const supabase = createServerSupabaseClient();
    const buffer = Buffer.from(body.audioBase64, 'base64');
    const mimeType = body.mimeType ?? 'audio/webm';
    const filename = body.filename ?? `voice-note-${Date.now()}.webm`;
    const storagePath = body.storagePath ?? `ai-scribe/${Date.now()}-${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('private-voice-notes')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) throw uploadError;

    try {
      const blob = new Blob([buffer], { type: mimeType });
      const transcript = await withAILog('transcribe', process.env.AI_TRANSCRIPTION_MODEL, { audio_bytes: buffer.byteLength }, () =>
        transcribeAudio({ file: blob, filename, mimeType, apiKey: process.env.AI_TRANSCRIPTION_API_KEY })
      );
      await supabase.storage.from('private-voice-notes').remove([storagePath]);
      sendJson(res, 200, { transcript, source: 'audio' });
    } catch (error) {
      await supabase.storage.from('private-voice-notes').remove([storagePath]);
      throw error;
    }
  } catch (error) {
    aiUnavailable(res, error);
  }
}
