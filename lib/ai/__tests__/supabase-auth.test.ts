import { describe, expect, it, vi, type Mock } from "vitest";
import {
  authenticateParentRequest,
  extractBearerToken,
  validateParentToken,
} from "../supabase-auth";

const BASE = {
  supabaseUrl: "https://project.supabase.co",
  anonKey: "anon-key",
};

function mockFetch(status: number, jsonBody: unknown): Mock {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(jsonBody), { status }),
  );
}

describe("validateParentToken", () => {
  it("returns the user id for a valid token", async () => {
    const fetchFn = mockFetch(200, { id: "user-123", email: "parent@example.com" });
    const result = await validateParentToken({ ...BASE, token: "valid.jwt", fetchFn });
    expect(result).toEqual({ userId: "user-123" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/auth/v1/user");
    expect(init.headers).toMatchObject({
      apikey: "anon-key",
      Authorization: "Bearer valid.jwt",
    });
  });

  it("strips a trailing slash from the Supabase URL", async () => {
    const fetchFn = mockFetch(200, { id: "user-123" });
    await validateParentToken({ ...BASE, supabaseUrl: "https://project.supabase.co/", token: "t", fetchFn });
    const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/auth/v1/user");
  });

  it("returns null on 401 from the auth endpoint", async () => {
    const result = await validateParentToken({
      ...BASE,
      token: "expired.jwt",
      fetchFn: mockFetch(401, { code: 401, message: "invalid claim: missing sub claim" }),
    });
    expect(result).toBeNull();
  });

  it("returns null on 403 from the auth endpoint", async () => {
    const result = await validateParentToken({
      ...BASE,
      token: "bad.jwt",
      fetchFn: mockFetch(403, { code: 403, message: "forbidden" }),
    });
    expect(result).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const result = await validateParentToken({ ...BASE, token: "t", fetchFn: fetchFn });
    expect(result).toBeNull();
  });

  it("returns null when the response body has no usable user id", async () => {
    for (const body of [{}, { id: "" }, { id: 42 }, null]) {
      const result = await validateParentToken({
        ...BASE,
        token: "t",
        fetchFn: mockFetch(200, body),
      });
      expect(result).toBeNull();
    }
  });

  it("returns null when the body is not valid JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("not json", { status: 200 }));
    const result = await validateParentToken({
      ...BASE,
      token: "t",
      fetchFn: fetchFn,
    });
    expect(result).toBeNull();
  });

  it("short-circuits without a fetch call when the token is missing or empty", async () => {
    for (const token of ["", "   "]) {
      const fetchFn = vi.fn();
      const result = await validateParentToken({
        ...BASE,
        token: token.trim(),
        fetchFn: fetchFn,
      });
      expect(result).toBeNull();
      expect(fetchFn).not.toHaveBeenCalled();
    }
  });

  it("short-circuits without a fetch call when url or anon key is missing", async () => {
    const fetchFn = vi.fn();
    for (const override of [{ supabaseUrl: "" }, { anonKey: "" }]) {
      const result = await validateParentToken({
        ...BASE,
        ...override,
        token: "t",
        fetchFn: fetchFn,
      });
      expect(result).toBeNull();
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("extractBearerToken", () => {
  it("extracts the token from a Bearer header", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("accepts case-insensitive scheme and extra whitespace", () => {
    expect(extractBearerToken("bearer abc")).toBe("abc");
    expect(extractBearerToken("  Bearer   abc  ")).toBe("abc");
  });

  it("returns null for missing or non-Bearer headers", () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken("")).toBeNull();
    expect(extractBearerToken("Basic abc")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
  });
});

describe("authenticateParentRequest", () => {
  it("returns the user id when env and a valid token are present", async () => {
    const result = await authenticateParentRequest({
      supabaseUrl: BASE.supabaseUrl,
      anonKey: BASE.anonKey,
      authorizationHeader: "Bearer valid.jwt",
      fetchFn: mockFetch(200, { id: "user-123" }),
    });
    expect(result).toEqual({ userId: "user-123" });
  });

  it("returns null when env vars are missing (handler turns this into 503)", async () => {
    const fetchFn = vi.fn();
    for (const options of [
      { supabaseUrl: undefined, anonKey: BASE.anonKey },
      { supabaseUrl: BASE.supabaseUrl, anonKey: undefined },
      { supabaseUrl: undefined, anonKey: undefined },
    ]) {
      const result = await authenticateParentRequest({
        ...options,
        authorizationHeader: "Bearer t",
        fetchFn: fetchFn,
      });
      expect(result).toBeNull();
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns null when the Authorization header is missing or malformed", async () => {
    const fetchFn = vi.fn();
    for (const authorizationHeader of [null, "", "Basic abc", "Bearer"]) {
      const result = await authenticateParentRequest({
        ...BASE,
        authorizationHeader,
        fetchFn: fetchFn,
      });
      expect(result).toBeNull();
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns null when Supabase rejects the token", async () => {
    const result = await authenticateParentRequest({
      ...BASE,
      authorizationHeader: "Bearer expired.jwt",
      fetchFn: mockFetch(401, { code: 401 }),
    });
    expect(result).toBeNull();
  });
});
