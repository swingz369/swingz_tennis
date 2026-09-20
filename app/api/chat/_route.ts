import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { z, ZodTypeAny } from 'zod';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse, type AuthContext } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { ChatService } from '@/application/services/chat.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:chat');

type Run<B> = (chat: ChatService, body: B, auth: AuthContext) => Promise<unknown>;

/**
 * Gemeinsamer Rahmen der Chat-Routen: Auth (jede Rolle ab Mitglied), Rate-Limit,
 * Zod-Body, Fehlerabbildung. Die Mandantentrennung erzwingt RLS, nicht dieser Code.
 */
export async function chatRoute<S extends ZodTypeAny>(
  request: NextRequest,
  schema: S | null,
  run: Run<z.infer<S>>,
  opts: { status?: number } = {}
): Promise<NextResponse> {
  const handler = async (auth: AuthContext, body?: unknown) => {
    if (!(await verifyRole(auth, 'member'))) return forbiddenResponse();
    const limited = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (limited) return limited;
    try {
      const result = await run(new ChatService(auth), body as z.infer<S>, auth);
      return NextResponse.json(result ?? { success: true }, { status: opts.status ?? 200 });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Chat-Fehler', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }
  };
  return schema
    ? withApiAuth(request, (auth, body) => handler(auth, body), { body: schema })
    : withApiAuth(request, (auth) => handler(auth));
}

export const noClub = () => new ApiException('FORBIDDEN', 'Kein aktiver Verein ausgewählt');
