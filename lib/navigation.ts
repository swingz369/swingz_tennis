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

export function adminSidebarSections(hidden: Hidden): NavSection[] {
  const sections: NavSection[] = [
    {
      label: 'Mitglieder',
      icon: Users,
      items: [
        { name: 'Alle Mitglieder', href: '/admin/members' },
        { name: 'Familienkonten', href: '/admin/members/family' },
        ...(!hidden.has('trial_training')
          ? [{ name: 'Probetrainings', href: '/admin/trial-training' }]
          : []),
        ...(!hidden.has('work_duty')
          ? [
              { name: 'Arbeitsdienste', href: '/admin/work-duties' },
              { name: 'Arbeitsdienst-Zuweisungen', href: '/admin/work-duties/assignments' },
            ]
          : []),
        { name: 'Nachrichten', href: '/messages' },
        { name: 'E-Mail-Kampagnen', href: '/admin/email-campaigns' },
      ],
    },
    {
      label: 'Training',
      icon: GraduationCap,
      items: [
        { name: 'Saisonplanung', href: '/admin/seasons' },
        { name: 'Wochenstundenplan', href: '/scheduler' },
        { name: 'Trainer-Profile', href: '/admin/trainers' },
        { name: 'Stundennachweise', href: '/admin/hours-logs' },
        { name: 'Abwesenheiten', href: '/admin/absences' },
        { name: 'Sonderveranstaltungen', href: '/admin/special-events' },
      ],
    },
    {
      label: 'Spielbetrieb',
      icon: Trophy,
      items: [
        { name: 'Platzverwaltung', href: '/admin/courts' },
        { name: 'Platzarten', href: '/admin/court-types' },
        { name: 'Wartungsplan', href: '/admin/maintenance' },
        ...(!hidden.has('weather_integration')
          ? [{ name: 'Platzsperren & Wetter', href: '/admin/weather' }]
          : []),
        ...(!hidden.has('league_lineup')
          ? [{ name: 'Ligen & Teams', href: '/admin/leagues' }]
          : []),
        ...(!hidden.has('tournaments') ? [{ name: 'Turniere', href: '/admin/tournaments' }] : []),
        ...(!hidden.has('ai_matchmaking')
          ? [{ name: 'KI-Matchmaking', href: '/admin/ai/matchmaking' }]
          : []),
        ...(!hidden.has('smart_court')
          ? [{ name: 'Smart Court', href: '/admin/smart-court' }]
          : []),
      ],
    },
    {
      label: 'Finanzen',
      icon: DollarSign,
      items: [
        { name: 'Abrechnung', href: '/admin/billing' },
        { name: 'Preisregeln', href: '/admin/pricing' },
        { name: 'Abonnement', href: '/admin/subscription' },
        ...(!hidden.has('shop') ? [{ name: 'Shop', href: '/admin/shop' }] : []),
      ],
    },
    {
      label: 'Vereinsführung',
      icon: Landmark,
      items: [
        { name: 'Vereinseinstellungen', href: '/admin/settings' },
        { name: 'Auswertungen & Berichte', href: '/admin/analytics' },
        { name: 'Dokumente', href: '/admin/documents' },
        { name: 'Versammlungen', href: '/admin/meetings' },
        { name: 'Board-Beschlüsse', href: '/admin/decisions' },
      ],
    },
  ];

  return sections.filter((section) => {
    if (section.label === 'Mitglieder') return !hidden.has('members');
    if (section.label === 'Training') return !hidden.has('trainers') || !hidden.has('seasons');
    if (section.label === 'Finanzen') return !hidden.has('finance');
    return true;
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
        { name: 'Matchmaking', href: '/matchmaking' },
        ...(!hidden.has('tournaments') ? [{ name: 'Turniere', href: '/member/tournaments' }] : []),
        { name: 'Erfolge & Ranglisten', href: '/gamification' },
      ],
    },
    {
      label: 'Training',
      icon: GraduationCap,
      items: [
        { name: 'Stundenplan', href: '/scheduler' },
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
        ...(includeMemberOnly ? [{ name: 'Arbeitsdienste', href: '/member/work-duties' }] : []),
        ...(!hidden.has('trial_training')
          ? [{ name: 'Freunde zum Probetraining einladen', href: '/member/trial-training' }]
          : []),
        ...(!hidden.has('shop')
          ? [
              { name: 'Shop', href: '/shop' },
              { name: 'Meine Bestellungen', href: '/meine-bestellungen' },
            ]
          : []),
        { name: 'Board-Beschlüsse', href: '/decisions' },
      ],
    },
  ];
}

// ── Sidebar: Trainer / Superadmin / Owner ────────────────────────────

export function trainerSidebarSections(): NavSection[] {
  return [
    {
      label: 'Training',
      icon: GraduationCap,
      items: [
        { name: 'Verfügbarkeit', href: '/trainer/availability' },
        { name: 'Trainingspräferenzen', href: '/trainer/planning-preferences' },
        { name: 'Stundennachweise', href: '/trainer/hours-logs' },
        { name: 'Abwesenheiten', href: '/trainer/absences' },
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
        { name: 'Vereinsübersicht', href: '/superadmin/clubs' },
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
  return [
    {
      label: 'Plattform',
      icon: Shield,
      items: [
        { name: 'Alle Vereine', href: '/owner/clubs' },
        { name: 'Superadmins', href: '/owner/superadmins' },
        { name: 'Admins', href: '/owner/admins' },
        { name: 'Zugänge & Anfragen', href: '/owner/access' },
      ],
    },
    {
      label: 'System',
      icon: Settings,
      items: [
        { name: 'Umsatz & Abos', href: '/owner/billing' },
        { name: 'System-Einstellungen', href: '/owner/settings' },
      ],
    },
  ];
}

// ── Mobile-Bottom-Nav (kuratiertes Subset, max. 5 Tabs) ─────────────

export function mobileNavItems(
  role: 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member'
): NavItem[] {
  switch (role) {
    case 'owner':
      return [
        { name: 'Dashboard', href: '/owner', icon: Home },
        { name: 'Vereine', href: '/owner/clubs', icon: Building2 },
        { name: 'Anfragen', href: '/owner/access', icon: ClipboardList },
        { name: 'Billing', href: '/owner/billing', icon: CreditCard },
      ];
    case 'superadmin':
      return [
        { name: 'Dashboard', href: '/superadmin', icon: Home },
        { name: 'Vereine', href: '/superadmin/tenants', icon: Building2 },
        { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
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
        { name: 'Einheiten', href: '/scheduler', icon: Calendar },
        { name: 'Verfügbarkeit', href: '/trainer/availability', icon: Clock },
        { name: 'Saisonplanung', href: '/trainer/planning-preferences', icon: ClipboardList },
      ];
    default:
      return [
        { name: 'Home', href: '/member', icon: Home },
        { name: 'Stundenplan', href: '/scheduler', icon: Calendar },
        { name: 'Buchen', href: '/bookings', icon: ClipboardList },
        { name: 'Rechnungen', href: '/billing', icon: CreditCard },
      ];
  }
}

// ── Command-Palette (Cmd+K) ──────────────────────────────────────────

export function paletteNavItems(): NavItem[] {
  return [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Buchungen', href: '/bookings', icon: Calendar },
    { name: 'Nachrichten', href: '/messages', icon: MessageSquare },
    { name: 'Rechnungen', href: '/billing', icon: CreditCard },
    { name: 'Trainingsplan', href: '/training-schedule', icon: ClipboardCheck },
    { name: 'Benachrichtigungen', href: '/notifications', icon: Bell },
    { name: 'News', href: '/news', icon: Newspaper },
    { name: 'Erweiterte Suche', href: '/search', icon: Search },
    { name: 'Erfolge & Ranglisten', href: '/gamification', icon: Trophy },
    { name: 'Profil', href: '/profile', icon: User },
  ];
}

export function paletteAdminNavItems(): NavItem[] {
  return [
    { name: 'Admin Dashboard', href: '/admin', icon: Home },
    { name: 'Mitglieder', href: '/admin/members', icon: Users },
    { name: 'Trainer', href: '/admin/trainers', icon: GraduationCap },
    { name: 'Plätze', href: '/bookings?tab=manage', icon: MapPin },
    { name: 'Abrechnung', href: '/admin/billing', icon: FileText },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Einstellungen', href: '/admin/settings', icon: Settings },
    { name: 'Turniere', href: '/admin/tournaments', icon: Trophy },
  ];
}
