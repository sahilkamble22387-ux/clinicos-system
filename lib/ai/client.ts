// Provider-agnostic OpenAI-compatible client.
// To switch from NVIDIA -> Groq -> OpenRouter: change .env only.

const AI_BASE_URL = process.env.AI_PROVIDER_URL;
const AI_API_KEY = process.env.AI_API_KEY;
const AI_TIMEOUT_MS = 15_000;

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  response_format?: { type: 'json_object' | 'text' };
  apiKey?: string;
  extra_body?: Record<string, unknown>;
}

export interface TranscriptionOptions {
  file: Blob;
  filename?: string;
  mimeType?: string;
  model?: string;
  apiKey?: string;
  responseFormat?: 'json' | 'text' | 'verbose_json';
  temperature?: number;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI provider timeout after 15 seconds');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function performChatCompletion(
  baseUrl: string,
  apiKey: string,
  options: AIRequestOptions
): Promise<string> {
  return withTimeout(async (signal) => {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        top_p: options.top_p,
        max_tokens: options.max_tokens ?? 1024,
        frequency_penalty: options.frequency_penalty,
        presence_penalty: options.presence_penalty,
        ...(options.response_format && { response_format: options.response_format }),
        ...(options.extra_body ?? {}),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI provider error [${response.status}]: ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  });
}

export async function callAI(options: AIRequestOptions): Promise<string> {
  const baseUrl = requireEnv('AI_PROVIDER_URL', AI_BASE_URL);
  const apiKey = requireEnv('AI_API_KEY', options.apiKey ?? AI_API_KEY);

  try {
    return await performChatCompletion(baseUrl, apiKey, options);
  } catch (error) {
    const fallbackModel = process.env.AI_MODEL_FALLBACK_GENERAL;
    const fallbackApiKey = process.env.AI_API_KEY_FALLBACK_GENERAL;
    const shouldRetryWithFallback =
      !!fallbackModel &&
      !!fallbackApiKey &&
      fallbackModel !== options.model &&
      error instanceof Error &&
      (error.message.includes('timeout') || error.message.includes('AI provider error'));

    if (!shouldRetryWithFallback) throw error;

    return performChatCompletion(baseUrl, fallbackApiKey, {
      ...options,
      model: fallbackModel,
      apiKey: fallbackApiKey,
      extra_body: undefined,
      max_tokens: Math.min(options.max_tokens ?? 1024, 768),
      temperature: options.temperature ?? 0.2,
    });
  }
}

export async function transcribeAudio(options: TranscriptionOptions): Promise<string> {
  const transcriptionUrl = process.env.AI_TRANSCRIPTION_URL;
  if (!transcriptionUrl) {
    throw new Error('AI_TRANSCRIPTION_URL is not configured');
  }

  const apiKey = requireEnv('AI_API_KEY', options.apiKey ?? process.env.AI_TRANSCRIPTION_API_KEY ?? AI_API_KEY);
  const form = new FormData();
  form.append('file', options.file, options.filename ?? 'voice-note.webm');
  form.append('model', options.model ?? process.env.AI_TRANSCRIPTION_MODEL ?? 'whisper-large-v3');
  form.append('response_format', options.responseFormat ?? process.env.AI_TRANSCRIPTION_RESPONSE_FORMAT ?? 'verbose_json');
  form.append('temperature', String(options.temperature ?? Number(process.env.AI_TRANSCRIPTION_TEMPERATURE ?? '0')));

  return withTimeout(async (signal) => {
    const response = await fetch(transcriptionUrl, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI transcription error [${response.status}]: ${err}`);
    }

    const data = await response.json();
    return data.text ?? data.transcript ?? data.segments?.map((s: { text?: string }) => s.text ?? '').join(' ') ?? '';
  });
}
