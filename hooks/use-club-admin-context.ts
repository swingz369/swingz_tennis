'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Erkennt, ob ein Owner oder Superadmin gerade einen Verein als Admin verwaltet.
 *
 * „Als Admin" auf /owner/clubs bzw. „Verein verwalten" auf /superadmin/tenants
 * setzt ein Club-Cookie und leitet nach /admin um. Der Client kann dieses Cookie
 * nicht lesen — ohne eigenes Merken richtete sich die Oberfläche weiter nach der
 * Plattform-Rolle, und man stand im Verein mit der falschen Navigation und ohne
 * Hinweis darauf, wo man eigentlich ist.
 *
 * Gemerkt wird in `sessionStorage`, damit der Kontext einen Reload übersteht
 * und beim Wechsel auf geteilte Seiten wie /scheduler oder /messages nicht
 * verloren geht. Verworfen wird er, sobald eine /owner- oder /superadmin-Route
 * aufgerufen wird.
 */
const STORAGE_KEY = 'swingz:club-admin-context';

export function useClubAdminContext(enabled: boolean): boolean {
  const pathname = usePathname();
  const [inClubContext, setInClubContext] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setInClubContext(false);
      return;
    }
    if (pathname.startsWith('/owner') || pathname.startsWith('/superadmin')) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      setInClubContext(false);
      return;
    }
    if (pathname.startsWith('/admin')) {
      window.sessionStorage.setItem(STORAGE_KEY, '1');
      setInClubContext(true);
      return;
    }
    setInClubContext(window.sessionStorage.getItem(STORAGE_KEY) === '1');
  }, [enabled, pathname]);

  return inClubContext;
}
