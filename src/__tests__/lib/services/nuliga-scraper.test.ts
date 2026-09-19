/**
 * Tests for lib/services/nuliga-scraper.ts (Q1 / 1.3.1 hardening).
 *
 * Covers the retry layer + Sentry layout-alarm acceptance criteria:
 *   AC-1: ≥3 retry attempts on transient HTTP/network errors with exponential backoff
 *   AC-2: Sentry.captureException fires on empty-parse (layout-drift) alarms
 *   AC-3: No retry on 4xx (fail-fast)
 *   AC-4: Parsed page with standings or matches does NOT trip layout alarm
 *
 * Mirrors the F6.1 anonymize.service.test.ts pattern: vi.mock + vi.hoisted
 * for shared mock references.
 *
 * Uses vi.useFakeTimers on retry-layer tests so the exponential backoff
 * (cumulative ~7.5s worst case) does not slow the suite down.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks (available before vi.mock factories run) ──────────────────
const { mockLog } = vi.hoisted(() => ({
  mockLog: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

const { mockWithScope, mockCaptureException } = vi.hoisted(() => {
  const setTag = vi.fn();
  const setContext = vi.fn();
  const setExtra = vi.fn();
  const setFingerprint = vi.fn();
  const captureException = vi.fn();
  const withScope = vi.fn((cb: (scope: unknown) => void) =>
    cb({ setTag, setContext, setExtra, setFingerprint })
  );
  return {
    mockWithScope: withScope,
    mockCaptureException: captureException,
  };
});

// ── Module mocks ───────────────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  createLogger: () => mockLog,
}));

vi.mock('@sentry/nextjs', () => ({
  withScope: mockWithScope,
  captureException: mockCaptureException,
}));

// ── Imports (must come AFTER the vi.mock factories) ────────────────────────
import { fetchNuligaGroupPage } from '@/lib/services/nuliga-scraper';

// Der Abruf ist standardmäßig aus (Kill-Switch) — die Parser-Tests brauchen ihn an.
process.env.NULIGA_SCRAPING = 'on';

describe('nuliga-scraper: Kill-Switch', () => {
  it('wirft ohne NULIGA_SCRAPING=on, ohne einen Request abzusetzen', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    process.env.NULIGA_SCRAPING = 'off';
    try {
      await expect(fetchNuligaGroupPage('https://htv.liga.nu/x')).rejects.toThrow(/deaktiviert/);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      process.env.NULIGA_SCRAPING = 'on';
      fetchSpy.mockRestore();
    }
  });
});

// ── Fixtures ────────────────────────────────────────────────────────────────
const VALID_URL =
  'https://htv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/groupPage?championship=Test&group=1';

const SAMPLE_HTML = `<html>
<head><title>nuLiga - Test Liga Gr. 001</title></head>
<body>
  <h2>Tabelle</h2>
  <table class="result-set">
    <tr>
      <th>Rang</th><th>Mannschaft</th><th>Begegnungen</th><th>S</th><th>U</th>
      <th>N</th><th>Punkte</th><th>Matchpunkte</th><th>Sätze</th><th>Spiele</th>
    </tr>
    <tr>
      <td>1</td><td>Team A</td><td>10</td><td>8</td><td>1</td>
      <td>1</td><td>17</td><td>12:4</td><td>36:12</td><td>280:195</td>
    </tr>
  </table>
  <h2>Spielplan</h2>
  <table class="result-set">
    <tr>
      <th>Datum</th><th>Heimmannschaft</th><th>Gastmannschaft</th><th>Spielbericht</th>
    </tr>
    <tr><td>27.06.2026</td><td>Team A</td><td>Team B</td><td>offen</td></tr>
  </table>
</body>
</html>`;

const EMPTY_HTML = `<html><body><h2>Tabelle</h2><p>Keine Daten</p></body></html>`;

const MATCHES_ONLY_HTML = `<html>
<body>
  <h2>Spielplan</h2>
  <table class="result-set">
    <tr><th>Datum</th><th>Heim</th><th>Gast</th></tr>
    <tr><td>27.06.2026</td><td>X</td><td>Y</td></tr>
  </table>
</body></html>`;

// ── Helpers ─────────────────────────────────────────────────────────────────
type FetchResponse = { status?: number; body?: string; throws?: Error };
const realFetch = global.fetch;

function mockFetchSequence(responses: FetchResponse[]): void {
  let i = 0;
  global.fetch = vi.fn(async () => {
    const r = responses[i++];
    if (!r) throw new Error(`test: fetch called #${i} but no more mocks queued`);
    if (r.throws) throw r.throws;
    return new Response(r.body ?? SAMPLE_HTML, {
      status: r.status ?? 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }) as unknown as typeof fetch;
}

/**
 * Drive `fetchNuligaGroupPage` to completion under vi.useFakeTimers().
 * Without this, the production backoff (~500ms/1s/2s/4s) would block real time.
 */
async function runWithFakeTimers<T>(promise: Promise<T>): Promise<T> {
  // Run any pending forward timers (incl. the request's Promise then the
  // backoff setTimeout) — vi.runAllTimersAsync drains all pending timers
  // AND microtasks in correct interleaving order.
  const timerRunner = vi.runAllTimersAsync();
  const result = await promise;
  await timerRunner;
  return result;
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
beforeEach(() => {
  mockLog.debug.mockClear();
  mockLog.info.mockClear();
  mockLog.warn.mockClear();
  mockLog.error.mockClear();
  mockLog.fatal.mockClear();
  mockCaptureException.mockClear();
  mockWithScope.mockClear();
});

afterEach(() => {
  global.fetch = realFetch;
  vi.useRealTimers();
});

// ────────────────────────────────────────────────────────────────────────────
// Q1/1.3.1 AC-1: Retry-layer with exponential backoff
// ────────────────────────────────────────────────────────────────────────────
describe('nuliga-scraper: fetchWithRetry retry layer (AC-1)', () => {
  it('returns parsed page on first successful attempt without retry', async () => {
    mockFetchSequence([{}]);
    const page = await fetchNuligaGroupPage(VALID_URL);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(page.standings).toHaveLength(1);
    expect(page.matches).toHaveLength(1);
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it('retries on 503 server error and succeeds on second attempt', async () => {
    vi.useFakeTimers();
    mockFetchSequence([
      { status: 503, body: 'Bad Gateway' },
      {}, // 200 with SAMPLE_HTML
    ]);
    const page = await runWithFakeTimers(fetchNuligaGroupPage(VALID_URL));
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(page.standings).toHaveLength(1);
    // Exactly one 5xx warn logged
    expect(mockLog.warn).toHaveBeenCalledTimes(1);
    expect(mockLog.warn).toHaveBeenCalledWith(
      'nuLiga-fetch 5xx — retry',
      expect.objectContaining({ status: 503, attempt: 0 })
    );
  });

  it('throws after exhausting all retries (4 total = 1 initial + 3) on persistent 503, with retry-count context', async () => {
    vi.useFakeTimers();
    mockFetchSequence([{ status: 503 }, { status: 503 }, { status: 503 }, { status: 503 }]);
    await expect(runWithFakeTimers(fetchNuligaGroupPage(VALID_URL))).rejects.toThrow(
      /HTTP 503 after 4 attempts/
    );
    expect(global.fetch).toHaveBeenCalledTimes(4);
    // 3 retry warnings fired (one per retry, none on the final exhausted-retry path)
    expect(mockLog.warn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on 404 client error (fails fast)', async () => {
    mockFetchSequence([{ status: 404, body: 'Not Found' }]);
    await expect(fetchNuligaGroupPage(VALID_URL)).rejects.toThrow(/HTTP 404/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it('retries on network TypeError and surfaces the underlying fetch failure', async () => {
    vi.useFakeTimers();
    mockFetchSequence([
      { throws: new TypeError('fetch failed') },
      { throws: new TypeError('fetch failed') },
      { throws: new TypeError('fetch failed') },
      { throws: new TypeError('fetch failed') },
    ]);
    await expect(runWithFakeTimers(fetchNuligaGroupPage(VALID_URL))).rejects.toThrow(
      /fetch failed/
    );
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(mockLog.warn).toHaveBeenCalledTimes(3);
    expect(mockLog.warn).toHaveBeenLastCalledWith(
      'nuLiga-fetch network error — retry',
      expect.objectContaining({ error: expect.stringContaining('fetch failed') })
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Q1/1.3.1 AC-2: Sentry layout-alarm on empty parse
// ────────────────────────────────────────────────────────────────────────────
describe('nuliga-scraper: layout-alarm (AC-2)', () => {
  it('captures Sentry exception with structured tags when parse yields empty HTML', async () => {
    mockFetchSequence([{ body: EMPTY_HTML, status: 200 }]);
    await fetchNuligaGroupPage(VALID_URL);
    expect(mockWithScope).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const errArg = mockCaptureException.mock.calls[0][0];
    expect(errArg).toBeInstanceOf(Error);
    expect(String(errArg)).toMatch(/nuLiga-Layout-Alarm/);
  });

  it('does NOT trip the layout alarm when only the schedule is parseable (no false alarm)', async () => {
    mockFetchSequence([{ body: MATCHES_ONLY_HTML, status: 200 }]);
    await fetchNuligaGroupPage(VALID_URL);
    expect(mockWithScope).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('does NOT trip the layout alarm on a successful full parse (happy path baseline)', async () => {
    mockFetchSequence([{}]); // SAMPLE_HTML → 1 standing + 1 match
    await fetchNuligaGroupPage(VALID_URL);
    expect(mockWithScope).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('logs the layout alarm at WARN level (not ERROR) — guards against Sentry double-capture', async () => {
    // lib/logger.error() auto-fires Sentry.captureException. Layout-alarm MUST
    // use log.warn so logger does not create a duplicate Sentry entry in
    // addition to the explicit Sentry.withScope(...) capture above.
    mockFetchSequence([{ body: EMPTY_HTML, status: 200 }]);
    await fetchNuligaGroupPage(VALID_URL);
    expect(mockLog.warn).toHaveBeenCalledWith(
      'nuLiga-Parse lieferte leere Ergebnisse — Layout-Alarm',
      expect.objectContaining({ url: VALID_URL })
    );
    expect(mockLog.error).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// URL validation (regression: hardening must not break input checks)
// ────────────────────────────────────────────────────────────────────────────
describe('nuliga-scraper: input validation (regression)', () => {
  it('rejects non-nuliga hostnames before issuing any fetch', async () => {
    // Explicit Spy so .not.toHaveBeenCalled() can be asserted (a vi.fn spy
    // is required; the bare real Fetch is not a spy).
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    global.fetch = fetchSpy;
    const evil = 'https://evil.example.com/groupPage';
    await expect(fetchNuligaGroupPage(evil)).rejects.toThrow(/Domain muss \*\.liga\.nu sein/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('nuliga-scraper: Spielplan mit Spalte „Spielort" (Layout Sommer 2026)', () => {
  // Echter Aufbau: „Datum" mit colspan=3, dann Spielort, Heim, Gast, … —
  // die alten festen Indizes lasen hier Spielort/Heim statt Heim/Gast.
  const HTML = `<html><body>
    <h2>Spielplan</h2>
    <table class="result-set">
      <tr><th colspan="3">Datum</th><th>Spielort</th><th>Heimmannschaft</th><th>Gastmannschaft</th>
        <th>Matchpunkte</th><th>Sätze</th><th>Spiele</th><th>Spielbericht</th></tr>
      <tr><td>So</td><td>10.05.2026 14:00</td><td></td><td></td><td>TC A</td><td>TC B</td>
        <td>3:3</td><td>6:7</td><td>53:61</td><td><a href="meetingReport?meeting=1">anzeigen</a></td></tr>
      <tr><td></td><td></td><td></td><td>Sportpark X</td><td>TC C</td><td>TC D</td>
        <td></td><td></td><td></td><td></td></tr>
    </table></body></html>`;

  it('liest Heim/Gast/Ergebnis über die Kopfzeile, Folgezeilen erben das Datum', async () => {
    mockFetchSequence([{ body: HTML }]);
    const { matches } = await fetchNuligaGroupPage(VALID_URL);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      date: '10.05.2026 14:00',
      homeTeam: 'TC A',
      awayTeam: 'TC B',
      matchPoints: '3:3',
      sets: '6:7',
      games: '53:61',
      status: 'completed',
    });
    expect(matches[0].reportUrl).toContain('/wa/meetingReport?meeting=1');
    expect(matches[1]).toMatchObject({
      date: '10.05.2026 14:00',
      homeTeam: 'TC C',
      awayTeam: 'TC D',
      status: 'pending',
    });
  });
});

describe('nuliga-scraper: Jahrgang', () => {
  it('liest den Jahrgang aus der Klammer hinter dem Namen', async () => {
    const { extractBirthYear, normalizePlayerName } = await import('@/lib/services/nuliga-scraper');
    expect(extractBirthYear('Muster, Lisa (2014)')).toBe(2014);
    expect(extractBirthYear('Muster, Lisa')).toBeNull();
    expect(normalizePlayerName('Muster, Lisa (2014)')).toBe('Lisa Muster');
  });
});
