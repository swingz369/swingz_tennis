// src/presentation/lib/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private context: string;
  private minLevel: LogLevel;

  constructor(context: string, minLevel: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.minLevel = minLevel;
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (level < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];

    const logEntry = JSON.stringify({
      timestamp,
      level: levelStr,
      context: this.context,
      message,
      ...(meta && { meta }),
    });

    switch (level) {
      case LogLevel.ERROR:
        console.error(logEntry);
        break;
      case LogLevel.WARN:
        console.warn(logEntry);
        break;
      default:
        console.log(logEntry);
    }
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, meta);
  }
}

export const logger = new Logger('tsow-app');
