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
  Blocks,
  Building2,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  GraduationCap,
  Home,
  Landmark,
  MapPin,
  MessageSquare,
  Newspaper,
  ScrollText,
  Search,
  Settings,
  Shield,
  Trophy,
  User,
  Users,
} from 'lucide-react';

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
 * Sektion → Kernmodul aus `lib/features.ts`. Die vier Core-Module haben je
 * genau eine Sektion; `features.ts` deklariert dieselben Keys als
 * `sidebarSection`. Wer hier eine Sektion umbenennt, zieht dort nach.
 */
const ADMIN_SECTION_FEATURE: Record<string, string> = {
  Mitglieder: 'members',
  Trainer: 'trainers',
  'Saison & Plätze': 'seasons',
  Finanzen: 'finance',
};

/**
 * Reihenfolge = Arbeitsablauf des Vereinsjahres, nicht Objekt-Taxonomie:
 * wer ist drin → wer unterrichtet → was läuft → wer zahlt. Sie entspricht
 * damit exakt der `order` der Core-Features in `lib/features.ts`.
 *
 * Optionale Module stehen gesammelt unten statt verstreut in den
 * Kernsektionen — sonst steht dieselbe Kernfunktion bei jedem Verein an
 * einer anderen Stelle, je nachdem was gebucht ist.
 */
export function adminSidebarSections(hidden: Hidden, belongsToTennisschule = false): NavSection[] {
  const sections: NavSection[] = [
    {
      label: 'Mitglieder',
      icon: Users,
      items: [
        { name: 'Alle Mitglieder', href: '/admin/members' },
        ...(!hidden.has('family_accounts')
          ? [{ name: 'Familienkonten', href: '/admin/members/family' }]
          : []),
        ...(!hidden.has('trial_training')
          ? [{ name: 'Probetrainings', href: '/admin/trial-training' }]
          : []),
        ...(!hidden.has('work_duty')
          ? [
              { name: 'Arbeitsdienste', href: '/admin/work-duties' },
              { name: 'Arbeitsdienst-Zuweisungen', href: '/admin/work-duties/assignments' },
            ]
          : []),
      ],
    },
    {
      label: 'Trainer',
      icon: GraduationCap,
      items: [
        { name: 'Trainer-Profile', href: '/admin/trainers' },
        { name: 'Stundennachweise', href: '/admin/hours-logs' },
      ],
    },
    {
      // Plätze stehen hier und nicht unter „Spielbetrieb": sie sind die
      // Ressource, die die Saisonplanung verplant — ohne angelegte Plätze
      // läuft der Wizard nicht. Der Admin sucht sie genau hier.
      label: 'Saison & Plätze',
      icon: CalendarDays,
      items: [
        { name: 'Saisonplanung', href: '/admin/seasons' },
        { name: 'Platzkalender', href: '/scheduler' },
        { name: 'Platzverwaltung', href: '/admin/courts' },
        { name: 'Sonderveranstaltungen', href: '/admin/special-events' },
      ],
    },
    {
      label: 'Finanzen',
      icon: DollarSign,
      items: [
        { name: 'Abrechnung', href: '/admin/billing' },
        ...(!hidden.has('dynamic_pricing')
          ? [{ name: 'Preisregeln', href: '/admin/pricing' }]
          : []),
        // Vereine, die zu einer Tennisschule gehören, verwalten ihr Abo auf
        // Ebene der Tennisschule (Superadmin) — nicht pro Einzelverein.
        ...(!belongsToTennisschule ? [{ name: 'Abonnement', href: '/admin/subscription' }] : []),
      ],
    },
    {
      label: 'Verein',
      icon: Landmark,
      items: [
        { name: 'Nachrichten', href: '/messages' },
        { name: 'Vereinseinstellungen', href: '/admin/settings' },
        { name: 'Auswertungen & Berichte', href: '/admin/analytics' },
        { name: 'Dokumente', href: '/admin/documents' },
      ],
    },
    {
      label: 'Weitere Module',
      icon: Blocks,
      items: [
        ...(!hidden.has('league_lineup')
          ? [{ name: 'Ligen & Teams', href: '/admin/leagues' }]
          : []),
        ...(!hidden.has('tournaments') ? [{ name: 'Turniere', href: '/admin/tournaments' }] : []),
        ...(!hidden.has('ai_matchmaking')
          ? [{ name: 'KI-Matchmaking', href: '/admin/ai/matchmaking' }]
          : []),
        ...(!hidden.has('shop') ? [{ name: 'Shop', href: '/admin/shop' }] : []),
        // Smart Court ist bewusst kein eigener Eintrag: die Seite ist ein Tab
        // von /admin/courts (dort selbst gegated). Ein zweiter Nav-Eintrag mit
        // ?tab=… zeigte auf dieselbe Route und brach das Active-Highlighting.
      ],
    },
  ];

  return sections.filter((section) => {
    const feature = ADMIN_SECTION_FEATURE[section.label];
    if (feature && hidden.has(feature)) return false;
    return section.items.length > 0;
  });
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
        // Nur ein Matchmaking-Eintrag: der zweite stand ungegated davor und
        // hebelte damit das `ai_matchmaking`-Flag aus.
        ...(!hidden.has('ai_matchmaking') ? [{ name: 'Matchmaking', href: '/matchmaking' }] : []),
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

export function paletteNavItems(hidden: Hidden = new Set()): NavItem[] {
  return [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Buchungen', href: '/bookings', icon: Calendar },
    { name: 'Nachrichten', href: '/messages', icon: MessageSquare },
    { name: 'Rechnungen', href: '/billing', icon: CreditCard },
    { name: 'Mein Trainingsplan', href: '/training-schedule', icon: ClipboardCheck },
    { name: 'Platzkalender', href: '/scheduler', icon: Calendar },
    { name: 'Benachrichtigungen', href: '/notifications', icon: Bell },
    { name: 'News', href: '/news', icon: Newspaper },
    { name: 'Erweiterte Suche', href: '/search', icon: Search },
    // Ohne dieses Gate bot die Palette Gamification auch Vereinen an, die das
    // Modul nicht gebucht haben — dort antwortet die Seite mit 403.
    ...(!hidden.has('gamification')
      ? [{ name: 'Erfolge & Ranglisten', href: '/gamification', icon: Trophy }]
      : []),
    { name: 'Profil', href: '/profile', icon: User },
  ];
}

export function paletteAdminNavItems(hidden: Hidden = new Set()): NavItem[] {
  return [
    { name: 'Admin Dashboard', href: '/admin', icon: Home },
    { name: 'Mitglieder', href: '/admin/members', icon: Users },
    { name: 'Trainer', href: '/admin/trainers', icon: GraduationCap },
    { name: 'Plätze', href: '/admin/courts', icon: MapPin },
    { name: 'Abrechnung', href: '/admin/billing', icon: FileText },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Einstellungen', href: '/admin/settings', icon: Settings },
    ...(!hidden.has('tournaments')
      ? [{ name: 'Turniere', href: '/admin/tournaments', icon: Trophy }]
      : []),
  ];
}
