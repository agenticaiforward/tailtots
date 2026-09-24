/**
 * Tiny in-memory token-bucket rate limiter.
 *
 * Pure apart from the clock (injectable for tests). Used by the Worker to
 * cap abuse of the AI endpoint per client IP. State lives in the Worker
 * isolate's memory, so limits are best-effort per isolate — good enough
 * as a guardrail, not a security boundary.
 */
export class InMemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxHits: number,
    private readonly windowMs: number,
  ) {
    if (!Number.isFinite(maxHits) || maxHits <= 0) {
      throw new Error("maxHits must be a positive number");
    }
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      throw new Error("windowMs must be a positive number");
    }
  }

  /**
   * Returns true when `key` has already used its allowance inside the
   * window (the hit is NOT recorded). Otherwise records the hit and
   * returns false.
   */
  isLimited(key: string, now: number = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.maxHits) {
      this.hits.set(key, recent);
      return true;
    }
    recent.push(now);
    this.hits.set(key, recent);
    // Keep memory bounded if many distinct keys appear.
    if (this.hits.size > 10000) this.hits.clear();
    return false;
  }
}
