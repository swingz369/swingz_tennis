/**
 * Billing Preview — pure Berechnungsfunktionen
 *
 * Extrahiert aus der historischen Route
 * `app/api/seasons/[id]/wizard/billing-preview/route.ts` (POST), die im Zuge der
 * Season-Planning-v2-Migration entfernt wurde. Die Semantik bleibt erhalten:
 *   - Für jeden Plan-Eintrag wird die ERSTE Fee-Configuration gematcht, deren
 *     Bedingungen zur Gruppe passen (first-match, Reihenfolge = Priorität).
 *     Configs ohne Bedingungen sind immer ein Fallback-Kandidat.
 *   - `conditions.trainingGroup` wird als String-Array geprüft (`includes`),
 *     konsistent mit `FeeConfigurationService.calculateFeeForMember`
 *     (src/application/services/fee-configuration.service.ts).
 *   - Rechnungssummen rechnen die Steuer auf Line-Item-Ebene
 *     (tax_rate × unit_price × qty), identisch zur Semantik in
 *     `SeasonBillingService.calculatePreview` (lib/billing/season-billing.service.ts).
 *   - `roundCurrency` ist eine bewusste Kopie des privaten
 *     `SeasonBillingService.roundCurrency` (dort nicht importierbar).
 *
 * Diese Datei ist das Produktionsgegenstück zu den Unit-Tests in
 * `src/__tests__/lib/billing-calculation.test.ts`.
 */

// ─── Eingabetypen (schlanke Schnittstellen, abgeleitet von der DB-Tabelle
//     `fee_configurations`; `billing_cycle` ist in der DB ein freier varchar,
//     daher bewusst `string` und nicht das engere Domain-Enum).
//     `installment_count` ist ein Legacy-Kontraktfeld aus der historischen
//     Route: die aktuelle DB hat keine solche Spalte, und das Domain-Enum
//     `billingCycle` kennt kein `'installment'` — der Raten-Zweig bleibt für
//     Kontrakt-Kompatibilität erhalten, liefert in Produktion aber stets 1. ────

export interface BillingPreviewEntry {
  member_id: string;
  group_id: string;
}

export interface BillingPreviewFeeConfig {
  id: string;
  amount: number;
  billing_cycle: string;
  installment_count?: number;
  conditions?: {
    trainingGroup?: string[];
  } | null;
}

export interface BillingPreviewItem {
  memberId: string;
  memberName: string;
  groupId: string;
  amount: number;
  feeConfigId: string | null;
  billingCycle: string;
  installments: number;
}

// ─── Invoice-Totals ──────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

/**
 * Rundet auf 2 Nachkommastellen (kaufmännisch), identisch zu
 * `SeasonBillingService.roundCurrency`.
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Matcht die erste Fee-Configuration, deren Bedingungen zur Gruppe passen.
 *
 * Regeln (identisch zur historischen Route):
 *  - Keine `conditions`  → immer passend (Fallback-Config).
 *  - `conditions.trainingGroup` gesetzt → nur wenn die Gruppe im Array ist.
 *  - Erster Treffer in der übergebenen Reihenfolge gewinnt (Priorität).
 */
export function matchFeeConfiguration(
  feeConfigs: BillingPreviewFeeConfig[],
  groupId: string
): BillingPreviewFeeConfig | null {
  return (
    feeConfigs.find((fee) => {
      if (!fee.conditions) return true;
      if (fee.conditions.trainingGroup && !fee.conditions.trainingGroup.includes(groupId)) {
        return false;
      }
      return true;
    }) ?? null
  );
}

/**
 * Ordnet jeden Plan-Eintrag der passenden Fee-Configuration zu.
 *
 * Liefert pro Eintrag einen Preview-Item; `memberName` bleibt leer (die Route
 * reichert keine Namen an — gleiches Verhalten wie die historische Route).
 * Defaults ohne passende Config: amount 0, billingCycle 'season', installments 1.
 */
export function computeBillingPreview(
  entries: BillingPreviewEntry[],
  feeConfigs: BillingPreviewFeeConfig[]
): BillingPreviewItem[] {
  return entries.map((entry) => {
    const fee = matchFeeConfiguration(feeConfigs, entry.group_id);
    const billingCycle = fee?.billing_cycle ?? 'season';

    return {
      memberId: entry.member_id,
      memberName: '',
      groupId: entry.group_id,
      amount: fee?.amount ?? 0,
      feeConfigId: fee?.id ?? null,
      billingCycle,
      installments: billingCycle === 'installment' ? (fee?.installment_count ?? 1) : 1,
    };
  });
}

/**
 * Berechnet Rechnungssummen aus Line-Items mit Steuer auf Zeilenebene.
 *
 *   lineTotal  = quantity × unit_price
 *   taxAmount  = Σ (lineTotal × tax_rate / 100)
 *   total      = subtotal + taxAmount
 *
 * Alle Werte werden auf 2 Nachkommastellen gerundet. Die Steuer-Semantik
 * entspricht `SeasonBillingService.calculatePreview` (tax_rate je Line-Item,
 * nicht auf der Gesamtsumme).
 */
export function computeInvoiceTotals(items: InvoiceLineItem[]): InvoiceTotals {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price * (item.tax_rate / 100),
    0
  );
  return {
    subtotal: roundCurrency(subtotal),
    taxAmount: roundCurrency(taxAmount),
    total: roundCurrency(subtotal + taxAmount),
  };
}
