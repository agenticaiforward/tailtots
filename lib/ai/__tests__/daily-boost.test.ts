import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUDDY_BOOST_CATEGORIES,
  buildDailyBoostMessages,
  buildDailyBoostSystemPrompt,
  buildDailyBoostUserMessage,
  dailyBoostCacheKey,
  fetchDailyBoost,
  gatedBoostSlot,
  isValidDailyBoost,
  parseDailyBoostResponse,
  readDailyBoostCache,
  todayLocalDateKey,
  validateDailyBoostInput,
  writeDailyBoostCache,
  type CachedDailyBoost,
} from "../daily-boost";

const validBody = {
  date: "2026-10-06",
  ageBand: "7-9",
  categories: ["Pet care", "Kindness & feelings"],
};

const validBoost: CachedDailyBoost = {
  date: "2026-10-06",
  question: "What is one thing your pet did today that made you smile?",
  questionCategory: "Pet care",
  mission: "Give your pet a 10-second calm check: food, water, cozy spot.",
  missionCategory: "Pet care",
  encouragement: "Small care done every day becomes a big, kind habit.",
  encouragementCategory: "Kindness & feelings",
};

describe("validateDailyBoostInput", () => {
  it("accepts a valid request", () => {
    expect(validateDailyBoostInput(validBody)).toEqual({ ok: true, value: validBody });
  });

  it("accepts every listed category", () => {
    for (const category of BUDDY_BOOST_CATEGORIES) {
      const result = validateDailyBoostInput({ ...validBody, categories: [category] });
      expect(result.ok).toBe(true);
    }
  });

  it("rejects a malformed or impossible date", () => {
    expect(validateDailyBoostInput({ ...validBody, date: "10/06/2026" }).ok).toBe(false);
    expect(validateDailyBoostInput({ ...validBody, date: "2026-13-40" }).ok).toBe(false);
    expect(validateDailyBoostInput({ ...validBody, date: 20261006 }).ok).toBe(false);
  });

  it("rejects an invalid age band", () => {
    expect(validateDailyBoostInput({ ...validBody, ageBand: "13-15" }).ok).toBe(false);
  });

  it("rejects empty or unlisted categories", () => {
    expect(validateDailyBoostInput({ ...validBody, categories: [] }).ok).toBe(false);
    expect(validateDailyBoostInput({ ...validBody, categories: ["Screen time"] }).ok).toBe(false);
    expect(validateDailyBoostInput({ ...validBody, categories: "Pet care" }).ok).toBe(false);
  });

  it("rejects non-object bodies", () => {
    for (const body of [null, undefined, "x", 42, []]) {
      expect(validateDailyBoostInput(body).ok).toBe(false);
    }
  });

  it("ignores extra fields (no kid PII accepted)", () => {
    const result = validateDailyBoostInput({ ...validBody, childFirstName: "Alex" });
    expect(result).toEqual({ ok: true, value: validBody });
  });
});

describe("buildDailyBoostMessages", () => {
  it("keeps the safety framing: JSON only, parent-approved categories, no open chat", () => {
    const system = buildDailyBoostSystemPrompt(["Pet care", "Money & saving"]);
    expect(system).toMatch(/never chat with the child/);
    expect(system).toMatch(/Never engage in open-ended chat/);
    expect(system).toContain('"Pet care"');
    expect(system).toContain('"Money & saving"');
    expect(system).not.toContain('"Screen time"');
  });

  it("carries only date + age band + categories in the user message", () => {
    const messages = buildDailyBoostMessages({
      date: "2026-10-06",
      ageBand: "4-6",
      categories: ["Pet care"],
    });
    const user = buildDailyBoostUserMessage({
      date: "2026-10-06",
      ageBand: "4-6",
      categories: ["Pet care"],
    });
    expect(user).toContain("2026-10-06");
    expect(user).toContain("4-6");
    expect(user).toContain('"Pet care"');
    expect(user).not.toMatch(/name/i);
    expect(messages).toEqual([
      { role: "system", content: buildDailyBoostSystemPrompt(["Pet care"]) },
      { role: "user", content: user },
    ]);
  });
});

describe("parseDailyBoostResponse", () => {
  const payload = {
    question: "What is one thing your pet did today that made you smile?",
    questionCategory: "Pet care",
    mission: "Give your pet a 10-second calm check: food, water, cozy spot.",
    missionCategory: "Pet care",
    encouragement: "Small care done every day becomes a big, kind habit.",
    encouragementCategory: "Kindness & feelings",
  };

  it("parses a clean JSON object", () => {
    expect(parseDailyBoostResponse(JSON.stringify(payload))).toEqual(payload);
  });

  it("salvages JSON embedded in prose", () => {
    expect(parseDailyBoostResponse(`Here you go:\n${JSON.stringify(payload)}\nEnjoy!`)).toEqual(
      payload,
    );
  });

  it("returns null when a field is missing or a category is unlisted", () => {
    const { mission, ...missing } = payload;
    void mission;
    expect(parseDailyBoostResponse(JSON.stringify(missing))).toBeNull();
    expect(
      parseDailyBoostResponse(JSON.stringify({ ...payload, questionCategory: "Screen time" })),
    ).toBeNull();
  });

  it("returns null for empty, non-JSON, or overlong output", () => {
    expect(parseDailyBoostResponse("")).toBeNull();
    expect(parseDailyBoostResponse("just some prose")).toBeNull();
    expect(
      parseDailyBoostResponse(JSON.stringify({ ...payload, question: "x".repeat(500) })),
    ).toBeNull();
  });
});

describe("isValidDailyBoost + cache helpers", () => {
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", fakeLocalStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isValidDailyBoost rejects malformed boosts", () => {
    expect(isValidDailyBoost(validBoost)).toBe(true);
    expect(isValidDailyBoost(null)).toBe(false);
    expect(isValidDailyBoost({ ...validBoost, date: "yesterday" })).toBe(false);
    expect(isValidDailyBoost({ ...validBoost, question: "" })).toBe(false);
    expect(isValidDailyBoost({ ...validBoost, missionCategory: "Screen time" })).toBe(false);
  });

  it("round-trips a valid boost for its date", () => {
    const key = dailyBoostCacheKey("2026-10-06");
    writeDailyBoostCache(key, validBoost);
    expect(readDailyBoostCache(key, "2026-10-06")).toEqual(validBoost);
  });

  it("treats a boost cached for another date as stale", () => {
    const key = dailyBoostCacheKey("2026-10-06");
    writeDailyBoostCache(key, validBoost);
    expect(readDailyBoostCache(key, "2026-10-07")).toBeNull();
  });

  it("returns null for missing or malformed cache entries", () => {
    expect(readDailyBoostCache(dailyBoostCacheKey("2026-10-06"), "2026-10-06")).toBeNull();
    store.set(dailyBoostCacheKey("2026-10-06"), "not json{{{");
    expect(readDailyBoostCache(dailyBoostCacheKey("2026-10-06"), "2026-10-06")).toBeNull();
    store.set(dailyBoostCacheKey("2026-10-06"), JSON.stringify({ date: "2026-10-06" }));
    expect(readDailyBoostCache(dailyBoostCacheKey("2026-10-06"), "2026-10-06")).toBeNull();
  });

  it("no-ops gracefully when localStorage is unavailable (demo/SSR)", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => writeDailyBoostCache(dailyBoostCacheKey("2026-10-06"), validBoost)).not.toThrow();
    expect(readDailyBoostCache(dailyBoostCacheKey("2026-10-06"), "2026-10-06")).toBeNull();
  });

  it("todayLocalDateKey matches the app's local YYYY-MM-DD style", () => {
    expect(todayLocalDateKey(new Date(2026, 9, 6))).toBe("2026-10-06");
    expect(todayLocalDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("gatedBoostSlot", () => {
  it("returns the AI text when its category is parent-allowed", () => {
    expect(gatedBoostSlot(validBoost, ["Pet care", "Kindness & feelings"], "question")).toBe(
      validBoost.question,
    );
    expect(gatedBoostSlot(validBoost, ["Kindness & feelings"], "encouragement")).toBe(
      validBoost.encouragement,
    );
  });

  it("returns null when the category is not parent-allowed", () => {
    expect(gatedBoostSlot(validBoost, ["Money & saving"], "question")).toBeNull();
  });

  it("returns null for a missing or malformed boost", () => {
    expect(gatedBoostSlot(null, ["Pet care"], "question")).toBeNull();
    expect(
      gatedBoostSlot({ ...validBoost, questionCategory: "Hacked" }, ["Pet care"], "question"),
    ).toBeNull();
  });
});

describe("fetchDailyBoost", () => {
  let lastInit: RequestInit | undefined;
  let lastUrl: string | undefined;
  const goodFetch = vi.fn(async (url: string, init?: RequestInit) => {
    lastUrl = url;
    lastInit = init;
    return new Response(JSON.stringify(validBoost), { status: 200 });
  });

  it("returns the AI boost on success, with no kid PII in the request", async () => {
    const result = await fetchDailyBoost({
      fetchFn: goodFetch as typeof fetch,
      token: "parent-token",
      date: "2026-10-06",
      ageBand: "7-9",
      categories: ["Pet care"],
    });
    expect(result).toEqual(validBoost);
    expect(goodFetch).toHaveBeenCalled();
    expect(lastUrl).toBe("/api/ai/daily-boost");
    expect(lastInit?.method).toBe("POST");
    expect((lastInit?.headers as Record<string, string>)?.authorization).toBe(
      "Bearer parent-token",
    );
    const body = JSON.parse(lastInit?.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["ageBand", "categories", "date"]);
  });

  it("does not attempt the fetch when signed out", async () => {
    const fetchFn = vi.fn();
    const result = await fetchDailyBoost({
      fetchFn: fetchFn as typeof fetch,
      token: null,
      date: "2026-10-06",
      ageBand: "7-9",
      categories: ["Pet care"],
    });
    expect(result).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("fails closed on 401 / 503 / bad payload / network error", async () => {
    const failing: Array<() => Promise<Response>> = [
      () => Promise.resolve(new Response(JSON.stringify({ error: "Parent sign-in required." }), { status: 401 })),
      () => Promise.resolve(new Response(JSON.stringify({ error: "nope" }), { status: 503 })),
      () => Promise.resolve(new Response(JSON.stringify({ question: "x" }), { status: 200 })),
      () => Promise.reject(new Error("network down")),
    ];
    for (const impl of failing) {
      const fetchFn = vi.fn(impl);
      const result = await fetchDailyBoost({
        fetchFn: fetchFn as typeof fetch,
        token: "parent-token",
        date: "2026-10-06",
        ageBand: "7-9",
        categories: ["Pet care"],
      });
      expect(result).toBeNull();
    }
  });
});
