import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "../rate-limit";

describe("InMemoryRateLimiter", () => {
  it("allows up to maxHits then blocks", () => {
    const limiter = new InMemoryRateLimiter(3, 60_000);
    expect(limiter.isLimited("ip-1", 0)).toBe(false);
    expect(limiter.isLimited("ip-1", 1_000)).toBe(false);
    expect(limiter.isLimited("ip-1", 2_000)).toBe(false);
    expect(limiter.isLimited("ip-1", 3_000)).toBe(true);
    expect(limiter.isLimited("ip-1", 4_000)).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    expect(limiter.isLimited("a", 0)).toBe(false);
    expect(limiter.isLimited("a", 1)).toBe(true);
    expect(limiter.isLimited("b", 1)).toBe(false);
  });

  it("resets after the window passes", () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    expect(limiter.isLimited("a", 0)).toBe(false);
    expect(limiter.isLimited("a", 1)).toBe(true);
    expect(limiter.isLimited("a", 60_001)).toBe(false);
  });

  it("rejects invalid construction", () => {
    expect(() => new InMemoryRateLimiter(0, 60_000)).toThrow();
    expect(() => new InMemoryRateLimiter(3, 0)).toThrow();
  });
});
