import * as Sentry from '@sentry/nextjs';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  constructor() {}

  setUserId(userId: string) {
    Sentry.setUser({ id: userId });
  }

  clearUserId() {
    Sentry.setUser(null);
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (typeof window !== 'undefined') {
      console.log(`[${level.toUpperCase()}]`, message, context);
    }

    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
      Sentry.captureException(new Error(message));
    } else if (level === LogLevel.WARN) {
      Sentry.captureMessage(message, {
        level: 'warning',
      });
    }
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context);
  }

  fatal(message: string, context?: LogContext) {
    this.log(LogLevel.FATAL, message, context);
  }

  trackEvent(eventName: string, properties?: Record<string, unknown>) {
    Sentry.addBreadcrumb({
      category: 'user',
      message: eventName,
      level: 'info',
      ...(properties && { data: properties }),
    });
  }

  trackApiCall(endpoint: string, method: string, duration: number, status: number) {
    this.trackEvent('api_call', {
      endpoint,
      method,
      duration,
      status,
    });
  }

  trackUserAction(action: string, properties?: Record<string, unknown>) {
    this.trackEvent('user_action', {
      action,
      ...properties,
    });
  }

  trackError(error: Error) {
    Sentry.captureException(error);
  }
}

export const logger = new Logger();

export function createLogger(context: string) {
  return {
    debug: (message: string, data?: unknown) =>
      logger.debug(message, { ...(data as Record<string, unknown>), context }),
    info: (message: string, data?: unknown) =>
      logger.info(message, { ...(data as Record<string, unknown>), context }),
    warn: (message: string, data?: unknown) =>
      logger.warn(message, { ...(data as Record<string, unknown>), context }),
    error: (message: string, data?: unknown) =>
      logger.error(message, { ...(data as Record<string, unknown>), context }),
    fatal: (message: string, data?: unknown) =>
      logger.fatal(message, { ...(data as Record<string, unknown>), context }),
  };
}
