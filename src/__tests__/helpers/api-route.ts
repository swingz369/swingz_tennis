/**
 * src/__tests__/helpers/api-route.ts — gemeinsamer Harness für Route-Handler-Tests
 *
 * Muster übernommen aus src/__tests__/lib/api-auth.subscription-gate.test.ts:
 * `@supabase/ssr`s `createServerClient` und `resolveActiveClub` werden
 * gemockt, damit der ECHTE `withAuth`/`requireAuth`/`buildAuthContext`-Code
 * läuft — nur die DB-Antworten sind kontrolliert. So testet man den
 * tatsächlichen Auth-/Rollen-Fluss mit, statt ihn wegzumocken.
 *
 * Verwendung in einer Testdatei (VOR dem Import des Route-Moduls, vi.mock
 * wird gehoisted):
 *
 *   import { vi } from 'vitest';
 *   import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';
 *
 *   const supa = installSupabaseMock();
 *   const { POST } = await import('@/app/api/.../route');
 *
 *   supa.setRole('admin', 'club-1');
 *   supa.table('members').select(() => ({ data: [...], error: null }));
 *
 *   const res = await POST(makeApiRequest('http://localhost/api/x', { method: 'POST', json: {...} }));
 *
 * `installSupabaseMock()` MUSS vor dem `import()` des Route-Moduls aufgerufen
 * werden — intern per `vi.doMock` (nicht `vi.mock`), weil `vi.mock` nur beim
 * Aufruf auf Modul-Top-Level gehoisted wird. `vi.doMock` wirkt dagegen erst
 * ab dem Aufruf-Zeitpunkt auf ALLE danach folgenden Importe (auch
 * dynamische) — deshalb muss der Route-Import ein `await import(...)` NACH
 * `installSupabaseMock()` sein, kein statischer `import`-Header.
 */
import { vi } from 'vitest';
import { NextRequest } from 'next/server';

type Role = 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member';

interface ChainState {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  filters: Record<string, unknown>;
  payload?: unknown;
}

type TableHandler = (state: ChainState) => { data: unknown; error: unknown };

const defaultHandler: TableHandler = (state) => {
  // users: von buildAuthContext/isSubscriptionPastDue abgefragt — active
  // Default reicht, SUBSCRIPTION_ENFORCEMENT=off macht die Dunning-Gate eh
  // zum No-op (.env.local).
  if (state.table === 'users') return { data: { subscription_status: 'active' }, error: null };
  return { data: null, error: null };
};

export interface SupabaseMockControl {
  /** Rolle + aktiver Club für diesen Testfall setzen (Default: admin/club-1). */
  setRole: (role: Role, clubId: string | null) => void;
  /** Antwort-Handler für eine Tabelle registrieren; überschreibt den Default. */
  table: (name: string, handler: TableHandler) => void;
  /** Antwort für einen RPC-Aufruf (`supabase.rpc(name, args)`) registrieren. */
  rpc: (name: string, handler: (args: unknown) => { data: unknown; error: unknown }) => void;
  reset: () => void;
}

const mockState = vi.hoisted(() => ({
  role: 'admin' as Role,
  clubId: 'club-1' as string | null,
  tableHandlers: new Map<string, TableHandler>(),
  rpcHandlers: new Map<string, (args: unknown) => { data: unknown; error: unknown }>(),
}));

function buildChain(table: string) {
  const state: ChainState = { table, op: 'select', filters: {} };
  const resolve = () => {
    const handler = mockState.tableHandlers.get(table) ?? defaultHandler;
    return Promise.resolve(handler(state));
  };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.order = self;
  chain.limit = self;
  chain.range = self;
  chain.insert = (payload: unknown) => {
    state.op = 'insert';
    state.payload = payload;
    return chain;
  };
  chain.update = (payload: unknown) => {
    state.op = 'update';
    state.payload = payload;
    return chain;
  };
  chain.upsert = (payload: unknown) => {
    state.op = 'upsert';
    state.payload = payload;
    return chain;
  };
  chain.delete = () => {
    state.op = 'delete';
    return chain;
  };
  chain.eq = (col: string, val: unknown) => {
    state.filters[col] = val;
    return chain;
  };
  chain.neq = (col: string, val: unknown) => {
    state.filters[`${col}!=`] = val;
    return chain;
  };
  chain.in = (col: string, vals: unknown) => {
    state.filters[col] = vals;
    return chain;
  };
  chain.gte = (col: string, val: unknown) => {
    state.filters[`${col}>=`] = val;
    return chain;
  };
  chain.lt = (col: string, val: unknown) => {
    state.filters[`${col}<`] = val;
    return chain;
  };
  chain.lte = (col: string, val: unknown) => {
    state.filters[`${col}<=`] = val;
    return chain;
  };
  chain.single = () => resolve();
  chain.maybeSingle = () => resolve();
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    resolve().then(onFulfilled, onRejected);
  return chain;
}

/**
 * Registriert die vi.mock-Aufrufe für `@supabase/ssr` und
 * `@/lib/auth/resolve-active-club` und gibt die Steuer-API zurück. Muss vor
 * jedem `import()` des zu testenden Route-Moduls aufgerufen werden.
 */
export function installSupabaseMock(): SupabaseMockControl {
  vi.doMock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1', email: 'test@example.com' } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === 'user_club_memberships') {
          const chain = buildChain(table);
          chain.then = (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve({
              data: [{ club_id: mockState.clubId, role: mockState.role }],
              error: null,
            }).then(onFulfilled);
          return chain;
        }
        return buildChain(table);
      }),
      rpc: vi.fn(async (name: string, args: unknown) => {
        const handler = mockState.rpcHandlers.get(name);
        return handler ? handler(args) : { data: null, error: null };
      }),
    })),
  }));

  vi.doMock('@/lib/auth/resolve-active-club', () => ({
    resolveActiveClub: vi.fn(async () => ({
      clubId:
        mockState.role === 'owner' || mockState.role === 'superadmin' ? null : mockState.clubId,
      resolvedRole: mockState.role,
      isValid: true,
    })),
  }));

  mockState.role = 'admin';
  mockState.clubId = 'club-1';
  mockState.tableHandlers.clear();
  mockState.rpcHandlers.clear();

  return {
    setRole(role, clubId) {
      mockState.role = role;
      mockState.clubId = clubId;
    },
    table(name, handler) {
      mockState.tableHandlers.set(name, handler);
    },
    rpc(name, handler) {
      mockState.rpcHandlers.set(name, handler);
    },
    reset() {
      mockState.role = 'admin';
      mockState.clubId = 'club-1';
      mockState.tableHandlers.clear();
      mockState.rpcHandlers.clear();
    },
  };
}

/**
 * Fake-Client für Code, das `createServiceClient()` (lib/supabase/service.ts)
 * direkt aufruft statt `auth.supabase` zu nutzen — z. B. Cron/Webhook-Routen
 * oder ADR-005-Whitelist-Pfade (`systemDb(reason)`). Teilt sich die Tabellen-
 * /RPC-Antworten mit `installSupabaseMock()` (`supa.table(...)` gilt für
 * beide), damit eine Route, die beide Wege mischt, nur einmal konfiguriert
 * werden muss. Im Zieltest so verdrahten:
 *
 *   const supa = installSupabaseMock();
 *   vi.doMock('@/lib/supabase/service', () => ({
 *     createServiceClient: () => makeFakeSupabaseClient(),
 *   }));
 *   const { POST } = await import('@/app/api/.../route');
 */
export function makeFakeSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => buildChain(table)),
    rpc: vi.fn(async (name: string, args: unknown) => {
      const handler = mockState.rpcHandlers.get(name);
      return handler ? handler(args) : { data: null, error: null };
    }),
  };
}

export function makeApiRequest(
  url: string,
  init: Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit } = {}
): NextRequest {
  const { json, headers, ...rest } = init;
  return new NextRequest(url, {
    ...rest,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    headers: { 'content-type': 'application/json', ...(headers as Record<string, string>) },
  });
}
