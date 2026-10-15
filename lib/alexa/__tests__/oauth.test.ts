import { describe, expect, it } from "vitest";
import {
  ALEXA_ACCESS_TOKEN_TTL_SECONDS,
  ALEXA_AUTH_CODE_TTL_MS,
  buildAuthorizationRedirect,
  createMemoryCodeStore,
  exchangeAuthorizationCode,
  issueAuthorizationCode,
  verifyAlexaAccessToken,
  type CodeStore,
} from "../oauth";

const CLIENT_ID = "tailtots-alexa-parent-skill";
const CLIENT_SECRET = "s3cr3t-alexa-client";
const TOKEN_SECRET = "s3cr3t-token-signing-key";
const REDIRECT_URI = "https://pitangui.amazon.com/api/skill/link/ABC123";

function deterministicBytes(seed: number) {
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = (seed + i) % 256;
    return out;
  };
}

function issueOk(store: CodeStore, overrides: Record<string, unknown> = {}) {
  return issueAuthorizationCode({
    userId: "user-1",
    responseType: "code",
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    expectedClientId: CLIENT_ID,
    store,
    nowMs: 1_000_000,
    randomBytes: deterministicBytes(7),
    ...overrides,
  });
}

describe("issueAuthorizationCode", () => {
  it("issues a code for a valid authorize request", () => {
    const store = createMemoryCodeStore();
    const result = issueOk(store);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.code).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects wrong response_type, wrong client, and non-https redirect", () => {
    const store = createMemoryCodeStore();
    expect(issueOk(store, { responseType: "token" })).toEqual({ ok: false, error: "unsupported_response_type" });
    expect(issueOk(store, { clientId: "someone-else" })).toEqual({ ok: false, error: "invalid_client" });
    expect(issueOk(store, { redirectUri: "http://evil.example/cb" })).toEqual({ ok: false, error: "invalid_redirect_uri" });
    expect(issueOk(store, { redirectUri: "not-a-url" })).toEqual({ ok: false, error: "invalid_redirect_uri" });
    expect(issueOk(store, { userId: "" })).toEqual({ ok: false, error: "missing_user" });
  });
});

describe("exchangeAuthorizationCode", () => {
  function issueAndExchange(exchangeOverrides: Record<string, unknown> = {}, issueOverrides: Record<string, unknown> = {}) {
    const store = createMemoryCodeStore();
    const issued = issueOk(store, issueOverrides);
    if (!issued.ok) throw new Error("issue failed in test setup");
    return exchangeAuthorizationCode({
      grantType: "authorization_code",
      code: issued.code,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
      expectedClientId: CLIENT_ID,
      expectedClientSecret: CLIENT_SECRET,
      tokenSecret: TOKEN_SECRET,
      store,
      nowMs: 1_000_000 + 60_000,
      ...exchangeOverrides,
    });
  }

  it("exchanges a valid code for a Bearer token", async () => {
    const result = await issueAndExchange();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokenType).toBe("Bearer");
      expect(result.expiresIn).toBe(ALEXA_ACCESS_TOKEN_TTL_SECONDS);
      expect(result.accessToken).toContain(".");
    }
  });

  it("rejects reuse of a code (single-use)", async () => {
    const store = createMemoryCodeStore();
    const issued = issueOk(store);
    if (!issued.ok) throw new Error("issue failed in test setup");
    const base = {
      grantType: "authorization_code",
      code: issued.code,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
      expectedClientId: CLIENT_ID,
      expectedClientSecret: CLIENT_SECRET,
      tokenSecret: TOKEN_SECRET,
      store,
      nowMs: 1_000_000 + 60_000,
    };
    expect((await exchangeAuthorizationCode(base)).ok).toBe(true);
    const again = await exchangeAuthorizationCode(base);
    expect(again).toMatchObject({ ok: false, error: "invalid_grant" });
  });

  it("rejects unknown codes, expired codes, and mismatched redirect_uri", async () => {
    const store = createMemoryCodeStore();
    const base = {
      grantType: "authorization_code",
      code: "nope",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
      expectedClientId: CLIENT_ID,
      expectedClientSecret: CLIENT_SECRET,
      tokenSecret: TOKEN_SECRET,
      store,
      nowMs: 1_000_000 + 60_000,
    };
    expect(await exchangeAuthorizationCode(base)).toMatchObject({ ok: false, error: "invalid_grant" });

    expect(await issueAndExchange({ nowMs: 1_000_000 + ALEXA_AUTH_CODE_TTL_MS + 1 })).toMatchObject({
      ok: false,
      error: "invalid_grant",
    });
    expect(await issueAndExchange({ redirectUri: "https://pitangui.amazon.com/api/skill/link/OTHER" })).toMatchObject({
      ok: false,
      error: "invalid_grant",
    });
  });

  it("rejects bad client credentials and bad grant_type", async () => {
    expect(await issueAndExchange({ clientSecret: "wrong" })).toMatchObject({ ok: false, error: "invalid_client" });
    expect(await issueAndExchange({ clientId: "wrong" })).toMatchObject({ ok: false, error: "invalid_client" });
    expect(await issueAndExchange({ grantType: "refresh_token" })).toMatchObject({ ok: false, error: "invalid_request" });
  });
});

describe("verifyAlexaAccessToken", () => {
  async function mint(overrides: Record<string, unknown> = {}) {
    const store = createMemoryCodeStore();
    const issued = issueOk(store);
    if (!issued.ok) throw new Error("issue failed in test setup");
    const result = await exchangeAuthorizationCode({
      grantType: "authorization_code",
      code: issued.code,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
      expectedClientId: CLIENT_ID,
      expectedClientSecret: CLIENT_SECRET,
      tokenSecret: TOKEN_SECRET,
      tokenTtlSeconds: 3600,
      store,
      nowMs: 1_000_000,
      ...overrides,
    });
    if (!result.ok) throw new Error("exchange failed in test setup");
    return result.accessToken;
  }

  it("verifies a valid token back to the Supabase user id", async () => {
    const token = await mint();
    expect(await verifyAlexaAccessToken(token, TOKEN_SECRET, 1_000_000 + 1000)).toEqual({ userId: "user-1" });
  });

  it("rejects tampered, wrong-secret, and expired tokens", async () => {
    const token = await mint();
    const [payload] = token.split(".");
    expect(await verifyAlexaAccessToken(`${payload}.deadbeef`, TOKEN_SECRET, 1_000_000 + 1000)).toBeNull();
    expect(await verifyAlexaAccessToken(token, "different-secret", 1_000_000 + 1000)).toBeNull();
    expect(await verifyAlexaAccessToken(token, TOKEN_SECRET, 1_000_000 + 3600 * 1000 + 1)).toBeNull();
    expect(await verifyAlexaAccessToken(null, TOKEN_SECRET)).toBeNull();
    expect(await verifyAlexaAccessToken("garbage", TOKEN_SECRET)).toBeNull();
  });
});

describe("buildAuthorizationRedirect", () => {
  it("appends code and state preserving existing query params", () => {
    const out = buildAuthorizationRedirect("https://pitangui.amazon.com/api/skill/link/ABC?a=b", "CODE1", "STATE1");
    const url = new URL(out);
    expect(url.searchParams.get("code")).toBe("CODE1");
    expect(url.searchParams.get("state")).toBe("STATE1");
    expect(url.searchParams.get("a")).toBe("b");
  });
});
