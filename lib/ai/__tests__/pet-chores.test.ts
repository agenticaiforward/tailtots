import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PET_CHORE_SKILLS,
  buildLocalPetChoreSet,
  buildPetChoreSystemPrompt,
  buildPetChoreUserMessage,
  fetchPetChores,
  loadChoreHistory,
  parsePetChoreResponse,
  saveChoreHistory,
  validatePetChoreInput,
} from "../pet-chores";

describe("validatePetChoreInput", () => {
  it("accepts a valid request", () => {
    const result = validatePetChoreInput({
      skill: "responsibility",
      ageBand: "7-9",
      pets: [{ name: "Jack", species: "Guinea pig" }],
      goal: "Morning routine",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.skill).toBe("responsibility");
      expect(result.value.pets).toEqual([{ name: "Jack", species: "Guinea pig" }]);
      expect(result.value.goal).toBe("Morning routine");
    }
  });

  it("accepts every listed skill", () => {
    for (const skill of PET_CHORE_SKILLS) {
      const result = validatePetChoreInput({ skill, ageBand: "4-6", pets: [{ name: "A", species: "Dog" }] });
      expect(result.ok).toBe(true);
    }
  });

  it("rejects an unknown skill", () => {
    const result = validatePetChoreInput({ skill: "flying", ageBand: "7-9", pets: [{ name: "A", species: "Dog" }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/skill must be one of/);
  });

  it("rejects a bad age band", () => {
    const result = validatePetChoreInput({ skill: "time", ageBand: "13-15", pets: [{ name: "A", species: "Dog" }] });
    expect(result.ok).toBe(false);
  });

  it("rejects empty or missing pets", () => {
    expect(validatePetChoreInput({ skill: "time", ageBand: "7-9", pets: [] }).ok).toBe(false);
    expect(validatePetChoreInput({ skill: "time", ageBand: "7-9" }).ok).toBe(false);
  });

  it("rejects pets without name/species", () => {
    const result = validatePetChoreInput({ skill: "time", ageBand: "7-9", pets: [{ name: "", species: "Dog" }] });
    expect(result.ok).toBe(false);
  });

  it("rejects non-object bodies", () => {
    for (const body of [null, undefined, "responsibility", 42, []]) {
      expect(validatePetChoreInput(body).ok).toBe(false);
    }
  });

  it("goal is optional and capped", () => {
    expect(validatePetChoreInput({ skill: "time", ageBand: "7-9", pets: [{ name: "A", species: "Dog" }] }).ok).toBe(true);
    expect(
      validatePetChoreInput({ skill: "time", ageBand: "7-9", pets: [{ name: "A", species: "Dog" }], goal: "x".repeat(201) }).ok,
    ).toBe(false);
  });
});

describe("parsePetChoreResponse", () => {
  it("parses a valid JSON chore array", () => {
    const text = JSON.stringify([
      { title: "Feed Jack", detail: "One scoop", skill: "responsibility", difficulty: "easy", points: 10 },
      { title: "Brush Jack", skill: "empathy" },
    ]);
    const chores = parsePetChoreResponse(text);
    expect(chores).not.toBeNull();
    expect(chores).toHaveLength(2);
    expect(chores![0].title).toBe("Feed Jack");
    expect(chores![1].difficulty).toBe("easy");
    expect(chores![1].points).toBe(10);
  });

  it("rejects non-JSON, non-arrays, bad skills, and tiny sets", () => {
    expect(parsePetChoreResponse("not json")).toBeNull();
    expect(parsePetChoreResponse(JSON.stringify({ title: "x" }))).toBeNull();
    expect(parsePetChoreResponse(JSON.stringify([{ title: "x", skill: "flying" }]))).toBeNull();
    expect(parsePetChoreResponse(JSON.stringify([{ title: "only one", skill: "time" }]))).toBeNull();
  });
});

describe("buildLocalPetChoreSet", () => {
  it("builds 5 chores from the family's exact pets with the picked skill first", () => {
    const chores = buildLocalPetChoreSet(
      [
        { id: "p1", name: "Jack", species: "Guinea pig" },
        { id: "p2", name: "Bella", species: "Dog" },
      ],
      "empathy",
      "7-9",
    );
    expect(chores).toHaveLength(5);
    expect(chores[0].skill).toBe("empathy");
    // Every chore names a real family pet; species-appropriate detail exists.
    for (const chore of chores) {
      expect(["Jack", "Bella"]).toContain(chore.petName);
      expect(chore.title).toContain(chore.petName!);
      expect(chore.detail.length).toBeGreaterThan(0);
      expect(chore.points).toBeGreaterThan(0);
    }
    const skills = new Set(chores.map((c) => c.skill));
    expect(skills.size).toBeGreaterThanOrEqual(4);
  });

  it("keeps young kids on easy chores", () => {
    const chores = buildLocalPetChoreSet([{ name: "Nemo", species: "Fish" }], "responsibility", "4-6");
    expect(chores.every((c) => c.difficulty === "easy")).toBe(true);
  });

  it("returns an empty set when the family has no pets", () => {
    expect(buildLocalPetChoreSet([], "responsibility", "7-9")).toEqual([]);
  });
});

describe("message builders", () => {
  it("mentions the exact pets and focus skill", () => {
    const message = buildPetChoreUserMessage({
      skill: "teamwork",
      ageBand: "10-12",
      pets: [{ name: "Jack", species: "Guinea pig" }],
      goal: "Weekend deep clean",
    });
    expect(message).toContain("teamwork");
    expect(message).toContain("Jack (Guinea pig)");
    expect(buildPetChoreSystemPrompt()).toContain("JSON array");
  });
});

describe("fetchPetChores", () => {
  it("returns ok:false without a token", async () => {
    const result = await fetchPetChores({ token: "", skill: "time", ageBand: "7-9", pets: [] });
    expect(result).toEqual({ ok: false });
  });

  it("posts to the endpoint and parses chores", async () => {
    const payload = JSON.stringify([
      { title: "Feed Jack", detail: "One scoop", skill: "responsibility", difficulty: "easy", points: 10 },
      { title: "Brush Jack", skill: "empathy" },
    ]);
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ chores: payload }), { status: 200 }),
    );
    const result = await fetchPetChores({
      fetchFn: fetchFn as unknown as typeof fetch,
      token: "tok",
      skill: "responsibility",
      ageBand: "7-9",
      pets: [{ name: "Jack", species: "Guinea pig" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.chores[0].title).toBe("Feed Jack");
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/ai/pet-chores",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    expect(body.pets).toEqual([{ name: "Jack", species: "Guinea pig" }]);
    expect(body).not.toHaveProperty("childName");
  });

  it("returns ok:false when the endpoint fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("down");
    });
    const result = await fetchPetChores({
      fetchFn: fetchFn as unknown as typeof fetch,
      token: "tok",
      skill: "time",
      ageBand: "7-9",
      pets: [{ name: "A", species: "Dog" }],
    });
    expect(result).toEqual({ ok: false });
  });
});

describe("chore history storage", () => {
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

  it("round-trips records and caps at 20", () => {
    const records = Array.from({ length: 25 }, (_, i) => ({
      id: `r-${i}`,
      dateKey: "2026-10-06",
      skill: "responsibility" as const,
      petNames: ["Jack"],
      chores: [],
      source: "demo" as const,
    }));
    saveChoreHistory(records);
    const loaded = loadChoreHistory();
    expect(loaded).toHaveLength(20);
    expect(loaded[0].id).toBe("r-0");
  });
});
