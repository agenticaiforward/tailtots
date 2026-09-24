/**
 * Parent-side Supabase Auth token validation for the Worker AI endpoint.
 *
 * The token is a Supabase access JWT sent by the client as
 * `Authorization: Bearer <token>`. It is validated without any secret key by
 * asking the Supabase Auth service itself: `GET {SUPABASE_URL}/auth/v1/user`
 * with the anon key. HTTP 200 means the session is valid; anything else
 * (401/403/network error) means it is not.
 *
 * Kept as pure, fetch-injectable helpers so the decision is unit-testable
 * without a live Worker or real network.
 */

export interface ValidateParentTokenOptions {
  supabaseUrl: string;
  anonKey: string;
  token: string;
  /** Injected in tests; defaults to the global fetch at runtime. */
  fetchFn?: typeof fetch;
}

/**
 * Validate a Supabase access token against the Auth user endpoint.
 * Resolves to the user's id on success, or null when the token is
 * missing/empty, the endpoint rejects it, or the request fails in any way.
 */
export async function validateParentToken(
  options: ValidateParentTokenOptions,
): Promise<{ userId: string } | null> {
  const { supabaseUrl, anonKey, token, fetchFn = fetch } = options;
  if (!supabaseUrl || !anonKey || !token) {
    return null;
  }
  try {
    const response = await fetchFn(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      // A hung auth call must not hang the Worker request.
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return null;
    }
    const user = (await response.json()) as { id?: unknown };
    if (!user || typeof user.id !== "string" || !user.id) {
      return null;
    }
    return { userId: user.id };
  } catch {
    // Network error, timeout, or malformed response: treat as invalid.
    return null;
  }
}

/**
 * Pull a Bearer token out of an Authorization header value.
 * Returns null when the header is missing or is not a Bearer credential.
 */
export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader.trim());
  return match ? match[1] : null;
}

export interface AuthenticateParentRequestOptions {
  supabaseUrl?: string | null;
  anonKey?: string | null;
  authorizationHeader: string | null;
  /** Injected in tests; defaults to the global fetch at runtime. */
  fetchFn?: typeof fetch;
}

/**
 * The full parent-auth decision used by the Worker route handler: env vars
 * present, a Bearer token in the Authorization header, and the token accepted
 * by Supabase Auth. Resolves to `{ userId }` when authenticated, else null.
 */
export async function authenticateParentRequest(
  options: AuthenticateParentRequestOptions,
): Promise<{ userId: string } | null> {
  const { supabaseUrl, anonKey, authorizationHeader, fetchFn = fetch } = options;
  if (!supabaseUrl || !anonKey) {
    return null;
  }
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return null;
  }
  return validateParentToken({ supabaseUrl, anonKey, token, fetchFn });
}
