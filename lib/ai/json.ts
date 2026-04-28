export const STANDARD_AI_DISCLAIMER = 'AI-generated insight. Please verify with clinical judgment.';

export function extractJsonObject<T>(content: string): T {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain a JSON object');
  }

  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

export function ensureDisclaimer<T extends Record<string, unknown>>(value: T): T & { _disclaimer: string } {
  return {
    ...value,
    _disclaimer: typeof value._disclaimer === 'string' && value._disclaimer.length > 0
      ? value._disclaimer
      : STANDARD_AI_DISCLAIMER,
  };
}

export function approximateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}
