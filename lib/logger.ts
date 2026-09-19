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

  private log(level: LogLevel, message: string, context?: LogContext, originalError?: Error) {
    const isServer = typeof window === 'undefined';

    // Output to appropriate console method on both server and client
    if (isServer) {
      const ts = new Date().toISOString();
      const prefix = originalError
        ? (originalError.stack ?? originalError.message)
        : context
          ? JSON.stringify(context)
          : '';
      switch (level) {
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(`[${ts}] [${level.toUpperCase()}] ${message}`, prefix);
          break;
        case LogLevel.WARN:
          console.warn(`[${ts}] [${level.toUpperCase()}] ${message}`, prefix);
          break;
        default:
          console.log(`[${ts}] [${level.toUpperCase()}] ${message}`, prefix);
      }
    } else {
      // Client-side: use console.log for all levels
      console.log(`[${level.toUpperCase()}]`, message, context);
    }

    // Sentry integration.
    //
    // Der Kontext ging hier bisher verloren: `createLogger('api:nuliga')` legt
    // den Modulnamen als `context.context` ab und jeder Aufruf hängt seine
    // Daten daran — in Sentry kam davon nichts an, dort stand nur die nackte
    // Meldung. Da Vercels Laufzeit-Logs kurzlebig sind, ist der Sentry-Eintrag
    // aber oft das Einzige, was von einem Vorfall übrig bleibt. Modulname als
    // Tag (danach lässt sich filtern), der Rest als `extra`.
    const { context: moduleName, ...rest } = context ?? {};
    const scope = context
      ? {
          extra: rest,
          ...(typeof moduleName === 'string' ? { tags: { module: moduleName } } : {}),
        }
      : undefined;

    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
      Sentry.captureException(originalError ?? new Error(message), scope);
    } else if (level === LogLevel.WARN) {
      Sentry.captureMessage(message, { level: 'warning', ...scope });
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

  error(message: string, contextOrError?: LogContext | Error) {
    if (contextOrError instanceof Error) {
      this.log(LogLevel.ERROR, message, undefined, contextOrError);
    } else {
      this.log(LogLevel.ERROR, message, contextOrError);
    }
  }

  fatal(message: string, contextOrError?: LogContext | Error) {
    if (contextOrError instanceof Error) {
      this.log(LogLevel.FATAL, message, undefined, contextOrError);
    } else {
      this.log(LogLevel.FATAL, message, contextOrError);
    }
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
    error: (message: string, dataOrError?: unknown) => {
      if (dataOrError instanceof Error) {
        logger.error(message, dataOrError);
      } else {
        logger.error(message, { ...(dataOrError as Record<string, unknown>), context });
      }
    },
    fatal: (message: string, dataOrError?: unknown) => {
      if (dataOrError instanceof Error) {
        logger.fatal(message, dataOrError);
      } else {
        logger.fatal(message, { ...(dataOrError as Record<string, unknown>), context });
      }
    },
  };
}
