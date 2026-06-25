import { describe, it, expect } from 'vitest';
import {
  calculateVerzugszins,
  calculateVerzugszinsForInvoice,
  type BaseRateSnapshot,
} from '@/lib/billing/verzugszins';

const FIXED_RATE_H1_2026: BaseRateSnapshot[] = [
  { validFrom: '2026-01-01', rate: 0.0227 }, // 2,27 %
];

const TWO_PERIODS: BaseRateSnapshot[] = [
  { validFrom: '2026-01-01', rate: 0.0227 }, // H1/2026
  { validFrom: '2026-07-01', rate: 0.0153 }, // H2/2026
];

describe('calculateVerzugszins — §288 BGB (ACT/360)', () => {
  it('B2C: wendet Basiszinssatz + 5 Prozentpunkte an (§288 Abs. 1 BGB)', () => {
    // 100 EUR, Verzug 01.03.2026 → 30.04.2026 = 60 × 24 h Spanne
    // BGH-Inklusiv (beide Endpunkte): 61 Verzugstage
    // Zinssatz: 0.0227 + 0.05 = 0.0727 → 100 × 0.0727 × 61/360 = 1.2322... EUR
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: new Date('2026-03-01'),
      paymentOrEndDate: new Date('2026-04-30'),
      isB2B: false,
      baseRates: FIXED_RATE_H1_2026,
    });

    expect(result.legalBasis).toBe('§288 Abs. 1 BGB (B2C)');
    expect(result.marginApplied).toBe(0.05);
    expect(result.totalDays).toBe(61);
    expect(result.totalInterest).toBeCloseTo(1.23, 2);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]?.appliedRate).toBeCloseTo(0.0727);
    expect(result.lineItems[0]?.interest).toBeCloseTo(1.23, 2);
  });

  it('B2B: wendet Basiszinssatz + 9 Prozentpunkte an (§288 Abs. 2 BGB)', () => {
    // 100 EUR, 60 × 24 h Spanne → 61 Verzugstage (BGH-Inklusiv)
    // Zinssatz: 0.0227 + 0.09 = 0.1127 → 100 × 0.1127 × 61/360 = 1.9103... EUR
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: new Date('2026-03-01'),
      paymentOrEndDate: new Date('2026-04-30'),
      isB2B: true,
      baseRates: FIXED_RATE_H1_2026,
    });

    expect(result.legalBasis).toBe('§288 Abs. 2 BGB (B2B)');
    expect(result.marginApplied).toBe(0.09);
    expect(result.totalDays).toBe(61);
    expect(result.totalInterest).toBeCloseTo(1.91, 2);
    expect(result.lineItems[0]?.appliedRate).toBeCloseTo(0.1127);
  });

  it('B2B vs. B2C: gleicher Verzug-Zeitraum ergibt exakt +4 Prozentpunkte Differenz', () => {
    const args = {
      principalAmount: 1000,
      verzugStartDate: new Date('2026-03-01'),
      paymentOrEndDate: new Date('2026-04-30'),
      baseRates: FIXED_RATE_H1_2026,
    };
    const b2c = calculateVerzugszins({ ...args, isB2B: false });
    const b2b = calculateVerzugszins({ ...args, isB2B: true });

    // 4 PP × 1000 × 61/360 ≈ 6.7777... EUR (BGH-Inklusiv: 61 Tage)
    const diff = b2b.totalInterest - b2c.totalInterest;
    expect(diff).toBeGreaterThanOrEqual(6.77);
    expect(diff).toBeLessThanOrEqual(6.79);
    // Sanity: b2b ist immer größer als b2c
    expect(b2b.totalInterest).toBeGreaterThan(b2c.totalInterest);
  });

  it('Halbjährlicher Basiszinssatz-Wechsel: 2 lineItems mit unterschiedlichen Sätzen', () => {
    // 1.4.2026 → 31.8.2026: ACT/360 BGH-Inklusiv → 153 Kalendertage
    //   H1 (1.4. → 1.7.): 92 Tage (inclusive 1.4. UND 1.7. — 30+31+30+1 = 92 Kalendertage)
    //   H2 (2.7. → 31.8.): 61 Tage (Stichtag 1.7. bereits H1 zugeordnet; 30+31 = 61)
    //   Summe: 153 Tage für 1.4.→31.8. inklusiv (30+31+30+31+31 = 153 Kalendertage).
    const result = calculateVerzugszins({
      principalAmount: 1000,
      verzugStartDate: new Date('2026-04-01'),
      paymentOrEndDate: new Date('2026-08-31'),
      isB2B: false,
      baseRates: TWO_PERIODS,
    });

    expect(result.lineItems).toHaveLength(2);
    expect(result.totalDays).toBe(153); // 92 + 61 (Stichtag 1.7. nicht doppelt gezählt)
    expect(result.lineItems[0]?.baseRate).toBe(0.0227);
    expect(result.lineItems[0]?.days).toBe(92);
    expect(result.lineItems[1]?.baseRate).toBe(0.0153);
    expect(result.lineItems[1]?.days).toBe(61);

    // H1: 1000 × 0.0727 × 92/360 ≈ 18.5789... EUR
    expect(result.lineItems[0]?.interest).toBeCloseTo(18.58, 1);
    // H2: 1000 × 0.0653 × 61/360 ≈ 11.0669... EUR
    expect(result.lineItems[1]?.interest).toBeCloseTo(11.07, 1);
    // Summe ≈ 29.65 EUR
    expect(result.totalInterest).toBeCloseTo(29.65, 1);
    expect(result.sumOfLineItems).toBeCloseTo(result.totalInterest, 2);
  });

  it('Off-by-one: paymentOrEndDate == verzugStartDate → 0 Tage, 0 EUR', () => {
    const date = new Date('2026-04-15');
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: date,
      paymentOrEndDate: date,
      isB2B: false,
      baseRates: FIXED_RATE_H1_2026,
    });

    expect(result.totalDays).toBe(0);
    expect(result.totalInterest).toBe(0);
    expect(result.lineItems).toHaveLength(0);
    // legalBasis und marginApplied bleiben gefüllt (für Audit)
    expect(result.legalBasis).toBe('§288 Abs. 1 BGB (B2C)');
    expect(result.marginApplied).toBe(0.05);
  });

  it('BGH-Konformität: Teil-Tages-Verzug zählt als 1 voller Verzugstag', () => {
    // BGH-Praxis (§288 BGB i.V.m. §286 BGB): jeder Kalendertag, an dem auch nur
    // partiell Verzug vorliegt, zählt als voller Verzugstag
    // (siehe JSDoc an `days`-Berechnung in calculateVerzugszins).
    // 12 Stunden Verzug ab Mitternacht UTC:
    //   • Reine floor-Formel: 0 Tage → BGH-widrig (Tage "verfallen" durch Rundung).
    //   • BGH-Inklusiv-Formel: floor((12h + 24h) / 24h) = 1 Tag → BGH-konform.
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: new Date('2026-04-01T00:00:00Z'),
      paymentOrEndDate: new Date('2026-04-01T12:00:00Z'),
      isB2B: false,
      baseRates: FIXED_RATE_H1_2026,
    });

    expect(result.totalDays).toBe(1);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]?.days).toBe(1);
  });

  it('BGH-Inklusiv: exakte 24-h-Mitternacht-Differenz zählt als 2 Verzugstage', () => {
    // 01.04. 00:00 → 02.04. 00:00 = genau 24 h Spanne.
    // BGH-Inklusiv (beide Endpunkte): 1. April UND 2. April sind beide Verzugstage = 2.
    // Die ältere exklusive floor-Formel würde 1 liefern — die Inklusiv-Formel ist +1.
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: new Date('2026-04-01T00:00:00Z'),
      paymentOrEndDate: new Date('2026-04-02T00:00:00Z'),
      isB2B: false,
      baseRates: FIXED_RATE_H1_2026,
    });

    expect(result.totalDays).toBe(2);
    expect(result.lineItems[0]?.days).toBe(2);
  });

  it('Off-by-one: paymentOrEndDate < verzugStartDate → 0 (Zukunft)', () => {
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: new Date('2026-12-31'),
      paymentOrEndDate: new Date('2026-04-01'),
      isB2B: false,
      baseRates: FIXED_RATE_H1_2026,
    });

    expect(result.totalDays).toBe(0);
    expect(result.totalInterest).toBe(0);
    expect(result.lineItems).toHaveLength(0);
  });

  it('Stichtag exakt (01.07. als paymentOrEndDate): 1. Juli vollständig H1 zugeordnet', () => {
    // Verzug endet EXAKT auf dem Stichtag der H2-Periode → nur H1 produziert ein lineItem.
    // BGH-Inklusiv: 1.4. → 1.7. = 92 Kalendertage (30+31+30+1 = 92 mit 1.7. inclusive);
    // der Stichtag 01.07. wird der H1-Periode zugeordnet (keine Doppelzählung durch H2).
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: new Date('2026-04-01'),
      paymentOrEndDate: new Date('2026-07-01'),
      isB2B: false,
      baseRates: TWO_PERIODS,
    });

    expect(result.totalDays).toBe(92); // BGH-Inklusiv: 1.4. UND 1.7. beide gezählt
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]?.baseRate).toBe(0.0227);
  });

  it('Fehler: principalAmount = 0 wirft Error', () => {
    expect(() =>
      calculateVerzugszins({
        principalAmount: 0,
        verzugStartDate: new Date('2026-04-01'),
        paymentOrEndDate: new Date('2026-08-01'),
        isB2B: false,
        baseRates: FIXED_RATE_H1_2026,
      })
    ).toThrow(/principalAmount.*> 0/);
  });

  it('Fehler: principalAmount < 0 wirft Error', () => {
    expect(() =>
      calculateVerzugszins({
        principalAmount: -100,
        verzugStartDate: new Date('2026-04-01'),
        paymentOrEndDate: new Date('2026-08-01'),
        isB2B: false,
        baseRates: FIXED_RATE_H1_2026,
      })
    ).toThrow(/principalAmount.*> 0/);
  });

  it('Fehler: leere baseRates wirft Error', () => {
    expect(() =>
      calculateVerzugszins({
        principalAmount: 100,
        verzugStartDate: new Date('2026-04-01'),
        paymentOrEndDate: new Date('2026-08-01'),
        isB2B: false,
        baseRates: [],
      })
    ).toThrow(/Basiszinssatz-Snapshot/);
  });

  it('Sortierung: unsortierte baseRates werden intern korrekt verarbeitet', () => {
    // UNSORTIERTE Eingabe (H2 vor H1) — Funktion muss selbst sortieren
    const unsorted: BaseRateSnapshot[] = [
      { validFrom: '2026-07-01', rate: 0.0153 },
      { validFrom: '2026-01-01', rate: 0.0227 },
    ];
    const result = calculateVerzugszins({
      principalAmount: 1000,
      verzugStartDate: new Date('2026-04-01'),
      paymentOrEndDate: new Date('2026-08-31'),
      isB2B: false,
      baseRates: unsorted,
    });

    expect(result.lineItems[0]?.baseRate).toBe(0.0227); // H1 zuerst
    expect(result.lineItems[1]?.baseRate).toBe(0.0153); // H2 danach
  });

  it('Periodenüberschneidung: Verzug-Beginn liegt VOR Periode 1 (effectiveStart = verzugStartDate)', () => {
    // Verzug beginnt 15.1.2026 → Periode 1 startet 1.1.2026 → effectiveStart = verzugStartDate
    // Periode 1 läuft bis 1.7.2026 = 168 Tage (1.1.→1.7.) aber nur 1.7.-15.1.+1 = von 15.1.-1.7.
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: new Date('2026-01-15'),
      paymentOrEndDate: new Date('2026-04-15'),
      isB2B: false,
      baseRates: TWO_PERIODS,
    });

    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]?.baseRate).toBe(0.0227); // Verzug fällt nur in H1
    expect(result.lineItems[0]?.days).toBeGreaterThan(80);
    expect(result.lineItems[0]?.days).toBeLessThan(100);
  });
});

describe('calculateVerzugszinsForInvoice — §286 Abs. 3 BGB', () => {
  const RATES: BaseRateSnapshot[] = [{ validFrom: '2026-01-01', rate: 0.0227 }];

  it('Default: Verzug startet 30 Tage nach dueDate (§286 Abs. 3 BGB)', () => {
    const dueDate = new Date('2026-04-01');
    const computationDate = new Date('2026-05-15');

    const result = calculateVerzugszinsForInvoice({
      invoiceAmountEur: 100,
      dueDate,
      isB2B: false,
      baseRates: RATES,
      computationDate,
    });

    // verzugStart = 1.5.2026 (dueDate + 30 Tage); 1.5. → 15.5. = 14 × 24 h Spanne
    // BGH-Inklusiv: 15 Verzugstage (1.5. UND 15.5. beide gezählt).
    expect(result.totalDays).toBe(15);
    expect(result.totalInterest).toBeCloseTo((100 * 0.0727 * 15) / 360, 2);
  });

  it('firstDunningAt überschreibt Default-30-Tage-Regel', () => {
    const dueDate = new Date('2026-04-01');
    const firstDunningAt = new Date('2026-04-10'); // Vor 30-Tage-Frist → Verzug beginnt früher
    const computationDate = new Date('2026-05-15');

    const result = calculateVerzugszinsForInvoice({
      invoiceAmountEur: 100,
      dueDate,
      isB2B: false,
      baseRates: RATES,
      firstDunningAt,
      computationDate,
    });

    // verzugStart = 10.4.; 10.4. → 15.5. = 35 × 24 h Spanne
    // BGH-Inklusiv: 36 Verzugstage.
    expect(result.totalDays).toBe(36);
  });

  it('computationDate default = now (Funktion ohne expliziten Parameter)', () => {
    const dueDate = new Date('2020-01-01'); // weit in der Vergangenheit
    const result = calculateVerzugszinsForInvoice({
      invoiceAmountEur: 100,
      dueDate,
      isB2B: false,
      baseRates: RATES,
    });

    // totalInterest > 0 abhängig von 'now' bei Test-Lauf → nicht hart prüfen
    expect(result.totalDays).toBeGreaterThan(0);
    expect(result.totalInterest).toBeGreaterThan(0);
  });
});

describe('calculateVerzugszins — BGH-Inklusiv Edge-Cases (Sekunden + DST)', () => {
  it('Großzügige Sekunden-Toleranz: 1s past Mitternacht zählt als 1 voller Tag', () => {
    // ms = 1_000; BGH-Inklusiv ceil-tolerance:
    //   floor((1_000 + 86_400_000) / 86_400_000) = floor(1.000011…) = 1.
    // Ältere reine floor-Formel hätte 0 Tage geliefert → BGH-widrig.
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: new Date('2026-04-01T00:00:00Z'),
      paymentOrEndDate: new Date('2026-04-01T00:00:01Z'),
      isB2B: false,
      baseRates: FIXED_RATE_H1_2026,
    });
    expect(result.totalDays).toBe(1);
    expect(result.lineItems[0]?.days).toBe(1);
  });

  it('Sub-Tages-Toleranz: 23h59m vor Mitternacht (gleicher Kalendertag) zählt als 1 Tag', () => {
    // Verzug von Mitternacht bis 23:59 desselben Tages = 23h59m.
    // ms = 23 × 3_600_000 + 59 × 60_000 = 86_340_000.
    // BGH-Inklusiv: floor((86_340_000 + 86_400_000) / 86_400_000) = 1
    //   → Tag 1 noch nicht überschritten, daher 1 Tag.
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: new Date('2026-04-01T00:00:00Z'),
      paymentOrEndDate: new Date('2026-04-01T23:59:00Z'),
      isB2B: false,
      baseRates: FIXED_RATE_H1_2026,
    });
    expect(result.totalDays).toBe(1);
    expect(result.lineItems[0]?.days).toBe(1);
  });

  it('Tages-Wechsel-Toleranz: 47h59m59s vor 2. Mitternacht zählt als 2 Tage', () => {
    // Verzug beginnt Mitternacht Tag 1, endet 1 Sekunde vor Mitternacht Tag 3.
    // Wand-Uhr-Spanne = 47h59m59s, berührt Tag 1 + Tag 2 vollständig.
    // ms = 47 × 3_600_000 + 59 × 60_000 + 59 × 1_000 = 172_799_000.
    // BGH-Inklusiv: floor((172_799_000 + 86_400_000) / 86_400_000) = 2
    //   → Tag 1 + Tag 2 = 2 Tage (1 Sekunde vor Mitternacht Tag 3).
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: new Date('2026-04-01T00:00:00Z'),
      paymentOrEndDate: new Date('2026-04-02T23:59:59Z'),
      isB2B: false,
      baseRates: FIXED_RATE_H1_2026,
    });
    expect(result.totalDays).toBe(2);
    expect(result.lineItems[0]?.days).toBe(2);
  });

  it('ISO-Zeitzone + DST spring-forward (2026-03-29, Europe/Berlin): Wand-Uhr 3h = UTC 2h', () => {
    // Spring forward: 2026-03-29, 02:00 CET (UTC+1) → 03:00 CEST (UTC+2) — 1 h „verloren".
    // Berlin 01:30+01:00 = 00:30 UTC; Berlin 04:30+02:00 = 02:30 UTC → 2 h UTC-Millisekunden.
    // Wand-Uhr-Differenz 3 h, aber UTC-Differenz 2 h (die Stunde 02:00→03:00 existiert
    // in Berlin nicht). Defense-in-Depth: ms-Assertion bestätigt korrektes ISO-Parsing.
    // TWO_PERIODS hier korrekt, da March 2026 fest in H1 liegt (Satz 0.0227).
    const start = new Date('2026-03-29T01:30:00+01:00'); // = 2026-03-29T00:30:00Z
    const end = new Date('2026-03-29T04:30:00+02:00'); // = 2026-03-29T02:30:00Z
    const msSpan = end.getTime() - start.getTime();
    expect(msSpan).toBe(2 * 60 * 60 * 1000); // 7_200_000 ms = 2 h UTC, NICHT 3 h Wand-Uhr

    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: start,
      paymentOrEndDate: end,
      isB2B: false,
      baseRates: TWO_PERIODS,
    });
    // BGH-Inklusiv auf 7,2M ms: floor((7_200_000 + 86_400_000) / 86_400_000) = 1 Tag
    expect(result.totalDays).toBe(1);
    // Sanity: H1-Satz kommt im H1-2026-Monat korrekt zur Anwendung
    expect(result.lineItems[0]?.baseRate).toBe(0.0227);
  });

  it('ISO-Zeitzone + DST fall-back (2026-10-25, Europe/Berlin): Wand-Uhr 3h = UTC 4h', () => {
    // Fall back: 2026-10-25, 03:00 CEST (UTC+2) → 02:00 CET (UTC+1) — 1 h „gewonnen"
    // (die Stunde 02:00–03:00 wird wiederholt).
    // Berlin 01:30+02:00 (CEST) = 23:30 UTC (24.10.); Berlin 04:30+01:00 (CET) = 03:30 UTC (25.10.)
    // → 4 h UTC-Millisekunden. Wand-Uhr-Differenz 3 h, aber UTC-Differenz 4 h.
    // TWO_PERIODS hier korrekt, da der 25.10.2026 in H2 liegt (Satz 0.0153) und 4h-Spanne
    // keine H1/H2-Grenze kreuzt.
    const start = new Date('2026-10-24T23:30:00Z'); // = 2026-10-25T01:30:00+02:00 CEST
    const end = new Date('2026-10-25T03:30:00Z'); // = 2026-10-25T04:30:00+01:00 CET
    const msSpan = end.getTime() - start.getTime();
    expect(msSpan).toBe(4 * 60 * 60 * 1000); // 14_400_000 ms = 4 h UTC, NICHT 3 h Wand-Uhr

    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: start,
      paymentOrEndDate: end,
      isB2B: false,
      baseRates: TWO_PERIODS,
    });
    // BGH-Inklusiv auf 14,4M ms: floor((14_400_000 + 86_400_000) / 86_400_000) = 1 Tag
    expect(result.totalDays).toBe(1);
    // Sanity: H2-Satz kommt im H2-2026-Monat korrekt zur Anwendung
    expect(result.lineItems[0]?.baseRate).toBe(0.0153);
  });

  it('DST-Defense: nicht-existente lokale Zeit wird vom Date-Konstruktor normalisiert', () => {
    // Während spring forward existiert die lokale Zeit 02:30+01:00 nicht.
    // V8 / Node normalisiert das, indem der Offset angepasst wird: 02:30+01:00 → 03:30+02:00,
    // was 01:30 UTC entspricht. Defense-in-Depth: dokumentiert und prüft diese Annahme,
    // damit künftige Refactorings (z. B. Wechsel auf Temporal-API) daraufhin überprüft
    // werden.
    const normalized = new Date('2026-03-29T02:30:00+01:00'); // invalide lokale Zeit
    // Erwartetes Resultat: 2026-03-29T01:30:00Z (Stunde „übersprungen")
    expect(normalized.toISOString()).toBe('2026-03-29T01:30:00.000Z');

    // Funktionsverhalten mit dieser normalisierten Eingabe: 30-min-Spanne = 1 Tag
    const result = calculateVerzugszins({
      principalAmount: 100,
      verzugStartDate: normalized,
      paymentOrEndDate: new Date('2026-03-29T02:00:00Z'),
      isB2B: false,
      baseRates: FIXED_RATE_H1_2026,
    });
    expect(result.totalDays).toBe(1);
  });
});
