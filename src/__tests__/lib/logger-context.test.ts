import { describe, it, expect, vi } from 'vitest';

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
}));

import { createLogger } from '@/lib/logger';

describe('createLogger — Kontext an Sentry', () => {
  it('übergibt einen String als detail statt ihn in Einzelzeichen zu zerlegen', () => {
    createLogger('auth:login').error('Login error', 'Invalid login credentials');
    const scope = captureException.mock.calls.at(-1)?.[1] as { extra: Record<string, unknown> };
    expect(scope.extra).toEqual({ detail: 'Invalid login credentials' });
  });

  it('übernimmt Objekte unverändert', () => {
    createLogger('api:x').error('kaputt', { code: '22P02' });
    const scope = captureException.mock.calls.at(-1)?.[1] as { extra: Record<string, unknown> };
    expect(scope.extra).toEqual({ code: '22P02' });
  });
});
