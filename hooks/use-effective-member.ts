'use client';

import { useFamilyAccounts } from './use-family-accounts';

/**
 * Die Benutzer-ID, für die ein Elternteil gerade wirkt: die des aktiven Kindes,
 * wenn in der Seitenleiste auf ein Kind gewechselt wurde — sonst `null`
 * (bedeutet: das eigene Konto). Für Buchungen, Sessions und Rechnungen.
 */
export function useActingAsMemberId(): string | null {
  const family = useFamilyAccounts();
  return family.isParentViewingChild && family.activeChild ? family.activeChild.userId : null;
}
