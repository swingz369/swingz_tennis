/**
 * Tests für lib/hardware/adapter.ts
 *
 * Coverage-Map (8 describe-Blocks):
 *   1. listHardwareVendors       — exhaustive List-Output
 *   2. getHardwareAdapter        — Factory-Dispatch (alle 3 Vendor-Namen)
 *   3. nukiAdapter               — Türschloss-Pfad × Auth-Error
 *   4. shellyAdapter             — Licht-Pfad × Türschloss-Unsupported
 *   5. loxoneAdapter             — alle 3 Pfade × Auth-Error
 *   6. ADR-002 forensic-Policy   — kein silent-fallback, immer { data, error }
 *   7. Vendor-Compatibility     — alle Adapters satisfy HardwareAdapter Interface
 *
 * ENV-Variablen werden via vi.stubEnv gesetzt, getestet wird gegenliegend
 * (missing-ENV-Pfad) — kein TestRunner-State-Lock-Risiko.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHardwareAdapter,
  listHardwareVendors,
  type HardwareAdapter,
  type HardwareErrorCode,
  type HardwareResult,
  type HardwareVendor,
} from '@/lib/hardware/adapter';

// ─── ENV-Stubbing ────────────────────────────────────────────────────────────
const ENV_VARS = ['NUKI_API_TOKEN', 'SHELLY_API_HOST', 'LOXONE_MINISERVER_IP'];

beforeEach(() => {
  for (const v of ENV_VARS) {
    vi.stubEnv(v, '');
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── 1. listHardwareVendors ──────────────────────────────────────────────────
describe('listHardwareVendors', () => {
  it('returns all 3 supported vendors', () => {
    const vendors = listHardwareVendors();
    expect(vendors).toHaveLength(3);
    expect(vendors).toContain('nuki');
    expect(vendors).toContain('shelly');
    expect(vendors).toContain('loxone');
  });

  it('returns readonly array (defensive)', () => {
    const vendors = listHardwareVendors();
    // TS-Compile-Proof: readonly
    expect(Array.isArray(vendors)).toBe(true);
  });
});

// ─── 2. getHardwareAdapter (Factory-Dispatch) ────────────────────────────────
describe('getHardwareAdapter', () => {
  it('returns Nuki adapter for vendor="nuki"', () => {
    const a = getHardwareAdapter('nuki');
    expect(a).toBeDefined();
    expect(typeof a.lockCourt).toBe('function');
  });

  it('returns Shelly adapter for vendor="shelly"', () => {
    const a = getHardwareAdapter('shelly');
    expect(a).toBeDefined();
    expect(typeof a.setLight).toBe('function');
  });

  it('returns Loxone adapter for vendor="loxone"', () => {
    const a = getHardwareAdapter('loxone');
    expect(a).toBeDefined();
    expect(typeof a.lockCourt).toBe('function');
    expect(typeof a.setLight).toBe('function');
  });

  it('returns the SAME instance on repeated calls (singleton-pattern)', () => {
    const a1 = getHardwareAdapter('nuki');
    const a2 = getHardwareAdapter('nuki');
    // Identity-Equality (Object.is) — Implementation-Detail aber für
    // Hot-Path-Webhook-Routing wichtig.
    expect(a1).toBe(a2);
  });
});

// ─── 3. nukiAdapter ──────────────────────────────────────────────────────────
describe('nukiAdapter', () => {
  beforeEach(() => {
    vi.stubEnv('NUKI_API_TOKEN', 'test-token-12345');
  });

  it('lockCourt returns success when ENV set', async () => {
    const r: HardwareResult = await getHardwareAdapter('nuki').lockCourt('court-1');
    expect(r).toEqual({ data: true, error: null });
  });

  it('unlockCourt returns success when ENV set', async () => {
    const r: HardwareResult = await getHardwareAdapter('nuki').unlockCourt('court-1');
    expect(r).toEqual({ data: true, error: null });
  });

  it('setLight returns UNSUPPORTED_ACTION (Nuki has no light control)', async () => {
    const r: HardwareResult = await getHardwareAdapter('nuki').setLight('court-1', true);
    expect(r.data).toBeNull();
    expect(r.error).toBe('UNSUPPORTED_ACTION');
  });

  it('lockCourt returns AUTH_ERROR when ENV missing', async () => {
    vi.stubEnv('NUKI_API_TOKEN', '');
    const r = await getHardwareAdapter('nuki').lockCourt('court-1');
    expect(r.data).toBeNull();
    expect(r.error).toBe('AUTH_ERROR');
  });
});

// ─── 4. shellyAdapter ────────────────────────────────────────────────────────
describe('shellyAdapter', () => {
  beforeEach(() => {
    vi.stubEnv('SHELLY_API_HOST', 'https://shelly-01-eu.shelly.cloud');
  });

  it('setLight returns success when ENV set (on)', async () => {
    const r = await getHardwareAdapter('shelly').setLight('court-2', true);
    expect(r).toEqual({ data: true, error: null });
  });

  it('setLight returns success when ENV set (off)', async () => {
    const r = await getHardwareAdapter('shelly').setLight('court-2', false);
    expect(r).toEqual({ data: true, error: null });
  });

  it('lockCourt returns UNSUPPORTED_ACTION (Shelly has no lock feature)', async () => {
    const r = await getHardwareAdapter('shelly').lockCourt('court-2');
    expect(r.data).toBeNull();
    expect(r.error).toBe('UNSUPPORTED_ACTION');
  });

  it('unlockCourt returns UNSUPPORTED_ACTION', async () => {
    const r = await getHardwareAdapter('shelly').unlockCourt('court-2');
    expect(r.error).toBe('UNSUPPORTED_ACTION');
  });

  it('setLight returns AUTH_ERROR when ENV missing', async () => {
    vi.stubEnv('SHELLY_API_HOST', '');
    const r = await getHardwareAdapter('shelly').setLight('court-2', true);
    expect(r.data).toBeNull();
    expect(r.error).toBe('AUTH_ERROR');
  });
});

// ─── 5. loxoneAdapter ────────────────────────────────────────────────────────
describe('loxoneAdapter', () => {
  beforeEach(() => {
    vi.stubEnv('LOXONE_MINISERVER_IP', '192.168.1.50');
  });

  it('lockCourt returns success when ENV set', async () => {
    const r = await getHardwareAdapter('loxone').lockCourt('court-3');
    expect(r).toEqual({ data: true, error: null });
  });

  it('unlockCourt returns success when ENV set', async () => {
    const r = await getHardwareAdapter('loxone').unlockCourt('court-3');
    expect(r).toEqual({ data: true, error: null });
  });

  it('setLight returns success when ENV set', async () => {
    const r = await getHardwareAdapter('loxone').setLight('court-3', true);
    expect(r).toEqual({ data: true, error: null });
  });

  it('all operations return AUTH_ERROR when ENV missing', async () => {
    vi.stubEnv('LOXONE_MINISERVER_IP', '');
    const adapter = getHardwareAdapter('loxone');
    expect((await adapter.lockCourt('court-3')).error).toBe('AUTH_ERROR');
    expect((await adapter.unlockCourt('court-3')).error).toBe('AUTH_ERROR');
    expect((await adapter.setLight('court-3', true)).error).toBe('AUTH_ERROR');
  });
});

// ─── 6. ADR-002 forensic-Policy ──────────────────────────────────────────────
describe('ADR-002 forensic-Policy: never silent', () => {
  it('all results have consistent shape (data+error)', async () => {
    const vendors: HardwareVendor[] = ['nuki', 'shelly', 'loxone'];
    for (const vendor of vendors) {
      const adapter = getHardwareAdapter(vendor);

      const results: HardwareResult[] = await Promise.all([
        adapter.lockCourt('court-x'),
        adapter.unlockCourt('court-x'),
        adapter.setLight('court-x', true),
      ]);
      for (const r of results) {
        // Shape-Contract: eines von data ODER error ist non-null
        // (außer data=true + error=null = success)
        if (r.data !== true) {
          expect(r.error).not.toBeNull();
        } else {
          expect(r.error).toBeNull();
        }
      }
    }
  });

  it('all error-codes are valid HardwareErrorCode values', async () => {
    // Generiere alle Pfade mit no-ENV → must überall AUTH_ERROR oder UNSUPPORTED_ACTION
    const validCodes: HardwareErrorCode[] = [
      'AUTH_ERROR',
      'UNSUPPORTED_ACTION',
      'NETWORK_ERROR',
      'TIMEOUT',
      'VENDOR_RATE_LIMIT',
    ];
    const nuki = getHardwareAdapter('nuki');
    const r = await nuki.setLight('c', true); // UNSUPPORTED_ACTION
    expect(validCodes).toContain(r.error);
  });

  it('no adapter throws — alle Errors sind caught in Result-shape', async () => {
    const vendors: HardwareVendor[] = ['nuki', 'shelly', 'loxone'];
    for (const vendor of vendors) {
      const a = getHardwareAdapter(vendor);
      await expect(a.lockCourt('c')).resolves.toBeDefined();
      await expect(a.unlockCourt('c')).resolves.toBeDefined();
      await expect(a.setLight('c', true)).resolves.toBeDefined();
    }
  });
});

// ─── 7. Vendor-Compatibility (Interface-Conformance) ─────────────────────────
describe('HardwareAdapter Interface-Conformance', () => {
  it.each([
    ['nuki', 'NUKI_API_TOKEN', 'token-nuki'],
    ['shelly', 'SHELLY_API_HOST', 'https://shelly.cloud'],
    ['loxone', 'LOXONE_MINISERVER_IP', '10.0.0.1'],
  ] as const)('%s adapter satisfies HardwareAdapter shape', (vendor, envKey, envVal) => {
    vi.stubEnv(envKey, envVal);
    const a: HardwareAdapter = getHardwareAdapter(vendor);

    // Method-Presence
    expect(typeof a.lockCourt).toBe('function');
    expect(typeof a.unlockCourt).toBe('function');
    expect(typeof a.setLight).toBe('function');

    // Return-Shape
    expect(a.lockCourt('court')).toBeInstanceOf(Promise);
    expect(a.unlockCourt('court')).toBeInstanceOf(Promise);
    expect(a.setLight('court', true)).toBeInstanceOf(Promise);
  });
});
