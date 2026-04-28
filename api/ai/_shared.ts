import { IncomingMessage, ServerResponse } from 'node:http';
import { approximateTokens } from '../../lib/ai/json.ts';
import { checkRateLimit } from '../../lib/ai/rateLimit.ts';
import { logAIUsage } from '../../lib/ai/usageLog.ts';

export type ApiRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[]>;
};

export type ApiResponse = ServerResponse & {
  status?: (code: number) => ApiResponse;
  json?: (body: unknown) => void;
};

export function sendJson(res: ApiResponse, statusCode: number, body: unknown): void {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(body);
    return;
  }

  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export async function readJsonBody<T>(req: ApiRequest): Promise<T> {
  if (req.body && typeof req.body === 'object') return req.body as T;

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) as T : {} as T;
}

export function methodGuard(req: ApiRequest, res: ApiResponse, method = 'POST'): boolean {
  if (req.method === method) return true;
  sendJson(res, 405, { error: 'method_not_allowed' });
  return false;
}

export function featureEnabled(envName: string): boolean {
  return process.env[envName] !== 'false';
}

export function clinicRateLimit(req: ApiRequest, res: ApiResponse, feature: string): boolean {
  const clinicId = req.headers['x-clinic-id']?.toString() ?? 'default-clinic';
  const result = checkRateLimit(`${feature}:${clinicId}`);

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    sendJson(res, 429, { error: 'rate_limited', retryAfterSeconds: result.retryAfterSeconds });
    return false;
  }

  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  return true;
}

export async function withAILog<T>(
  feature: string,
  model: string | undefined,
  payload: unknown,
  action: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await action();
    await logAIUsage({
      feature,
      model_used: model,
      tokens_approx: approximateTokens(payload) + approximateTokens(result),
      latency_ms: Date.now() - start,
      success: true,
    });
    return result;
  } catch (error) {
    await logAIUsage({
      feature,
      model_used: model,
      tokens_approx: approximateTokens(payload),
      latency_ms: Date.now() - start,
      success: false,
      error_code: error instanceof Error ? error.message.slice(0, 120) : 'unknown_error',
    });
    throw error;
  }
}

export function aiUnavailable(res: ApiResponse, error: unknown): void {
  console.warn('NirogAI unavailable:', error);
  sendJson(res, 503, { error: 'ai_unavailable', message: 'AI unavailable' });
}
