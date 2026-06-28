/**
 * ════════════════════════════════════════════════════════════════════════════════
 * lib/hardware/adapter.ts
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * TICKET: 3.1.1 — Hardware-Adapter-Interface (Q3/3.1 Smart-Court API)
 *
 * @runtime server-only — do NOT import this module from client components.
 *   `process.env.X`-reads return `undefined` on the browser; subsequent
 *   adapter-calls would silent-but-systematically return `AUTH_ERROR`.
 *   Server-side only (used from /api/webhooks/* routes; 3.1.2).
 *
 * WHAT THIS MODULE DOES
 *
 *   Plugin-Interface + konkrete Vendor-Adapter für Smart-Court-Hardware:
 *     - Nuki   → Türschloss-Steuerung (lock/unlock)
 *     - Shelly → Smarte Licht-Steckdose (an/aus)
 *     - Loxone → Loxone-MiniServer Gebäudeautomation (Tür + Licht)
 *
 *   Per ADR-002 forensic-policy: kein silent-fallback. Jeder Adapter liefert
 *   ein explizites `{ data, error }`-Result. Fehlende ENV-Credentials oder
 *   nicht-unterstützte Aktionen werden als String-Error surfaced.
 *
 *   1.0-Surface: `lockCourt` / `unlockCourt` / `setLight` — minimal-invasiv
 *   Tickets 3.1.2 (Webhook) und 3.1.3 (Admin-UI) bauen auf diesem Interface.
 *
 * IT DOES NOT
 *   - Echte HTTP-Calls absetzen (1.0 ist Mock-Implementierung mit
 *     ENV-Credential-Validation; Vendor-Calls folgen in 3.1.2)
 *   - Multi-Tenant-Konfiguration (per-Club) handhaben — kommt in 3.1.4
 *   - Retry-Logik auf 5xx implementieren (ADR-010, separates Ticket)
 *
 * CONFIGURATION
 *
 *   Per Vendor wird 1 ENV-Variable als Berechtigungs-Check erwartet:
 *     - Nuki:    `NUKI_API_TOKEN`
 *     - Shelly:  `SHELLY_API_HOST`
 *     - Loxone:  `LOXONE_MINISERVER_IP`
 *
 *   Bei fehlender ENV-Variable retourniert der Adapter
 *   `{ data: null, error: 'AUTH_ERROR' }` — kein Crash, kein silent-default.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Discriminated-Vendor-Identifikator (Type-Safety gegen falsche Vendor-Strings).
 * Erweiterbar in Folge-Tickets ohne Breaking-Change (Additive-Only).
 */
export type HardwareVendor = 'nuki' | 'shelly' | 'loxone';

/**
 * Single-source-of-truth runtime-array für Z.enum + Iteration. Verwendet von
 * route.ts (Zod-Validation), client.tsx (Card-Grid-Iteration), webhook (vendor-validation).
 * NICHT ändern ohne vorher Hardware-Vendor-Adapter zu implementieren (siehe listHardwareVendors).
 */
export const HARDWARE_VENDORS = ['nuki', 'shelly', 'loxone'] as const satisfies readonly HardwareVendor[];

/**
 * Alle-Mögliche-Error-Strings für Hardware-Adapter-Calls.
 * Konvention: SCREAMING_SNAKE_CASE, semantisch eindeutig, maschinenlesbar.
 * Erweiterungen müssen hier ergänzt + alle 3-Adapter-Implementationen auditiert.
 */
export type HardwareErrorCode =
  | 'AUTH_ERROR' // ENV-Credentials fehlen
  | 'UNSUPPORTED_ACTION' // Vendor kann diese Aktion nicht (z.B. Shelly.lockCourt)
  | 'NETWORK_ERROR' // (reserviert für 3.1.2 echte HTTP-Calls)
  | 'TIMEOUT' // (reserviert für 3.1.2)
  | 'VENDOR_RATE_LIMIT'; // (reserviert für 3.1.2)

/**
 * HardwareOperation-Result-Shape (per lib/services/*-Konvention:
 * `Promise<{ data: T | null; error: string | null }>`).
 *
 *   - `data: true`  → Operation erfolgreich
 *   - `data: false` → Operation fehlgeschlagen, vendor-spezifische Logik
 *                     (z.B. Schloss verklemmt). `error` ist null.
 *   - `data: null`  → Vor-Operative-Bedingung nicht erfüllt (Auth, Routing).
 *                     `error` enthält HardwareErrorCode.
 */
export type HardwareResult = {
  data: boolean | null;
  error: HardwareErrorCode | null;
};

/**
 * HardwareAdapter-Interface (Vendor-agnostic).
 *
 * Implementierende-Klassen sind verpflichtet:
 *   1. Bei fehlender ENV-Variable → `{ data: null, error: 'AUTH_ERROR' }`
 *   2. Bei nicht-unterstützter Action → `{ data: null, error: 'UNSUPPORTED_ACTION' }`
 *   3. Bei erfolgreicher Operation → `{ data: true, error: null }`
 *   4. Niemals throw — Errors werden als Result-Code zurückgegeben (ADR-002).
 */
export interface HardwareAdapter {
  /**
   * Tür / Schloss auf diesem Court verriegeln.
   * Bei Vendor ohne Türschloss-Support: `UNSUPPORTED_ACTION` retournieren.
   */
  lockCourt(courtId: string): Promise<HardwareResult>;

  /**
   * Tür / Schloss auf diesem Court entriegeln.
   * Bei Vendor ohne Türschloss-Support: `UNSUPPORTED_ACTION` retournieren.
   */
  unlockCourt(courtId: string): Promise<HardwareResult>;

  /**
   * Licht auf diesem Court ein-/ausschalten.
   * Bei Vendor ohne Licht-Support: `UNSUPPORTED_ACTION` retournieren.
   */
  setLight(courtId: string, isOn: boolean): Promise<HardwareResult>;
}

// ════════════════════════════════════════════════════════════════════════════════
// ENV-Helper (typed access; zentrale Vendor-cENV-Registry gegen Magic-Strings)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Vendor-zu-ENV-Name-Registry (Single-Source-of-Truth für Credential-Lookup).
 * Hinzufügen eines neuen Vendors verlangt hier einen Eintrag; das lässt auch
 * Tests/Admin-UI denselben String benutzen statt eigene Repräsentationen.
 */
export const HARDWARE_ENV_VARS: Record<HardwareVendor, string> = {
  nuki: 'NUKI_API_TOKEN',
  shelly: 'SHELLY_API_HOST',
  loxone: 'LOXONE_MINISERVER_IP',
};

/**
 * Helper: Prüft ENV-Variable auf nicht-leeren String.
 * Whitespace-Only-Strings werden als '' behandelt (defensive).
 */
const hasVendorEnv = (vendor: HardwareVendor): boolean => {
  const v = process.env[HARDWARE_ENV_VARS[vendor]];
  return typeof v === 'string' && v.trim().length > 0;
};

// ════════════════════════════════════════════════════════════════════════════════
// Vendor-Implementierungen (1.0: Mock mit ENV-Credential-Validation)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Nuki-Adapter: spezialisiert auf Türschloss-Steuerung.
 * SetLight ist nicht Teil des Nuki-Funktionsumfangs.
 *
 * ENV: NUKI_API_TOKEN (Bearer-Token gegen Nuki-Web-API)
 */
const nukiAdapter: HardwareAdapter = {
  async lockCourt(_courtId: string): Promise<HardwareResult> {
    if (!hasVendorEnv('nuki')) {
      return { data: null, error: 'AUTH_ERROR' };
    }
    // 1.0-Mock: echte HTTP-Calls folgen in 3.1.2 (Webhook-Route)
    return { data: true, error: null };
  },

  async unlockCourt(_courtId: string): Promise<HardwareResult> {
    if (!hasVendorEnv('nuki')) {
      return { data: null, error: 'AUTH_ERROR' };
    }
    return { data: true, error: null };
  },

  async setLight(_courtId: string, _isOn: boolean): Promise<HardwareResult> {
    // Nuki-Web-API bietet keine Licht-Steuerung → explizit surfaced
    return { data: null, error: 'UNSUPPORTED_ACTION' };
  },
};

/**
 * Shelly-Adapter: spezialisiert auf smarte Licht-Steckdosen (Cloud-API).
 * Türschloss-Aktionen werden explizit als unsupported abgewiesen.
 *
 * ENV: SHELLY_API_HOST (z.B. https://shelly-01-eu.shelly.cloud)
 */
const shellyAdapter: HardwareAdapter = {
  async lockCourt(_courtId: string): Promise<HardwareResult> {
    // Shelly-Cloud-API hat kein Schloss-Feature → explizit surfaced
    return { data: null, error: 'UNSUPPORTED_ACTION' };
  },

  async unlockCourt(_courtId: string): Promise<HardwareResult> {
    return { data: null, error: 'UNSUPPORTED_ACTION' };
  },

  async setLight(_courtId: string, _isOn: boolean): Promise<HardwareResult> {
    if (!hasVendorEnv('shelly')) {
      return { data: null, error: 'AUTH_ERROR' };
    }
    return { data: true, error: null };
  },
};

/**
 * Loxone-Adapter: Gebäudeautomation über Loxone-MiniServer (Web-API).
 * Unterstützt sowohl Türschloss als auch Licht (kompletter Funktionsumfang).
 *
 * ENV: LOXONE_MINISERVER_IP (z.B. 192.168.1.50 — lokales Netzwerk)
 */
const loxoneAdapter: HardwareAdapter = {
  async lockCourt(_courtId: string): Promise<HardwareResult> {
    if (!hasVendorEnv('loxone')) {
      return { data: null, error: 'AUTH_ERROR' };
    }
    return { data: true, error: null };
  },

  async unlockCourt(_courtId: string): Promise<HardwareResult> {
    if (!hasVendorEnv('loxone')) {
      return { data: null, error: 'AUTH_ERROR' };
    }
    return { data: true, error: null };
  },

  async setLight(_courtId: string, _isOn: boolean): Promise<HardwareResult> {
    if (!hasVendorEnv('loxone')) {
      return { data: null, error: 'AUTH_ERROR' };
    }
    return { data: true, error: null };
  },
};

// ════════════════════════════════════════════════════════════════════════════════
// Selection / Factory
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Vendor-Registry (statische Compile-Time-Discovery).
 * TypeScript `Record<HardwareVendor, HardwareAdapter>` enforced Vollständigkeit:
 * hinzufügen eines neuen Vendors zur HardwareVendor-Union ohne Adapter-Eintrag
 * erzeugt einen Compile-Error.
 */
const VENDOR_REGISTRY: Record<HardwareVendor, HardwareAdapter> = {
  nuki: nukiAdapter,
  shelly: shellyAdapter,
  loxone: loxoneAdapter,
};

/**
 * Factory: liefert den richtigen Adapter für einen Vendor.
 *
 * Throws nur, falls TypeScript's Exhaustiveness-Check versagt (sollte mit
 * `Record<HardwareVendor, …>` nie passieren — defence-in-depth bleibt aber
 * für Runtime-Edge-Cases erhalten).
 *
 * Beispiel-Verwendung in 3.1.2 Webhook-Route:
 * ```ts
 * const adapter = getHardwareAdapter(club.hardwareVendor);
 * const { data, error } = await adapter.lockCourt(booking.courtId);
 * if (error) await notifyAdmin(error);
 * ```
 */
export function getHardwareAdapter(vendor: HardwareVendor): HardwareAdapter {
  return VENDOR_REGISTRY[vendor];
}

/**
 * Helper: Listet alle unterstützten Vendor-Namen auf.
 * Nützlich für Admin-UI (Dropdown) und Config-Validation.
 */
export function listHardwareVendors(): readonly HardwareVendor[] {
  return Object.keys(VENDOR_REGISTRY) as HardwareVendor[];
}
