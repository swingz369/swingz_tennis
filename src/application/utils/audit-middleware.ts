import type { NextRequest } from 'next/server';

export interface AuditContext {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  ipAddress?: string;
  userAgent?: string;
}

export function getAuditContext(request: NextRequest): AuditContext {
  const userId = request.headers.get('x-user-id') || 'system';
  const userName = request.headers.get('x-user-name') || 'System';
  const userEmail = request.headers.get('x-user-email') || 'system@swingz.de';
  const userRole = request.headers.get('x-user-role') || 'system';

  const ipAddress =
    request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  const userAgent = request.headers.get('user-agent') || 'unknown';

  return {
    userId,
    userName,
    userEmail,
    userRole,
    ipAddress,
    userAgent,
  };
}

export function createAuditMiddlewareWrapper<T extends any[], R>(
  handler: (context: AuditContext, ...args: T) => Promise<R>
) {
  return async (request: NextRequest, ...args: T): Promise<R> => {
    const context = getAuditContext(request);
    return handler(context, ...args);
  };
}
