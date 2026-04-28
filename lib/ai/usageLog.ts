import { createServerSupabaseClient } from './serverSupabase.ts';

export interface AIUsageLogInput {
  feature: string;
  model_used?: string;
  tokens_approx?: number;
  latency_ms: number;
  success: boolean;
  error_code?: string;
}

export async function logAIUsage(input: AIUsageLogInput): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    await supabase.from('ai_usage_log').insert({
      feature: input.feature,
      model_used: input.model_used ?? null,
      tokens_approx: input.tokens_approx ?? null,
      latency_ms: input.latency_ms,
      success: input.success,
      error_code: input.error_code ?? null,
    });
  } catch (error) {
    console.warn('AI usage logging failed:', error);
  }
}
