/**
 * Standardized API Error Response Utility
 *
 * Ensures consistent error responses across all API routes
 * with proper status codes, error codes, and messages.
 */

import { NextResponse } from 'next/server';

export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Resources
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',

  // Operations
  OPERATION_FAILED = 'OPERATION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Rate Limiting & Capacity
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // General
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  TIMEOUT = 'TIMEOUT',
}

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId?: string;
  };
}

export interface ApiErrorOptions {
  code: ErrorCode;
  message: string;
  status?: number;
  details?: Record<string, any>;
  cause?: Error;
  requestId?: string;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(options: ApiErrorOptions): NextResponse<ApiError> {
  const { code, message, status = getStatusFromCode(code), details, cause, requestId } = options;

  // Log error for monitoring
  if (cause) {
    console.error('[API Error]', {
      code,
      message,
      status,
      details,
      cause: cause.message,
      stack: cause.stack,
      requestId,
    });
  }

  const errorResponse: ApiError = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
    },
  };

  return NextResponse.json(errorResponse, { status });
}

/**
 * Maps error codes to HTTP status codes
 */
function getStatusFromCode(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    [ErrorCode.UNAUTHORIZED]: 401,
    [ErrorCode.FORBIDDEN]: 403,
    [ErrorCode.SESSION_EXPIRED]: 401,
    [ErrorCode.INVALID_TOKEN]: 401,
    [ErrorCode.VALIDATION_ERROR]: 400,
    [ErrorCode.INVALID_INPUT]: 400,
    [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
    [ErrorCode.NOT_FOUND]: 404,
    [ErrorCode.ALREADY_EXISTS]: 409,
    [ErrorCode.RESOURCE_CONFLICT]: 409,
    [ErrorCode.OPERATION_FAILED]: 500,
    [ErrorCode.DATABASE_ERROR]: 500,
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
    [ErrorCode.QUOTA_EXCEEDED]: 429,
    [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
    [ErrorCode.BAD_REQUEST]: 400,
    [ErrorCode.TIMEOUT]: 504,
  };

  return statusMap[code] || 500;
}

/**
 * Wraps API route handlers with standardized error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: Parameters<T>): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Handle known API errors
      if (error instanceof ApiException) {
        return createErrorResponse({
          code: error.code,
          message: error.message,
          status: error.status,
          details: error.details,
          cause: error,
        });
      }

      // Handle validation errors (Zod)
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
        return createErrorResponse({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: { errors: (error as any).errors },
        });
      }

      // Handle unexpected errors
      console.error('[Unhandled API Error]', error);
      return createErrorResponse({
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }) as T;
}

/**
 * Custom API Exception class for throwing structured errors
 */
export class ApiException extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiException';
    this.status = status || getStatusFromCode(code);
  }
}

/**
 * Helper functions for common error responses
 */
export const ErrorResponses = {
  unauthorized: (message = 'Authentication required') =>
    createErrorResponse({
      code: ErrorCode.UNAUTHORIZED,
      message,
    }),

  forbidden: (message = 'Access denied') =>
    createErrorResponse({
      code: ErrorCode.FORBIDDEN,
      message,
    }),

  notFound: (resource = 'Resource', message?: string) =>
    createErrorResponse({
      code: ErrorCode.NOT_FOUND,
      message: message || `${resource} not found`,
    }),

  validationError: (message: string, details?: Record<string, any>) =>
    createErrorResponse({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      details,
    }),

  conflict: (message: string, details?: Record<string, any>) =>
    createErrorResponse({
      code: ErrorCode.RESOURCE_CONFLICT,
      message,
      details,
    }),

  badRequest: (message: string, details?: Record<string, any>) =>
    createErrorResponse({
      code: ErrorCode.BAD_REQUEST,
      message,
      details,
    }),

  internalError: (message = 'Internal server error', cause?: Error) =>
    createErrorResponse({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message,
      cause,
    }),

  rateLimited: (message = 'Too many requests', details?: Record<string, any>) =>
    createErrorResponse({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      details,
    }),

  timeout: (message = 'Request timeout') =>
    createErrorResponse({
      code: ErrorCode.TIMEOUT,
      message,
    }),
};

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: any): response is ApiError {
  return (
    response &&
    typeof response === 'object' &&
    'error' in response &&
    typeof response.error === 'object' &&
    'code' in response.error &&
    'message' in response.error
  );
}
