/**
 * Zentrale Navigations-Konfiguration — einzige Quelle für Desktop-Sidebar,
 * Mobile-Bottom-Nav und Command-Palette (Cmd+K).
 *
 * Neue Seite? Hier eintragen — alle drei Oberflächen ziehen nach.
 * Feature-Flags: Einträge mit Flag-Bedingung verschwinden, wenn das Flag
 * für den aktiven Verein deaktiviert ist (`hidden` = Set der Flag-Keys).
 */
import type { ComponentType } from 'react';
import {
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  GraduationCap,
  Home,
  Landmark,
  ScrollText,
  Search,
  Settings,
  Shield,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { CLUB_FEATURES, type AdminSectionKey, type FeatureKey } from '@/lib/features';

export type NavIcon = ComponentType<{
  className?: string | undefined;
  'aria-hidden'?: boolean | 'true' | 'false' | undefined;
}>;

export interface NavItem {
  name: string;
  href: string;
  icon?: NavIcon;
  badge?: number;
}

export interface NavSection {
  label: string;
  icon: NavIcon;
  items: NavItem[];
}

type Hidden = Set<string>;

// ── Sidebar: Admin ───────────────────────────────────────────────────

/**
 * Sektion → Kernmodul. Die vier Core-Module tragen je genau eine Sektion;
 * `feature` blendet die ganze Sektion aus, falls das Core-Modul deaktiviert
 * ist. Die Link-Platzierung der OPTIONALEN Module kommt aus `lib/features.ts`
 * (`nav`-Feld) — einzige Quelle, kein verstreutes `hidden.has()` mehr.
 *
 * Reihenfolge = Arbeitsablauf des Vereinsjahres, nicht Objekt-Taxonomie:
 * wer ist drin → wer unterrichtet → was läuft → wer zahlt → Verein.
 */
export function adminSidebarSections(hidden: Hidden, belongsToTennisschule = false): NavSection[] {
  type Def = {
    key: AdminSectionKey;
    label: string;
    icon: NavIcon;
    feature?: FeatureKey;
    items: NavItem[];
  };

  const defs: Def[] = [
    {
      key: 'members',
      label: 'Mitglieder',
      icon: Users,
      feature: 'members',
      items: [{ name: 'Alle Mitglieder', href: '/admin/members' }],
    },
    {
      key: 'trainers',
      label: 'Trainer',
      icon: GraduationCap,
      feature: 'trainers',
      items: [
        { name: 'Trainer-Profile', href: '/admin/trainers' },
        { name: 'Stundennachweise', href: '/admin/hours-logs' },
      ],
    },
    {
      // Plätze stehen hier: sie sind die Ressource, die die Saisonplanung
      // verplant — ohne angelegte Plätze läuft der Wizard nicht. Der Admin
      // sucht sie genau hier, neben Saisonplanung und Ligen. Kalender und
      // Verwaltung sind eine Seite mit Tabs (Plätze-Hub).
      key: 'play',
      label: 'Spielbetrieb',
      icon: CalendarDays,
      feature: 'seasons',
      items: [
        { name: 'Saisonplanung', href: '/admin/seasons' },
        { name: 'Plätze', href: '/admin/courts' },
        // Turniere + Sonderveranstaltungen sind Tabs derselben Seite
        // (Veranstaltungen-Hub) statt zweier Einträge.
        { name: 'Veranstaltungen', href: '/admin/events' },
      ],
    },
    {
      key: 'finance',
      label: 'Finanzen',
      icon: DollarSign,
      feature: 'finance',
      items: [
        { name: 'Abrechnung', href: '/admin/billing' },
        // Preisregeln sind ein fester Bestandteil der Finanzen (früher hinter
        // dem `dynamic_pricing`-Flag) — Admins sehen und verwalten sie immer.
        { name: 'Preisregeln', href: '/admin/pricing' },
        // Vereine, die zu einer Tennisschule gehören, verwalten ihr Abo auf
        // Ebene der Tennisschule (Superadmin) — nicht pro Einzelverein.
        ...(!belongsToTennisschule ? [{ name: 'Abonnement', href: '/admin/subscription' }] : []),
      ],
    },
    {
      key: 'club',
      label: 'Verein',
      icon: Landmark,
      items: [
        { name: 'Nachrichten', href: '/messages' },
        { name: 'Vereinseinstellungen', href: '/admin/settings' },
        { name: 'Auswertungen', href: '/admin/analytics' },
        { name: 'Dokumente', href: '/admin/documents' },
      ],
    },
  ];

  // Optionale Module hängen ihren Link an der deklarierten Sektion ein —
  // Reihenfolge aus CLUB_FEATURES (Nutzen für den Verein).
  const moduleItems = new Map<AdminSectionKey, NavItem[]>();
  for (const feature of CLUB_FEATURES) {
    if (feature.category !== 'optional' || !feature.nav || hidden.has(feature.key)) continue;
    const list = moduleItems.get(feature.nav.section) ?? [];
    list.push({ name: feature.nav.label, href: feature.nav.href });
    moduleItems.set(feature.nav.section, list);
  }

  return defs
    .filter((def) => !(def.feature && hidden.has(def.feature)))
    .map((def) => ({
      label: def.label,
      icon: def.icon,
      items: [...def.items, ...(moduleItems.get(def.key) ?? [])],
    }))
    .filter((section) => section.items.length > 0);
}

// ── Sidebar: Mitglied (auch Trainer sieht diese Sektionen) ──────────

/**
 * `includeMemberOnly`: Trainingspräferenzen & Arbeitsdienste nur für
 * User mit Member-Rolle (reine Trainer sehen sie nicht).
 */
export function memberSidebarSections(hidden: Hidden, includeMemberOnly: boolean): NavSection[] {
  return [
    {
      label: 'Spielen',
      icon: Trophy,
      items: [
        { name: 'Platz buchen', href: '/bookings' },
        { name: 'Offene Spiele', href: '/matches' },
        // Nur ein Eintrag zur Spielpartner-Suche: der zweite stand ungegated davor und
        // hebelte damit das `partner_finder`-Flag aus.
        ...(!hidden.has('partner_finder')
          ? [{ name: 'Spielpartner-Suche', href: '/partner-finder' }]
          : []),
        // Medenspiele: der Eintrag steht hier unabhängig davon, ob das Mitglied
        // schon in einer Meldeliste steht. Die Dashboard-Kachel erscheint erst
        // mit dem ersten Kadereintrag — ohne diesen Nav-Eintrag war
        // /member/leagues bis dahin über die Oberfläche nicht erreichbar.
        ...(!hidden.has('league_lineup')
          ? [{ name: 'Meine Mannschaften', href: '/member/leagues' }]
          : []),
        ...(!hidden.has('tournaments') ? [{ name: 'Turniere', href: '/member/tournaments' }] : []),
        ...(!hidden.has('gamification')
          ? [{ name: 'Erfolge & Ranglisten', href: '/gamification' }]
          : []),
      ],
    },
    {
      label: 'Training',
      icon: GraduationCap,
      items: [
        // Der eigene Trainingsplan war bisher nur über Cmd+K erreichbar —
        // und ist die einzige Oberfläche, auf der man sich von einer Einheit
        // abmelden kann. Steht deshalb vor dem allgemeinen Platzkalender.
        { name: 'Mein Trainingsplan', href: '/training-schedule' },
        { name: 'Platzkalender', href: '/scheduler' },
        // Zeigt die eigene Anwesenheit des Mitglieds. War von keiner
        // Mitglieder-Oberfläche aus erreichbar — nur das Trainer-Dashboard
        // verlinkte sie, wo sie systematisch leer blieb.
        { name: 'Meine Anwesenheit', href: '/attendance-history' },
        { name: 'Trainerstunde buchen', href: '/member/trainer-booking' },
        ...(includeMemberOnly
          ? [{ name: 'Trainingspräferenzen', href: '/member/preferences' }]
          : []),
      ],
    },
    {
      label: 'Mein Verein',
      icon: Landmark,
      items: [
        { name: 'Nachrichten', href: '/messages' },
        { name: 'Meine Rechnungen', href: '/billing' },
        { name: 'Vereinsdokumente', href: '/documents' },
        ...(includeMemberOnly && !hidden.has('work_duty')
          ? [{ name: 'Arbeitsdienste', href: '/member/work-duties' }]
          : []),
        ...(!hidden.has('trial_training')
          ? [{ name: 'Freunde zum Probetraining einladen', href: '/member/trial-training' }]
          : []),
        ...(!hidden.has('shop')
          ? [
              { name: 'Shop', href: '/shop' },
              { name: 'Meine Bestellungen', href: '/meine-bestellungen' },
            ]
          : []),
        ...(!hidden.has('decisions') ? [{ name: 'Board-Beschlüsse', href: '/decisions' }] : []),
      ],
    },
  ];
}

// ── Sidebar: Trainer / Superadmin / Owner ────────────────────────────

/**
 * Zwei Sektionen statt einer: „Was muss ich melden?" und „Was bekomme ich
 * dafür?" sind für einen Trainer zwei verschiedene Fragen. Vorher lagen
 * Verfügbarkeit, Stunden und Honorar in einem Topf.
 */
export function trainerSidebarSections(): NavSection[] {
  return [
    {
      label: 'Mein Training',
      icon: GraduationCap,
      items: [
        // Stand vorher hartcodiert in sidebar.tsx und hieß in der Mobile-Nav
        // „Einheiten" — jetzt eine Definition, ein Name.
        { name: 'Platzkalender', href: '/scheduler' },
        { name: 'Verfügbarkeit', href: '/trainer/availability' },
        // Vorher „Trainingspräferenzen" — kollidierte mit der gleichnamigen
        // Mitglieder-Seite (/member/preferences), die etwas anderes tut.
        { name: 'Meine Planungswünsche', href: '/trainer/planning-preferences' },
        { name: 'Abwesenheiten', href: '/trainer/absences' },
      ],
    },
    {
      label: 'Meine Leistung',
      icon: BarChart3,
      items: [
        { name: 'Stundennachweise', href: '/trainer/hours-logs' },
        { name: 'Meine Abrechnung', href: '/trainer/billing' },
        { name: 'Trainer-Profil', href: '/trainer/profile' },
      ],
    },
  ];
}

export function superadminSidebarSections(): NavSection[] {
  return [
    {
      label: 'Meine Vereine',
      icon: Building2,
      items: [
        // /superadmin/tenants (KPI-Übersicht) war nur über die Mobile-Nav
        // erreichbar, /superadmin/clubs (anlegen/bearbeiten) nur über die
        // Sidebar. Beide Seiten existieren — jetzt beide verlinkt.
        { name: 'Vereinsübersicht', href: '/superadmin/tenants' },
        { name: 'Vereine verwalten', href: '/superadmin/clubs' },
        { name: 'Admins verwalten', href: '/superadmin/admins' },
      ],
    },
    {
      label: 'Verwaltung',
      icon: Settings,
      items: [
        { name: 'Statistiken', href: '/superadmin/dashboard' },
        { name: 'Einstellungen', href: '/superadmin/settings' },
        { name: 'Abonnement', href: '/superadmin/subscription' },
      ],
    },
  ];
}

export function ownerSidebarSections(): NavSection[] {
  // Phase 3 Master-UX: Reihenfolge nach operativer Wichtigkeit, nicht nach
  // Funktionsgruppe. Audit-Log als Sicherheitsnetz steht direkt nach Vereine,
  // weil es die häufigste Use-Case-Anlaufstelle ist (Plattformbetreiber will
  // schnell prüfen können: was ist passiert?).
  return [
    {
      label: 'Plattform-Konsole',
      icon: Shield,
      items: [
        { name: 'Vereine', href: '/owner/clubs' },
        { name: 'Audit-Log', href: '/owner/audit', icon: ScrollText },
        { name: 'Admins', href: '/owner/admins' },
        { name: 'Superadmins', href: '/owner/superadmins' },
        { name: 'Zugänge & Anfragen', href: '/owner/access' },
      ],
    },
    {
      label: 'Monetarisierung',
      icon: Settings,
      items: [
        { name: 'Umsatz & Abos', href: '/owner/billing' },
        // Coming-Soon: Systemweite Konfiguration. Seite fehlt aktuell noch.
        { name: 'System-Einstellungen', href: '/owner/settings' },
      ],
    },
  ];
}

// ── Mobile-Bottom-Nav (kuratiertes Subset, max. 5 Tabs) ─────────────

/**
 * Bewusst eine kuratierte Liste und keine Ableitung aus den Sektionen —
 * ein Bottom-Tab-Bar braucht andere Prioritäten als eine Sidebar.
 * Damit sie nicht wieder auseinanderläuft (vorher: „Einheiten" vs.
 * „Stundenplan" für dieselbe Seite, /superadmin/tenants nur hier),
 * prüft `src/__tests__/lib/navigation.test.ts`, dass jedes Ziel auch in
 * den Sidebar-Sektionen derselben Rolle vorkommt.
 */
export function mobileNavItems(
  role: 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member'
): NavItem[] {
  switch (role) {
    case 'owner':
      return [
        { name: 'Dashboard', href: '/owner', icon: Home },
        { name: 'Vereine', href: '/owner/clubs', icon: Building2 },
        { name: 'Audit', href: '/owner/audit', icon: ScrollText },
        { name: 'Admins', href: '/owner/admins', icon: Users },
        { name: 'Umsatz', href: '/owner/billing', icon: CreditCard },
      ];
    case 'superadmin':
      return [
        { name: 'Dashboard', href: '/superadmin', icon: Home },
        { name: 'Vereine', href: '/superadmin/tenants', icon: Building2 },
        // Vorher /admin/analytics — eine Admin-Route in der Superadmin-Nav.
        { name: 'Statistiken', href: '/superadmin/dashboard', icon: BarChart3 },
        { name: 'Profil', href: '/profile', icon: User },
      ];
    case 'admin':
      return [
        { name: 'Dashboard', href: '/admin', icon: Home },
        { name: 'Mitglieder', href: '/admin/members', icon: Users },
        { name: 'Saison', href: '/admin/seasons', icon: Calendar },
        { name: 'Finanzen', href: '/admin/billing', icon: CreditCard },
        { name: 'Profil', href: '/profile', icon: User },
      ];
    case 'trainer':
      return [
        { name: 'Übersicht', href: '/trainer', icon: Home },
        { name: 'Kalender', href: '/scheduler', icon: Calendar },
        { name: 'Verfügbarkeit', href: '/trainer/availability', icon: Clock },
        { name: 'Stunden', href: '/trainer/hours-logs', icon: ClipboardList },
        { name: 'Honorar', href: '/trainer/billing', icon: CreditCard },
      ];
    default:
      return [
        { name: 'Start', href: '/member', icon: Home },
        { name: 'Training', href: '/training-schedule', icon: ClipboardCheck },
        { name: 'Buchen', href: '/bookings', icon: ClipboardList },
        { name: 'Rechnungen', href: '/billing', icon: CreditCard },
      ];
  }
}

// ── Command-Palette (Cmd+K) ──────────────────────────────────────────

/**
 * Flacht Sidebar-Sektionen zu einer Liste ab. Items ohne eigenes Icon erben
 * das ihrer Sektion — so bleibt die Palette optisch an die Sidebar-
 * Gruppierung gebunden, ohne dass jeder Eintrag ein Icon pflegt.
 */
function flattenSections(sections: NavSection[]): NavItem[] {
  return sections.flatMap((section) =>
    section.items.map((item) => ({
      name: item.name,
      href: item.href,
      icon: item.icon ?? section.icon,
      badge: item.badge,
    }))
  );
}

/**
 * Palette für Mitglied & Trainer. Leitet sich aus `memberSidebarSections`
 * ab — dieselbe Quelle wie die Sidebar, Namen und Ziele können nicht mehr
 * auseinanderlaufen. Ergänzt um Palette-only-Einträge (Dashboard-Dispatch,
 * Benachrichtigungen, erweiterte Suche, Profil), die in der Sidebar bewusst
 * fehlen.
 */
export function paletteNavItems(hidden: Hidden = new Set(), includeMemberOnly = true): NavItem[] {
  return [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    ...flattenSections(memberSidebarSections(hidden, includeMemberOnly)),
    { name: 'Benachrichtigungen', href: '/notifications', icon: Bell },
    // /news leitet nur auf /messages weiter (News & Nachrichten wurden
    // zusammengeführt) — kein eigener Palette-Eintrag mehr nötig.
    { name: 'Erweiterte Suche', href: '/search', icon: Search },
    { name: 'Profil', href: '/profile', icon: User },
  ];
}

/**
 * Palette für Admin/Superadmin. Leitet sich aus `adminSidebarSections` ab —
 * gleiche Namen, gleiche Ziele, gleiche Feature-Gates wie die Sidebar.
 * „Dashboard" steht vorne, weil es in der Sidebar ein eigener Link oberhalb
 * der Sektionen ist und dort keine eigene Sektion hat.
 */
export function paletteAdminNavItems(
  hidden: Hidden = new Set(),
  belongsToTennisschule = false
): NavItem[] {
  return [
    { name: 'Dashboard', href: '/admin', icon: Home },
    ...flattenSections(adminSidebarSections(hidden, belongsToTennisschule)),
  ];
}
