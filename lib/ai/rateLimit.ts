const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limit = 30, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= limit) {
    buckets.set(key, recent);
    const oldest = recent[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  buckets.set(key, recent);

  return {
    allowed: true,
    remaining: Math.max(0, limit - recent.length),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimitForTests(): void {
  buckets.clear();
}
