import { describe, expect, it, vi } from "vitest";
import {
  CONVERSATION_TOPICS,
  buildConversationPromptMessages,
  buildConversationPromptSystemPrompt,
  buildConversationPromptUserMessage,
  fetchConversationPrompt,
  parseConversationPromptResponse,
  validateConversationPromptInput,
} from "../conversation-prompt";

describe("validateConversationPromptInput", () => {
  it("accepts a valid request", () => {
    expect(validateConversationPromptInput({ topic: "kindness", ageBand: "7-9" })).toEqual({
      ok: true,
      value: { topic: "kindness", ageBand: "7-9" },
    });
  });

  it("accepts every listed topic", () => {
    for (const topic of CONVERSATION_TOPICS) {
      const result = validateConversationPromptInput({ topic, ageBand: "4-6" });
      expect(result.ok).toBe(true);
    }
  });

  it("rejects an unknown topic", () => {
    const result = validateConversationPromptInput({ topic: "curiosity", ageBand: "7-9" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/topic must be one of/);
  });

  it("rejects an invalid age band", () => {
    const result = validateConversationPromptInput({ topic: "kindness", ageBand: "13-15" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ageBand must be one of/);
  });

  it("rejects non-object bodies", () => {
    for (const body of [null, undefined, "kindness", 42, []]) {
      expect(validateConversationPromptInput(body).ok).toBe(false);
    }
  });

  it("rejects missing fields", () => {
    expect(validateConversationPromptInput({ topic: "kindness" }).ok).toBe(false);
    expect(validateConversationPromptInput({ ageBand: "7-9" }).ok).toBe(false);
    expect(validateConversationPromptInput({}).ok).toBe(false);
  });

  it("ignores extra fields (no kid PII accepted)", () => {
    const result = validateConversationPromptInput({
      topic: "honesty",
      ageBand: "10-12",
      childFirstName: "Alex",
    });
    expect(result).toEqual({
      ok: true,
      value: { topic: "honesty", ageBand: "10-12" },
    });
  });
});

describe("buildConversationPromptMessages", () => {
  const messages = buildConversationPromptMessages({ topic: "patience", ageBand: "4-6" });

  it("keeps the safety framing: parents only, no open chat", () => {
    const system = buildConversationPromptSystemPrompt();
    expect(system).toMatch(/PARENTS \(never children\)/);
    expect(system).toMatch(/Never engage in open-ended chat/);
    expect(messages[0]).toEqual({ role: "system", content: system });
  });

  it("carries only topic + age band in the user message", () => {
    const user = buildConversationPromptUserMessage({ topic: "patience", ageBand: "4-6" });
    expect(user).toContain('"patience"');
    expect(user).toContain("4-6");
    expect(user).not.toMatch(/name|child/i);
    expect(messages[1]).toEqual({ role: "user", content: user });
  });
});

describe("parseConversationPromptResponse", () => {
  it("accepts plain prompt text", () => {
    expect(parseConversationPromptResponse("Tell me about a time you waited patiently.")).toBe(
      "Tell me about a time you waited patiently.",
    );
  });

  it("strips wrapping quotes and list markers", () => {
    expect(parseConversationPromptResponse('"What made you proud today?"')).toBe(
      "What made you proud today?",
    );
    expect(parseConversationPromptResponse("1. Tell me about a kind moment this week.")).toBe(
      "Tell me about a kind moment this week.",
    );
  });

  it("salvages a JSON-wrapped prompt", () => {
    expect(
      parseConversationPromptResponse(JSON.stringify({ prompt: "Who helped you today?" })),
    ).toBe("Who helped you today?");
  });

  it("keeps only the first paragraph", () => {
    expect(parseConversationPromptResponse("First question?\nSecond question?")).toBe(
      "First question?",
    );
  });

  it("returns null for empty or overlong output", () => {
    expect(parseConversationPromptResponse("")).toBeNull();
    expect(parseConversationPromptResponse("   ")).toBeNull();
    expect(parseConversationPromptResponse("x".repeat(500))).toBeNull();
  });
});

describe("fetchConversationPrompt", () => {
  let lastInit: RequestInit | undefined;
  let lastUrl: string | undefined;
  const goodFetch = vi.fn(async (url: string, init?: RequestInit) => {
    lastUrl = url;
    lastInit = init;
    return new Response(JSON.stringify({ prompt: "What kind thing did you do today?" }), {
      status: 200,
    });
  });

  it("returns the AI prompt on success", async () => {
    const result = await fetchConversationPrompt({
      fetchFn: goodFetch as typeof fetch,
      token: "parent-token",
      topic: "kindness",
      ageBand: "7-9",
    });
    expect(result).toEqual({ ok: true, prompt: "What kind thing did you do today?" });
    expect(goodFetch).toHaveBeenCalled();
    expect(lastUrl).toBe("/api/ai/conversation-prompt");
    expect(lastInit?.method).toBe("POST");
    expect((lastInit?.headers as Record<string, string>)?.authorization).toBe(
      "Bearer parent-token",
    );
    const body = JSON.parse(lastInit?.body as string) as Record<string, unknown>;
    // No kid PII in the request body.
    expect(Object.keys(body).sort()).toEqual(["ageBand", "topic"]);
  });

  it("does not attempt the fetch when signed out", async () => {
    const fetchFn = vi.fn();
    const result = await fetchConversationPrompt({
      fetchFn: fetchFn as typeof fetch,
      token: null,
      topic: "kindness",
      ageBand: "7-9",
    });
    expect(result).toEqual({ ok: false });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("fails closed on 401 / 503 / bad payload / network error", async () => {
    const failing: Array<() => Promise<Response>> = [
      () => Promise.resolve(new Response(JSON.stringify({ error: "Parent sign-in required." }), { status: 401 })),
      () => Promise.resolve(new Response(JSON.stringify({ error: "nope" }), { status: 503 })),
      () => Promise.resolve(new Response(JSON.stringify({ prompt: "" }), { status: 200 })),
      () => Promise.reject(new Error("network down")),
    ];
    for (const impl of failing) {
      const fetchFn = vi.fn(impl);
      const result = await fetchConversationPrompt({
        fetchFn: fetchFn as typeof fetch,
        token: "parent-token",
        topic: "kindness",
        ageBand: "7-9",
      });
      expect(result).toEqual({ ok: false });
    }
  });
});
