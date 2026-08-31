'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { ClubAdminBanner } from '@/components/layout/club-admin-banner';
import { Skeleton } from '@/components/ui/skeleton';

const Sidebar = dynamic(() => import('@/components/layout/sidebar').then((m) => m.Sidebar), {
  loading: () => <Skeleton className="h-full w-64" />,
});
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { SkipToContent } from '@/lib/accessibility';
import { CommandPalette } from '@/components/command-palette';
import type { RoleModeInitial } from '@/hooks/use-role-mode';
import { SearchDialog } from '@/components/search-dialog';
import { CommandPaletteProvider } from '@/components/command-palette-context';
import { PageTransition } from '@/components/animations';
import { useGlobalKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { ErrorBoundary } from '@/components/error-boundary';
import { TenantProvider } from '@/lib/tenant-context';
import type { ClubBranding } from '@/lib/branding';

interface AppUser {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  memberId?: string | null;
  roles?: string[];
  club?: { id: string; name: string } | null;
  clubs?: { id: string; name: string }[];
  selectedClubId?: string | null;
}

interface ProtectedClientLayoutProps {
  children: React.ReactNode;
  user: AppUser;
  /** Resolved server-side in app/(protected)/layout.tsx — drives logo + favicon. */
  branding?: ClubBranding;
  /** Oberflächen-Modus (Verwalten/Spielen) aus ROLE_MODE_COOKIE — SSR-sicher vom Server. */
  initialRoleMode?: RoleModeInitial;
}

function SignOutLink() {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await createClient().auth.signOut();
        } catch {
          // Ohne gültige Session ist der Logout bereits erledigt.
        }
        // Server-Route statt router.push — siehe Begründung in header.tsx:
        // clientseitiges signOut() lässt die httpOnly-Cookies stehen.
        window.location.href = '/api/auth/logout';
      }}
      className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
    >
      Abmelden
    </button>
  );
}

/**
 * Einheitliches Layout für alle Rollen:
 *   Desktop (≥ md) → linke Sidebar, Inhalt daneben
 *   Mobil          → Bottom-Tab-Bar, Sidebar als Overlay über den Menü-Knopf
 * Die Sektionen pro Rolle kommen aus `lib/navigation.ts`.
 */
export function ProtectedClientLayout({
  children,
  user,
  branding,
  initialRoleMode,
}: ProtectedClientLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useGlobalKeyboardShortcuts();

  // Onboarding-Wizards laufen ohne Shell. Sidebar, Header und Command-Palette
  // eines Vereins, der gerade erst angelegt wird, führen überall ins Leere —
  // und der Wizard ist die einzige Stelle, an der es keine Alternative zum
  // Weiterklicken geben soll. TenantProvider bleibt, weil das Branding die
  // CSS-Variablen der Buttons liefert.
  if (pathname?.endsWith('/onboarding')) {
    return (
      <TenantProvider clubId={user.selectedClubId ?? user.club?.id ?? null} branding={branding}>
        <main id="main-content" role="main">
          <ErrorBoundary>{children}</ErrorBoundary>
          {/* Ohne Header gäbe es sonst keinen Weg mehr aus einem halb
              eingerichteten Konto heraus außer Cookies löschen. */}
          <div className="pb-8 text-center">
            <SignOutLink />
          </div>
        </main>
      </TenantProvider>
    );
  }

  // Ein Layout für alle Rollen: Sidebar ab `md`, Bottom-Tab-Bar darunter.
  // Vorher bekamen Trainer und Member gar keine Sidebar — ihre Sektionen in
  // lib/navigation.ts wurden nie gerendert, und alles was nicht in den 4–5
  // Bottom-Tabs oder den Dashboard-Kacheln stand, war für sie faktisch
  // unerreichbar (z. B. die eigene Anwesenheit oder der Trainingsplan).
  return (
    <TenantProvider clubId={user.selectedClubId ?? user.club?.id ?? null} branding={branding}>
      <CommandPaletteProvider>
        {/* Sidebar läuft über die volle Höhe, der Header sitzt nur über der
            Inhaltsspalte. Vorher spannte sich der Header über beides und
            schnitt die Sidebar oben ab — mit der dunklen Sidebar wäre daraus
            eine sichtbare Stufe geworden. */}
        <div className="flex min-h-screen">
          <SkipToContent />
          <Sidebar
            roles={user.roles ?? []}
            selectedClubId={user.selectedClubId ?? null}
            clubs={user.clubs ?? (user.club ? [user.club] : [])}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            initialRoleMode={initialRoleMode}
          />
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Menü schließen"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSidebarOpen(false);
              }}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Banner und Header hängen gemeinsam am oberen Rand.
                Vorher trug jeder für sich `sticky top-0 z-50`: zwei Elemente,
                die an dieselbe Kante wollen, stapeln nicht — das später im DOM
                stehende (der Header) legt sich beim Scrollen über das frühere.
                Der Kontext-Banner verschwand dadurch hinter dem Header, obwohl
                er technisch „klebte". Ein gemeinsamer Sticky-Block hält beide
                sichtbar, ohne dass irgendwo eine Bannerhöhe als Offset
                hartkodiert werden muss (er bricht auf Mobile um). */}
            <div className="sticky top-0 z-50">
              <ClubAdminBanner
                roles={user.roles ?? []}
                clubName={
                  (user.clubs ?? []).find((c) => c.id === user.selectedClubId)?.name ??
                  user.club?.name ??
                  null
                }
              />
              <Header user={user} onMenuClick={() => setSidebarOpen((prev) => !prev)} />
            </div>
            <main
              id="main-content"
              className="flex-1 bg-background p-4 md:p-6 lg:p-8 pb-20 md:pb-6"
              role="main"
            >
              {/* `max-w-7xl` (1280 px) stammt aus der Zeit vor der festen
                  Sidebar. Mit 256 px Navigation blieben auf einem 1920er
                  Schirm links und rechts je ~190 px ungenutzt, und die Seite
                  wirkte nach rechts abgeschnitten. 1600 px entspricht genau
                  der nutzbaren Breite bei 1920 (1920 − 256 Sidebar − 64
                  Innenabstand) und deckelt weiterhin auf Ultrawide, wo sonst
                  die Zeilenlänge der Tabellen unlesbar würde. */}
              <div className="mx-auto max-w-[1600px]">
                <ErrorBoundary>
                  <PageTransition>{children}</PageTransition>
                </ErrorBoundary>
              </div>
            </main>
          </div>
          {/* Nur mobil — auf Desktop übernimmt die Sidebar. */}
          <MobileBottomNav
            roles={user.roles ?? []}
            onMenuClick={() => setSidebarOpen((prev) => !prev)}
            className="md:hidden"
            initialRoleMode={initialRoleMode}
          />
          <CommandPalette
            roles={user.roles ?? []}
            selectedClubId={user.selectedClubId ?? null}
            clubs={user.clubs ?? (user.club ? [user.club] : [])}
            initialRoleMode={initialRoleMode}
          />
          <SearchDialog />
        </div>
      </CommandPaletteProvider>
    </TenantProvider>
  );
}
