'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Erkennt, ob ein Owner gerade einen fremden Verein als Admin verwaltet.
 *
 * „Als Admin" auf /owner/clubs setzt ein httpOnly-Cookie und leitet nach /admin
 * um. Der Client kann dieses Cookie nicht lesen — ohne eigenes Merken richtete
 * sich die Oberfläche weiter nach der Owner-Rolle, und der Owner stand im
 * Verein ohne Navigation und ohne Hinweis darauf, wo er eigentlich ist.
 *
 * Gemerkt wird in `sessionStorage`, damit der Kontext einen Reload übersteht
 * und beim Wechsel auf geteilte Seiten wie /scheduler oder /messages nicht
 * verloren geht. Verworfen wird er, sobald eine /owner-Route aufgerufen wird.
 */
const STORAGE_KEY = 'swingz:owner-club-context';

export function useOwnerClubContext(isOwner: boolean): boolean {
  const pathname = usePathname();
  const [inClubContext, setInClubContext] = useState(false);

  useEffect(() => {
    if (!isOwner || typeof window === 'undefined') {
      setInClubContext(false);
      return;
    }
    if (pathname.startsWith('/owner')) {
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
  }, [isOwner, pathname]);

  return inClubContext;
}
