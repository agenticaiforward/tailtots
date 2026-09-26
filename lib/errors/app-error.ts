/**
 * Typed error taxonomy for TailTots.
 *
 * Rules:
 * - Throw `AppError` (or a subclass) from lib/ code paths instead of raw
 *   `Error` so UI layers can always produce a kid-/parent-safe message.
 * - Never surface `cause` details to the UI; use `userMessage`.
 * - Never silently swallow errors: log them with the structured logger,
 *   then either recover explicitly or rethrow.
 */

export const ErrorCode = {
  VALIDATION: "VALIDATION",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  NETWORK: "NETWORK",
  STORAGE: "STORAGE",
  UNKNOWN: "UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;

  constructor(code: ErrorCode, userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

export function validationError(userMessage: string, cause?: unknown): AppError {
  return new AppError(ErrorCode.VALIDATION, userMessage, { cause });
}

export function notConfiguredError(userMessage: string): AppError {
  return new AppError(ErrorCode.NOT_CONFIGURED, userMessage);
}

export function authRequiredError(userMessage = "Please sign in as a parent first."): AppError {
  return new AppError(ErrorCode.AUTH_REQUIRED, userMessage);
}

export function storageError(userMessage: string, cause?: unknown): AppError {
  return new AppError(ErrorCode.STORAGE, userMessage, { cause });
}

/**
 * Convert any thrown value into a message that is safe to show to a
 * parent or child. Technical details stay in the logs via `cause`.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  if (error instanceof Error && error.message) {
    // Third-party SDK errors may leak internals; keep the message generic
    // unless it already reads like a user-facing sentence.
    return error.message.length < 160 ? error.message : FALLBACK_MESSAGE;
  }
  return FALLBACK_MESSAGE;
}
