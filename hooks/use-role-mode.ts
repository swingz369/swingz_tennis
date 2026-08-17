'use client';

import { useState, useCallback, useEffect } from 'react';
import { ROLE_MODE_COOKIE, ROLE_MODE_COOKIE_MAX_AGE } from '@/lib/cookies';

/**
 * Oberflächen-Modus für Admins („Verwalten" ↔ „Spielen").
 *
 * Ein Admin ist bereits Mitglied seines Vereins — die DB erlaubt nur EINE
 * Membership-Zeile pro (user, club), es gibt keine zweite „member"-Rolle. Der
 * Schalter legt deshalb nur die Mitglieder-Oberfläche frei, die dem Admin über
 * die Rollen-Hierarchie ohnehin zusteht. Kein Freischalten, kein fremder Admin.
 *
 * Bewusst ein reines UI-Präferenz-Flag und KEINE Sicherheitsgrenze: die
 * Server-Autorisierung läuft weiterhin über die echte `user_club_memberships`-
 * Zeile. Der Modus entscheidet nur, welche Oberfläche (Sidebar + Dashboard-Ziel)
 * gerendert wird — nicht, was erlaubt ist.
 *
 * Persistenz als Cookie (`ROLE_MODE_COOKIE`) statt localStorage: die serverseitigen
 * Guards (z. B. `app/(protected)/member/layout.tsx`) müssen den Modus sehen, um
 * Admins im Spieler-Modus nicht nach /admin zurückzuwerfen — und ein Cookie wird
 * mit jedem Request mitgesendet. Der Initialwert kommt als Prop aus dem Server-
 * Layout (dort aus dem Cookie gelesen), damit SSR und Hydration deckungsgleich
 * sind (kein Hydration-Mismatch durch einen localStorage-Read im Initializer).
 */

export type RoleMode = 'admin' | 'member';

/** Cookie-Wert, den der Server aus ROLE_MODE_COOKIE gelesen hat (oder null). */
export type RoleModeInitial = RoleMode | null | undefined;

export function useRoleMode(roles?: string[], initialMode?: RoleModeInitial) {
  const hasAdmin = roles?.includes('admin') ?? false;

  // Ein Admin ist bereits Mitglied seines Vereins: die DB erlaubt nur EINE
  // Membership-Zeile pro (user, club) — es gibt keine zweite „member“-Rolle zu
  // vergeben. Der Schalter legt nur die Mitglieder-Oberfläche frei, die dem
  // Admin über die Rollen-Hierarchie ohnehin zusteht. Kein fremder Admin nötig.
  const canSwitch = hasAdmin;

  // SSR-sicher: der Initialwert kommt vom Server (Cookie), nicht aus einem
  // localStorage-Read im Initializer — sonst rendert der Client beim Hydrieren
  // anders als der Server.
  const [mode, setMode] = useState<RoleMode>(initialMode === 'member' ? 'member' : 'admin');

  // Fällt die Admin-Rolle weg, zurück auf die Admin-Oberfläche — sonst stünde
  // der User im falschen Modus fest. Das Cookie wird serverseitig mitgelesen,
  // daher hier auch entfernen (der nächste Request sieht dann den Default).
  useEffect(() => {
    if (!canSwitch && mode !== 'admin') {
      setMode('admin');
      document.cookie = `${ROLE_MODE_COOKIE}=; path=/; max-age=0`;
    }
  }, [canSwitch, mode]);

  const switchToMember = useCallback(() => {
    if (!canSwitch) return;
    document.cookie = `${ROLE_MODE_COOKIE}=member; path=/; max-age=${ROLE_MODE_COOKIE_MAX_AGE}; samesite=lax`;
    setMode('member');
  }, [canSwitch]);

  const switchToAdmin = useCallback(() => {
    document.cookie = `${ROLE_MODE_COOKIE}=admin; path=/; max-age=${ROLE_MODE_COOKIE_MAX_AGE}; samesite=lax`;
    setMode('admin');
  }, []);

  return {
    canSwitch,
    isMemberMode: canSwitch && mode === 'member',
    mode,
    switchToMember,
    switchToAdmin,
  };
}
