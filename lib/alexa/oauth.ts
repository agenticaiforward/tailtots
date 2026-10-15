/**
 * OAuth 2.0 helpers for the TailTots Alexa parent skill (authorization code grant).
 *
 * Account linking ties an Alexa user to a signed-in TailTots parent's Supabase
 * identity:
 *   1. The parent, signed in to TailTots, opens GET /oauth/alexa/authorize.
 *      The Worker validates the parent's Supabase session (same check as every
 *      other parent endpoint) and issues a short-lived, single-use
 *      authorization code, then 302-redirects to Amazon's redirect_uri.
 *   2. Amazon's servers call POST /oauth/alexa/token with the code plus the
 *      skill's client_id / client_secret. The Worker verifies everything and
 *      returns an opaque access token.
 *   3. On every skill request the Lambda sends the access token to
 *      GET /api/alexa/family-summary, which verifies the token's HMAC
 *      signature and returns the family's live data.
 *
 * The access token is stateless: base64url(payload).base64url(HMAC-SHA256).
 * Authorization codes are short-lived (5 minutes) and single-use; the default
 * store is in-memory. For production across many Worker isolates, swap the
 * store for a KV/D1-backed implementation (see CodeStore) — documented in
 * apps/alexa/DEPLOY_REAL_SKILL.md.
 *
 * All functions are pure and injectable (no globals except the default
 * in-memory store), so the whole flow is unit-testable without a Worker.
 */

export const ALEXA_AUTH_CODE_TTL_MS = 5 * 60 * 1000;
export const ALEXA_ACCESS_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface AuthorizationCodeRecord {
  code: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  expiresAt: number; // epoch ms
  used: boolean;
}

export interface CodeStore {
  save(record: AuthorizationCodeRecord): void;
  /** Atomically marks the code used and returns it; returns null if unknown/used. */
  consume(code: string): AuthorizationCodeRecord | null;
}

export function createMemoryCodeStore(ttlMs: number = ALEXA_AUTH_CODE_TTL_MS): CodeStore {
  const map = new Map<string, AuthorizationCodeRecord>();
  return {
    save(record) {
      // Prune expired entries on each save so the map can't grow unbounded.
      const now = Date.now();
      for (const [key, rec] of map) {
        if (rec.expiresAt <= now) map.delete(key);
      }
      map.set(record.code, record);
    },
    consume(code) {
      const rec = map.get(code);
      if (!rec || rec.used) return null;
      rec.used = true;
      map.set(code, rec);
      return rec;
    },
  };
}

/** Default shared store for the Worker route handlers (one isolate each). */
export const defaultCodeStore: CodeStore = createMemoryCodeStore();

function randomCode(randomBytes?: (n: number) => Uint8Array): string {
  const bytes = randomBytes ? randomBytes(32) : crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface IssueCodeOptions {
  userId: string;
  responseType: string | null;
  clientId: string | null;
  redirectUri: string | null;
  expectedClientId: string;
  store?: CodeStore;
  nowMs?: number;
  randomBytes?: (n: number) => Uint8Array;
}

export type IssueCodeResult = { ok: true; code: string } | { ok: false; error: string };

/**
 * Validate the authorize request and mint a single-use authorization code.
 * The Worker route turns `ok` into a 302 redirect to the redirectUri with
 * ?code=...&state=... appended.
 */
export function issueAuthorizationCode(options: IssueCodeOptions): IssueCodeResult {
  const {
    userId,
    responseType,
    clientId,
    redirectUri,
    expectedClientId,
    store = defaultCodeStore,
    nowMs = Date.now(),
    randomBytes,
  } = options;
  if (!userId) return { ok: false, error: "missing_user" };
  if (responseType !== "code") return { ok: false, error: "unsupported_response_type" };
  if (!clientId || clientId !== expectedClientId) return { ok: false, error: "invalid_client" };
  if (!redirectUri) return { ok: false, error: "invalid_redirect_uri" };
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return { ok: false, error: "invalid_redirect_uri" };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "invalid_redirect_uri" };

  const code = randomCode(randomBytes);
  store.save({
    code,
    userId,
    clientId,
    redirectUri,
    expiresAt: nowMs + ALEXA_AUTH_CODE_TTL_MS,
    used: false,
  });
  return { ok: true, code };
}

/** Append code (and optional state) to the redirect URI per RFC 6749 §4.1.2. */
export function buildAuthorizationRedirect(redirectUri: string, code: string, state: string | null): string {
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

interface AccessTokenPayload {
  v: 1;
  uid: string;
  iat: number;
  exp: number;
}

async function signPayload(payload: AccessTokenPayload, secret: string): Promise<string> {
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  return `${encoded}.${toBase64Url(new Uint8Array(sig))}`;
}

export interface ExchangeCodeOptions {
  grantType: string | null;
  code: string | null;
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  expectedClientId: string;
  expectedClientSecret: string;
  tokenSecret: string;
  tokenTtlSeconds?: number;
  store?: CodeStore;
  nowMs?: number;
}

export type ExchangeCodeResult =
  | { ok: true; accessToken: string; tokenType: "Bearer"; expiresIn: number }
  | { ok: false; error: "invalid_request" | "invalid_grant" | "invalid_client" | "server_error"; errorDescription: string };

/**
 * Exchange an authorization code for an access token (POST /oauth/alexa/token).
 * Covers both client authentication styles Amazon uses: client_secret_post
 * (params in the form body) and client_secret_basic (Authorization: Basic).
 */
export async function exchangeAuthorizationCode(options: ExchangeCodeOptions): Promise<ExchangeCodeResult> {
  const {
    grantType,
    code,
    clientId,
    clientSecret,
    redirectUri,
    expectedClientId,
    expectedClientSecret,
    tokenSecret,
    tokenTtlSeconds = ALEXA_ACCESS_TOKEN_TTL_SECONDS,
    store = defaultCodeStore,
    nowMs = Date.now(),
  } = options;

  if (grantType !== "authorization_code") {
    return { ok: false, error: "invalid_request", errorDescription: "grant_type must be authorization_code." };
  }
  if (!clientId || !constantTimeEqual(clientId, expectedClientId)) {
    return { ok: false, error: "invalid_client", errorDescription: "Unknown client_id." };
  }
  if (!clientSecret || !constantTimeEqual(clientSecret, expectedClientSecret)) {
    return { ok: false, error: "invalid_client", errorDescription: "Client authentication failed." };
  }
  if (!code) {
    return { ok: false, error: "invalid_grant", errorDescription: "Authorization code is missing." };
  }
  const record = store.consume(code);
  if (!record) {
    return { ok: false, error: "invalid_grant", errorDescription: "Authorization code is invalid or already used." };
  }
  if (record.expiresAt <= nowMs) {
    return { ok: false, error: "invalid_grant", errorDescription: "Authorization code has expired." };
  }
  if (record.clientId !== expectedClientId) {
    return { ok: false, error: "invalid_grant", errorDescription: "Authorization code was issued to a different client." };
  }
  if (!redirectUri || redirectUri !== record.redirectUri) {
    return { ok: false, error: "invalid_grant", errorDescription: "redirect_uri does not match the authorize request." };
  }
  if (!tokenSecret) {
    return { ok: false, error: "server_error", errorDescription: "Token signing is not configured." };
  }

  const payload: AccessTokenPayload = {
    v: 1,
    uid: record.userId,
    iat: Math.floor(nowMs / 1000),
    exp: Math.floor(nowMs / 1000) + tokenTtlSeconds,
  };
  const accessToken = await signPayload(payload, tokenSecret);
  return { ok: true, accessToken, tokenType: "Bearer", expiresIn: tokenTtlSeconds };
}

/**
 * Verify an Alexa access token, returning the Supabase user id it was issued
 * for, or null when the token is malformed, mis-signed, or expired.
 */
export async function verifyAlexaAccessToken(
  token: string | null,
  tokenSecret: string,
  nowMs: number = Date.now(),
): Promise<{ userId: string } | null> {
  if (!token || !tokenSecret) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(tokenSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expectedSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
    if (!constantTimeEqual(toBase64Url(new Uint8Array(expectedSig)), providedSig)) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as Partial<AccessTokenPayload>;
    if (payload?.v !== 1 || typeof payload.uid !== "string" || !payload.uid) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= nowMs) return null;
    return { userId: payload.uid };
  } catch {
    return null;
  }
}
