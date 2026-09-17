/**
 * Verhaltens-Tests für PATCH /api/owner/system-settings/[key] — Owner-Gate,
 * Key-Validierung und die Guards um is_required/No-Op/Validation (tokensave
 * test_risk 16.09.2026 markierte `validate` als komplex/ungetestet; das ist
 * ein interner Helper dieser Route, kein eigener Export — getestet wird
 * daher der PATCH-Handler, der ihn aufruft).
 *
 * Nutzt den Standard-Harness (installSupabaseMock) für den echten withApiAuth/
 * verifyRole-Code. Der `createServiceClient()`-Zugriff bekommt einen eigenen,
 * kleinen Fake-Client statt makeFakeSupabaseClient(): die Route nutzt
 * `.is('club_id', null)`, das der generische Harness-Chain-Builder nicht
 * kennt (nur eq/neq/in/gte/lte).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';

const supa = installSupabaseMock();

type SettingsOp = 'select' | 'update';
type SettingsHandler = (state: {
  op: SettingsOp;
  filters: Record<string, unknown>;
  payload?: unknown;
}) => { data: unknown; error: unknown };

let settingsHandler: SettingsHandler = () => ({ data: null, error: null });

function buildSettingsChain() {
  const state: { op: SettingsOp; filters: Record<string, unknown>; payload?: unknown } = {
    op: 'select',
    filters: {},
  };
  const resolve = () => Promise.resolve(settingsHandler(state));
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = (col: string, val: unknown) => {
    state.filters[col] = val;
    return chain;
  };
  chain.is = (col: string, val: unknown) => {
    state.filters[col] = val;
    return chain;
  };
  chain.update = (payload: unknown) => {
    state.op = 'update';
    state.payload = payload;
    return chain;
  };
  chain.maybeSingle = () => resolve();
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    resolve().then(onFulfilled, onRejected);
  return chain;
}

vi.doMock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (_table: string) => buildSettingsChain() }),
}));

const logAuditMock = vi.fn(async () => {});
vi.doMock('@/lib/audit', () => ({ logAudit: logAuditMock }));

const { PATCH } = await import('@/app/api/owner/system-settings/[key]/route');

function makeParams(key = 'max_teams') {
  return { params: Promise.resolve({ key }) };
}

function patchRequest(key: string, body: unknown) {
  return makeApiRequest(`http://localhost/api/owner/system-settings/${key}`, {
    method: 'PATCH',
    json: body,
  });
}

const baseSetting = {
  id: 'setting-1',
  category: 'general',
  key: 'max_teams',
  value: '10',
  type: 'number',
  description: null,
  is_required: false,
  validation: { min: 1, max: 50 },
};

describe('PATCH /api/owner/system-settings/[key]', () => {
  beforeEach(() => {
    supa.reset();
    logAuditMock.mockClear();
    settingsHandler = () => ({ data: null, error: null });
  });

  it('lehnt Nicht-Owner ab (verifyRole)', async () => {
    supa.setRole('superadmin', null);
    const res = await PATCH(patchRequest('max_teams', { value: 20 }), makeParams());
    expect(res.status).toBe(403);
  });

  it('lehnt einen ungültigen Setting-Key ab, bevor die DB befragt wird', async () => {
    supa.setRole('owner', null);
    const res = await PATCH(
      patchRequest('1invalid-key', { value: 20 }),
      makeParams('1invalid-key')
    );
    expect(res.status).toBe(400);
  });

  it('verlangt das Feld "value"', async () => {
    supa.setRole('owner', null);
    const res = await PATCH(patchRequest('max_teams', {}), makeParams());
    expect(res.status).toBe(400);
  });

  it('liefert 404, wenn das globale Setting nicht existiert', async () => {
    supa.setRole('owner', null);
    settingsHandler = () => ({ data: null, error: null });
    const res = await PATCH(patchRequest('max_teams', { value: 20 }), makeParams());
    expect(res.status).toBe(404);
  });

  it('lehnt Änderungen an is_required-Settings ab (422 — Schema-/ENV-gepflegt)', async () => {
    supa.setRole('owner', null);
    settingsHandler = () => ({ data: { ...baseSetting, is_required: true }, error: null });
    const res = await PATCH(patchRequest('max_teams', { value: 20 }), makeParams());
    expect(res.status).toBe(422);
  });

  it('lehnt einen No-Op-Wert ab (409 — Wert entspricht dem aktuellen)', async () => {
    supa.setRole('owner', null);
    settingsHandler = () => ({ data: baseSetting, error: null });
    const res = await PATCH(patchRequest('max_teams', { value: 10 }), makeParams());
    expect(res.status).toBe(409);
  });

  it('lehnt einen Wert außerhalb des validierten Bereichs ab (422)', async () => {
    supa.setRole('owner', null);
    settingsHandler = () => ({ data: baseSetting, error: null });
    const res = await PATCH(patchRequest('max_teams', { value: 999 }), makeParams());
    expect(res.status).toBe(422);
  });

  it('aktualisiert einen gültigen Wert und schreibt ein Audit-Log', async () => {
    supa.setRole('owner', null);
    settingsHandler = (state) => {
      if (state.op === 'select') return { data: baseSetting, error: null };
      return { data: null, error: null };
    };
    const res = await PATCH(patchRequest('max_teams', { value: 25 }), makeParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.value).toBe('25');
    expect(logAuditMock).toHaveBeenCalledTimes(1);
  });
});
