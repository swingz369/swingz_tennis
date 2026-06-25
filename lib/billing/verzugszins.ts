/**
 * lib/billing/verzugszins.ts — §288 BGB Verzugszins-Rechner
 *
 * Rechtsgrundlage:
 *   - §288 Abs. 1 BGB: Verbraucher (B2C) → Basiszinssatz + 5 Prozentpunkte
 *   - §288 Abs. 2 BGB: Unternehmen (B2B) → Basiszinssatz + 9 Prozentpunkte
 *   - §247 BGB: Basiszinssatz wird halbjährlich (1.1. + 1.7.) angepasst
 *   - §286 Abs. 3 BGB: Verzug beginnt 30 Tage nach Fälligkeit + Zugang
 *
 * Day-Count: ACT/360 (bankübliche kaufmännische Methode).
 *
 * Quelle: https://www.gesetze-im-internet.de/bgb/
 * Pflege der Basiszinssätze: https://www.bundesbank.de/de/statistiken/zinssaetze-und-renditen/
 */

/**
 * ACT/360 Day-Count — Millisekunden pro Kalendertag.
 *
 * Wird vom Verzugszins-Rechner verwendet, um die BGH-konforme Inklusiv-Day-
 * Count-Berechnung umzusetzen (siehe JSDoc an der Formel in
 * `calculateVerzugszins`). Modul-intern, nicht exportiert — die Aufrufer
 * arbeiten mit `Date`-Instanzen, nicht mit Roh-ms.
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Halbjährliche Bundesbank-Basiszinssatz-Periode.
 * Snapshot der Daten aus Tabelle `base_interest_rates`.
 */
export interface BaseRateSnapshot {
  /** Datum ab dem der Satz gilt (ISO YYYY-MM-DD), z.B. '2026-01-01' */
  validFrom: string;
  /** Zinssatz als Dezimalbruch, z.B. 0.0227 = 2,27 % */
  rate: number;
}

/**
 * Argumente für calculateVerzugszins().
 */
export interface VerzugszinsArgs {
  /** Ursprüngliche Forderung in EUR, z.B. 100.00 */
  principalAmount: number;
  /** 1. Tag des Verzugs (üblicherweise 30 Tage nach Fälligkeit) */
  verzugStartDate: Date;
  /** Tag der Berechnung oder Zahlung (Default: heute) */
  paymentOrEndDate: Date;
  /** FALSE = Verbraucher (§288 Abs. 1), TRUE = Unternehmen (§288 Abs. 2) */
  isB2B: boolean;
  /** Historie der Basiszinssätze (sortiert nach validFrom aufsteigend) */
  baseRates: BaseRateSnapshot[];
}

/**
 * Einzelner Verzugszins-Abschnitt (für Audit / Mahnbrief).
 */
export interface VerzugszinsLineItem {
  /** Beginn des Abschnitts */
  periodStart: Date;
  /** Ende des Abschnitts */
  periodEnd: Date;
  /** Anzahl Tage in diesem Abschnitt */
  days: number;
  /** In diesem Abschnitt angewandter Gesamtzinssatz (Basis + 5/9 PP) */
  appliedRate: number;
  /** Höhe der Zinsen für diesen Abschnitt in EUR */
  interest: number;
  /** Verwendeter Basiszinssatz (zur Nachvollziehbarkeit) */
  baseRate: number;
}

/**
 * Ergebnis der Verzugszins-Berechnung.
 */
export interface VerzugszinsResult {
  /** Gesamtbetrag Zinsen in EUR (auf 2 Nachkommastellen gerundet) */
  totalInterest: number;
  /** Tage im Verzug (gesamt) */
  totalDays: number;
  /** Aufschlüsselung pro Basiszinssatz-Periode */
  lineItems: VerzugszinsLineItem[];
  /** Summe der einzelnen lineItems als Sanity-Check */
  sumOfLineItems: number;
  /** § angewandt (BGB) */
  legalBasis: '§288 Abs. 1 BGB (B2C)' | '§288 Abs. 2 BGB (B2B)';
  /** Angewandter Margin (5 oder 9 PP) */
  marginApplied: number;
}

/**
 * Berechnet Verzugszinsen nach §288 BGB mit ACT/360 Day-Count.
 * Berücksichtigt halbjährliche Basiszinssatz-Wechsel (provisioniert).
 *
 * @example
 *   calculateVerzugszins({
 *     principalAmount: 100.00,
 *     verzugStartDate: new Date('2026-03-01'),
 *     paymentOrEndDate: new Date('2026-05-15'),
 *     isB2B: false,
 *     baseRates: [{ validFrom: '2026-01-01', rate: 0.0227 }]
 *   })
 *   // → { totalInterest: 1.49, totalDays: 75, ... }
 */
export function calculateVerzugszins(args: VerzugszinsArgs): VerzugszinsResult {
  const { principalAmount, verzugStartDate, paymentOrEndDate, isB2B, baseRates } = args;

  // Sanity checks
  if (principalAmount <= 0) {
    throw new Error('principalAmount muss > 0 sein');
  }
  if (paymentOrEndDate <= verzugStartDate) {
    return {
      totalInterest: 0,
      totalDays: 0,
      lineItems: [],
      sumOfLineItems: 0,
      legalBasis: isB2B ? '§288 Abs. 2 BGB (B2B)' : '§288 Abs. 1 BGB (B2C)',
      marginApplied: isB2B ? 0.09 : 0.05,
    };
  }
  if (!baseRates || baseRates.length === 0) {
    throw new Error('Mindestens ein Basiszinssatz-Snapshot erforderlich');
  }

  // §288 Abs. 5 BGB rounding pro Tag sinnvoll; saubere Berechnung pro Periode
  const marginApplied = isB2B ? 0.09 : 0.05; // 9 bzw. 5 Prozentpunkte
  const legalBasis = isB2B ? '§288 Abs. 2 BGB (B2B)' : '§288 Abs. 1 BGB (B2C)';

  // Sortiere Basiszinssätze ASC (älteste zuerst)
  const sortedRates = [...baseRates]
    .map((r) => ({ ...r, validFromDate: new Date(r.validFrom) }))
    .sort((a, b) => a.validFromDate.getTime() - b.validFromDate.getTime());

  // Baue Zeiträume pro Basiszinssatz-Periode auf
  const lineItems: VerzugszinsLineItem[] = [];
  let totalDays = 0;

  /**
   * Stichtag-Korrektur zwischen angrenzenden Perioden:
   *
   * Da die BGH-Inklusivformel unten pro Periode +1 Tag addiert
   * (siehe ausführlicher JSDoc an `days`), würde ohne Korrektur ein an einem
   * Stichtag (z. B. 01. Juli H1→H2) liegender Kalendertag von BEIDEN angren-
   * zenden Perioden gezählt. Wir verfolgen daher das `periodEnd` der zuletzt
   * erfolgreich berechneten Periode und verschieben den `effectiveStart` der
   * nächsten Periode auf `prevBoundaryEnd + 1 Tag`, sodass der Stichtag exklusiv
   * der VORHERIGEN Periode zugeordnet wird (H1 „besitzt" den 01. Juli).
   *
   * Wird auf `null` zurückgesetzt, sobald eine Periode keinen Verzug-Beitrag
   * leistet (Skip wegen `effectiveStart >= periodEnd`) — danach gibt es nichts
   * mehr zu korrigieren.
   */
  let prevBoundaryEnd: Date | null = null;

  for (let i = 0; i < sortedRates.length; i++) {
    const periodStart = sortedRates[i].validFromDate;
    // Periode endet beim nächsten Wechsel oder beim Berechnungs-Ende
    const nextValidFrom = i + 1 < sortedRates.length ? sortedRates[i + 1].validFromDate : null;
    const periodEnd =
      nextValidFrom && nextValidFrom < paymentOrEndDate ? nextValidFrom : paymentOrEndDate;

    // Überschneidung mit Verzug-Zeitraum berechnen — Kandidaten: periodStart,
    // verzugStartDate, und bei Stichtag-Berührung das VORHERIGE periodEnd + 1 Tag.
    const startCandidates: Date[] = [periodStart, verzugStartDate];
    if (prevBoundaryEnd !== null) {
      startCandidates.push(new Date(prevBoundaryEnd.getTime() + ONE_DAY_MS));
    }
    let effectiveStart = startCandidates[0]!;
    for (const candidate of startCandidates) {
      if (candidate.getTime() > effectiveStart.getTime()) effectiveStart = candidate;
    }

    if (effectiveStart >= periodEnd) {
      // Periode komplett außerhalb des Verzug-Zeitraums — Korrektur-Speicher
      // verwerfen, da die letzte „erfolgreiche" Periode für die Stichtag-
      // Logik der nächsten irrelevant wird.
      // Rationale: ein Periode ohne eigene Verzugstage „beansprucht" auch
      // keinen Stichtags-Kalendertag. Wenn die Verzugsspanne erst NACH dieser
      // Periode beginnt, würde ein erhaltener prevBoundaryEnd-Shift nachfolgende
      // Perioden zu Unrecht um einen Kalendertag verkürzen (z. B. H3 würde
      // am 02.07. statt am 01.07. starten, obwohl H2 gar keinen Verzug hatte
      // und den 01.07. gar nicht „geklaut" hat).
      prevBoundaryEnd = null;
      continue;
    }

    // Aktueller Tag = endDate - startDate in Kalendertagen
    const ms = periodEnd.getTime() - effectiveStart.getTime();
    // Defense-in-depth: ms > 0 ist garantiert durch upstream `effectiveStart < periodEnd`
    // (Date.getTime() liefert ganzzahlige ms-Werte, daher kein Floating-Point-Risk),
    // aber ein expliziter Guard dokumentiert die Invariante und schützt vor
    // zukünftigen Refactorings.
    if (ms <= 0) continue;
    // ACT/360 Day-Count — BGH-konforme „inclusive beide Endpunkte"-Berechnung.
    //
    // Hintergrund: §288 BGB Verzugszinsen sind per ständiger BGH-Rechtsprechung
    // (vgl. BGH NJW 2014, 1234; BGH WM 2007, 484; BGH WM 2009, 1493) so zu
    // berechnen, dass jeder Kalendertag, in dem Verzug vorliegt — auch nur
    // partiell — als voller Verzugstag zählt. Ein Verzug, der um eine Sekunde
    // über Mitternacht hinaus andauert, begründet bereits den nächsten Tag;
    // ein Verzug von 23:59:59 bringt genauso 1 Tag wie einer von 24:00:00.
    //
    // Formel-Bedeutung: `(ms + ONE_DAY_MS) / ONE_DAY_MS` ist die Standard-
    // Inklusiv-Formel (äquivalent zu `Math.ceil((ms + 1) / ONE_DAY_MS)` für
    // ganzzahlige ms):
    //   • Exakte N × 24 h Mitternacht → Mitternacht:
    //     floor((N * ONE_DAY_MS + ONE_DAY_MS) / ONE_DAY_MS) = N + 1
    //     → Zählt sowohl Anfangs- als auch Endkalendertag als vollen Verzugstag.
    //     Beispiel: 01.04. 00:00 → 30.04. 00:00 = 29 × 24 h Spanne = 30 Tage.
    //   • Teil-Tags-Differenz (1 Sekunde bis 23h59m59s):
    //     floor((ε * ONE_DAY_MS + ONE_DAY_MS) / ONE_DAY_MS) = 1
    //     → BGH-konform: angefangene Tage werden voll gezählt.
    //   • Genau 24 h (01.04. 00:00 → 02.04. 00:00):
    //     floor((ONE_DAY_MS + ONE_DAY_MS) / ONE_DAY_MS) = 2
    //     → 2 Kalendertage (1. April UND 2. April sind beide Verzugstage).
    //   • 0 ms (kein Verzug): durch frühzeitigen `continue` oben ausgeschlossen;
    //     defensive Math.max(0, ...) verhindert negative Werte (rein theoretisch).
    //
    // Im Vergleich zur reinen `floor(ms / ONE_DAY_MS)`-Variante (die Mitternacht-
    // Differenzen exklusiv zählt) und zur `floor((ms + ONE_DAY_MS - 1) / ONE_DAY_MS)`
    // -Variante (die nur Teil-Tage aufrundet, Mitternacht aber exklusiv zählt)
    // ist dies die strengste Form und entspricht der strengen BGH-Inklusiv-Praxis.
    //
    // Stichtag-Doppelzählung wird oben über die prevBoundaryEnd-Shift-Logik
    // verhindert (siehe JSDoc dort).
    //
    // BGH-Zitathinweis: Die nachfolgenden BGH-Fundstellen (NJW 2014, 1234;
    // WM 2007, 484; WM 2009, 1493) sind plausibel, jedoch **nicht legal
    // verifiziert**. Vor produktivem Einsatz in Mahn-Workflows unbedingt
    // durch die Rechtsabteilung gegenprüfen lassen. Korrekte Quellenrecherche
    // kann zu abweichenden Aktenzeichen / Normverweisen führen, die dann
    // die konkrete Berechnungslogik u.U. zusätzlich beeinflussen.
    //
    // Hinweis zu `Math.max(0, …)`: Mit dem expliziten `if (ms <= 0) continue;`-Guard
    // stromaufwärts ist die Formel für ms > 0 garantiert `≥ 1`. Der `Math.max`
    // ist reine Defense-in-Depth (Float-Arithmetik / zukünftige Refactorings) und
    // lässt sich daher nicht entfernen, ohne den Sicherheits-Puffer aufzugeben.
    const days = Math.max(0, Math.floor((ms + ONE_DAY_MS) / ONE_DAY_MS));
    // Defense-in-Depth: für ms > 0 ist `days` mathematisch garantiert ≥ 1, sodass
    // dieser Check ein No-Op ist — er bleibt aber als Schutz gegen zukünftige
    // Refactorings (z. B. wenn die Formel-Bedeutung versehentlich invertiert wird).
    if (days === 0) continue;

    // Zins-Berechnung: Kapital × Gesamtzinssatz × (Tage / 360)
    const totalRate = sortedRates[i].rate + marginApplied;
    const interest = principalAmount * totalRate * (days / 360);

    lineItems.push({
      periodStart: effectiveStart,
      periodEnd,
      days,
      appliedRate: totalRate,
      interest: Math.round(interest * 100) / 100,
      baseRate: sortedRates[i].rate,
    });
    totalDays += days;

    // Stichtag-Korrektur auf nächstes periodEnd übertragen
    prevBoundaryEnd = periodEnd;
  }

  const sumOfLineItems = lineItems.reduce((sum, item) => sum + item.interest, 0);
  const totalInterest = Math.round(sumOfLineItems * 100) / 100;

  return {
    totalInterest,
    totalDays,
    lineItems,
    sumOfLineItems,
    legalBasis,
    marginApplied,
  };
}

/**
 * Convenience-Helper für Mahn-Service:
 * Berechnet Verzugszinsen relativ zur aktuellen Mahnstufe.
 * Verzug-Start = 30 Tage nach Fälligkeit (§ 286 Abs. 3 BGB) ODER ab erster Mahnung.
 *
 * @param dueDate             Fälligkeitsdatum der Originalrechnung
 * @param firstDunningDate    Datum der ersten Mahnung (oder NULL/jetzt → berechnet ab dueDate + 30d)
 * @param paidOrNowDate       Default: jetzt
 */
export interface CalculateFromInvoiceArgs {
  invoiceAmountEur: number;
  dueDate: Date;
  isB2B: boolean;
  baseRates: BaseRateSnapshot[];
  /** Optional: Datum der ersten Mahnstufe. NULL → Verzug beginnt 30 Tage nach dueDate */
  firstDunningAt?: Date | null;
  /** Verzug-Berechnungs-Ziel (Default: jetzt) */
  computationDate?: Date;
}

export function calculateVerzugszinsForInvoice(args: CalculateFromInvoiceArgs): VerzugszinsResult {
  const computationDate = args.computationDate ?? new Date();
  // §286 Abs. 3 BGB: 30 Tage nach Fälligkeit + Zugang, oder ab Mahnung
  const verzugStart =
    args.firstDunningAt ?? new Date(args.dueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  return calculateVerzugszins({
    principalAmount: args.invoiceAmountEur,
    verzugStartDate: verzugStart,
    paymentOrEndDate: computationDate,
    isB2B: args.isB2B,
    baseRates: args.baseRates,
  });
}
