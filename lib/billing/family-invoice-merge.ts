/**
 * Familien-Sammel-Rechnung (pure, testbar).
 *
 * Die Saison-Abrechnung erzeugt pro Mitglied eine Vorschau. Für Mitglieder einer
 * Familiengruppe wird daraus **eine** Rechnung an den Erwachsenen der Gruppe:
 * die Positionen der Kinder werden zusammengeführt und je Position mit dem
 * Namen des Familienmitglieds versehen, damit der Elternteil sie aufschlüsseln
 * kann.
 *
 * Bewusst keine DB-Abhängigkeit: die Funktion bekommt die bereits geladene
 * Familien-Rostergruppe übergeben und bleibt so deterministisch testbar.
 *
 * Regeln:
 * - Empfänger ist der primäre Erwachsene (`relationship = 'primary'`), sonst der
 *   erste Erwachsene der Gruppe.
 * - Gibt es keinen Erwachsenen in der Gruppe, wird **nicht** geraten — die
 *   Mitglieder werden einzeln abgerechnet.
 * - Ein abrechenbarer Minderjähriger ohne eigene Positionen des Erwachsenen
 *   erhält trotzdem eine Rechnung auf den Erwachsenen (der häufigste Fall:
 *   das Kind trainiert, der Elternteil zahlt).
 */

import { isMinor } from '@/lib/family/family-auth';
import type { MemberBillingPreview } from '@/lib/types/billing.types';

export interface FamilyMember {
  memberId: string;
  name: string;
  relationship: string | null;
  dateOfBirth: string | null;
}

export interface FamilyInvoiceMergeResult {
  /** Rechnungseinheiten nach der Zusammenfassung (1 Eintrag = 1 Rechnung). */
  previews: MemberBillingPreview[];
  /** Anzahl echter Mitglieder (vor der Zusammenfassung) — für Statistiken. */
  memberCount: number;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Erwachsener Empfänger der Sammel-Rechnung: primärer Erwachsener, sonst erster Erwachsener. */
function pickRecipient(roster: FamilyMember[]): FamilyMember | null {
  const adult = (m: FamilyMember) => !isMinor(m.dateOfBirth);
  return roster.find((m) => m.relationship === 'primary' && adult(m)) ?? roster.find(adult) ?? null;
}

function prefixItems(
  memberName: string,
  items: MemberBillingPreview['lineItems']
): MemberBillingPreview['lineItems'] {
  return items.map((item) => ({ ...item, description: `${memberName}: ${item.description}` }));
}

interface CollectiveTotals {
  trainingCost: number;
  membershipFee: number;
  additionalFees: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  lineItems: MemberBillingPreview['lineItems'];
}

/** Summiert mehrere Mitglieder-Vorschauen; jede Position wird dem Mitglied zugeordnet. */
function sumPreviews(previews: MemberBillingPreview[]): CollectiveTotals {
  let trainingCost = 0;
  let membershipFee = 0;
  let additionalFees = 0;
  const lineItems: MemberBillingPreview['lineItems'] = [];
  for (const preview of previews) {
    trainingCost += preview.trainingCost;
    membershipFee += preview.membershipFee;
    additionalFees += preview.additionalFees;
    lineItems.push(...prefixItems(preview.memberName, preview.lineItems));
  }
  const subtotalAmount = roundCurrency(lineItems.reduce((s, i) => s + i.totalPrice, 0));
  const taxAmount = roundCurrency(lineItems.reduce((s, i) => s + i.taxPrice, 0));
  return {
    trainingCost: roundCurrency(trainingCost),
    membershipFee,
    additionalFees,
    subtotalAmount,
    taxAmount,
    totalAmount: roundCurrency(subtotalAmount + taxAmount),
    lineItems,
  };
}

function buildCollective(
  recipient: FamilyMember,
  ownPreview: MemberBillingPreview | null,
  others: MemberBillingPreview[]
): MemberBillingPreview {
  const parts = ownPreview ? [ownPreview, ...others] : others;
  const totals = sumPreviews(parts);
  const names = ownPreview
    ? [ownPreview.memberName, ...others.map((o) => o.memberName)]
    : [recipient.name, ...others.map((o) => o.memberName)];
  return {
    memberId: recipient.memberId,
    memberName: recipient.name,
    groupName: ownPreview?.groupName ?? others[0]?.groupName ?? '',
    trainingCost: totals.trainingCost,
    membershipFee: totals.membershipFee,
    additionalFees: totals.additionalFees,
    subtotalAmount: totals.subtotalAmount,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    lineItems: totals.lineItems,
    collectiveMembers: names,
  };
}

export function mergeFamilyMemberPreviews(
  previews: MemberBillingPreview[],
  familyRosterByGroup: Map<string, FamilyMember[]>
): FamilyInvoiceMergeResult {
  const memberCount = previews.length;
  if (memberCount === 0 || familyRosterByGroup.size === 0) {
    return { previews, memberCount };
  }

  const previewByMember = new Map(previews.map((p) => [p.memberId, p]));
  const groupOfMember = new Map<string, string>();
  for (const [groupId, members] of familyRosterByGroup) {
    for (const member of members) groupOfMember.set(member.memberId, groupId);
  }

  const result: MemberBillingPreview[] = [];
  const processedGroups = new Set<string>();

  for (const preview of previews) {
    const groupId = groupOfMember.get(preview.memberId);
    if (!groupId) {
      // Kein Familienkonto → Einzelrechnung unverändert.
      result.push(preview);
      continue;
    }
    if (processedGroups.has(groupId)) continue;
    processedGroups.add(groupId);

    const roster = familyRosterByGroup.get(groupId) ?? [];
    const billable = roster
      .map((m) => previewByMember.get(m.memberId))
      .filter((p): p is MemberBillingPreview => Boolean(p));

    if (billable.length === 0) continue;

    const recipient = pickRecipient(roster);
    if (!recipient) {
      // Kein Erwachsener in der Gruppe — nicht raten, einzeln abrechnen.
      for (const p of billable) result.push(p);
      continue;
    }

    const ownPreview = previewByMember.get(recipient.memberId) ?? null;
    const others = billable.filter((p) => p.memberId !== recipient.memberId);

    if (ownPreview && others.length === 0) {
      // Nur der Erwachsene selbst ist abrechenbar → normale Einzelrechnung.
      result.push(ownPreview);
      continue;
    }

    result.push(buildCollective(recipient, ownPreview, others));
  }

  return { previews: result, memberCount };
}
