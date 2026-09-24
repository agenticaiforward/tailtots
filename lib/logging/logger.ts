/**
 * Minimal structured logger.
 *
 * App code must log through this module instead of calling `console.*`
 * directly (enforced by the `no-console` eslint rule for app/lib/db/worker).
 * CLI scripts under `scripts/` and `apps/alexa/` may use `console` since
 * stdout is their user interface.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function minLevel(): LogLevel {
  const raw = typeof process !== "undefined" ? process.env?.LOG_LEVEL : undefined;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return "info";
}

function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function emit(level: LogLevel, scope: string, message: string, context?: LogContext) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(context ? { context } : {}),
  };
  const line = JSON.stringify(payload, (_key, value) => serializeError(value));
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, context) => emit("debug", scope, message, context),
    info: (message, context) => emit("info", scope, message, context),
    warn: (message, context) => emit("warn", scope, message, context),
    error: (message, context) => emit("error", scope, message, context),
  };
}

/** Shared logger for one-off call sites that do not need their own scope. */
export const logger = createLogger("tailtots");
