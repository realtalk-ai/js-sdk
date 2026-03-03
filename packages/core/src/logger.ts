export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "silent";

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
};

export interface Logger {
  trace(event: string, context?: Record<string, unknown>): void;
  debug(event: string, context?: Record<string, unknown>): void;
  info(event: string, context?: Record<string, unknown>): void;
  warn(event: string, context?: Record<string, unknown>): void;
  error(event: string, context?: Record<string, unknown>): void;
}

let currentLevel: LogLevel = "silent";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export const logger: Logger = {
  trace(event, context) {
    if (shouldLog("trace")) console.debug(`[realtalk] ${event}`, context ?? "");
  },
  debug(event, context) {
    if (shouldLog("debug")) console.debug(`[realtalk] ${event}`, context ?? "");
  },
  info(event, context) {
    if (shouldLog("info")) console.info(`[realtalk] ${event}`, context ?? "");
  },
  warn(event, context) {
    if (shouldLog("warn")) console.warn(`[realtalk] ${event}`, context ?? "");
  },
  error(event, context) {
    if (shouldLog("error")) console.error(`[realtalk] ${event}`, context ?? "");
  },
};
