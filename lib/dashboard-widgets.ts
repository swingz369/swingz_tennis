/**
 * Dashboard Widget Registry
 *
 * Defines all available widgets, their defaults, and layout configurations
 * for the customizable admin dashboard system.
 */

import type { LucideIcon } from 'lucide-react';
import { Building2, Users, UserCheck, Euro, LayoutGrid } from 'lucide-react';

// ─── Widget Definition Types ───

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

export interface WidgetDefinition {
  /** Unique widget type key */
  type: string;
  /** Display label (German) */
  label: string;
  /** Short description */
  description: string;
  /** Icon for the widget picker */
  icon: LucideIcon;
  /** Default grid size */
  defaultSize: WidgetSize;
  /** Which dashboard types this widget is available for */
  dashboardTypes: Array<'superadmin' | 'club'>;
  /** Category for grouping in the widget picker */
  category: 'stats' | 'lists' | 'actions' | 'insights';
}

export interface DashboardWidget {
  /** Unique instance ID (generated) */
  id: string;
  /** Widget type key (matches WidgetDefinition.type) */
  type: string;
  /** Whether this widget is visible */
  visible: boolean;
  /** Sort order (lower = earlier) */
  order: number;
  /** Grid column span */
  size: WidgetSize;
}

export type DashboardLayout = DashboardWidget[];

// ─── Widget Size → Grid Class Mapping ───

export const SIZE_GRID_CLASSES: Record<WidgetSize, string> = {
  sm: 'col-span-1',
  md: 'col-span-1 md:col-span-2',
  lg: 'col-span-1 md:col-span-2 lg:col-span-3',
  full: 'col-span-full',
};

// ─── Widget Registry ───

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  // ── Stats ──
  kpi_clubs: {
    type: 'kpi_clubs',
    label: 'Vereine',
    description: 'Anzahl aller Vereine als animierte KPI-Karte',
    icon: Building2,
    defaultSize: 'sm',
    dashboardTypes: ['superadmin'],
    category: 'stats',
  },
  kpi_members: {
    type: 'kpi_members',
    label: 'Mitglieder',
    description: 'Gesamtmitglieder als animierte KPI-Karte',
    icon: Users,
    defaultSize: 'sm',
    dashboardTypes: ['superadmin', 'club'],
    category: 'stats',
  },
  kpi_trainers: {
    type: 'kpi_trainers',
    label: 'Trainer',
    description: 'Traineranzahl als animierte KPI-Karte',
    icon: UserCheck,
    defaultSize: 'sm',
    dashboardTypes: ['superadmin', 'club'],
    category: 'stats',
  },
  kpi_revenue: {
    type: 'kpi_revenue',
    label: 'Umsatz',
    description: 'Gesamtumsatz als animierte KPI-Karte',
    icon: Euro,
    defaultSize: 'sm',
    dashboardTypes: ['superadmin'],
    category: 'stats',
  },
  kpi_courts: {
    type: 'kpi_courts',
    label: 'Plätze',
    description: 'Anzahl der Plätze als animierte KPI-Karte',
    icon: Building2,
    defaultSize: 'sm',
    dashboardTypes: ['club'],
    category: 'stats',
  },

  // ── Lists ──
  club_list: {
    type: 'club_list',
    label: 'Vereinsliste',
    description: 'Alle Vereine mit Kennzahlen und Quick-Actions',
    icon: Building2,
    defaultSize: 'full',
    dashboardTypes: ['superadmin'],
    category: 'lists',
  },
  management_menu: {
    type: 'management_menu',
    label: 'Verwaltung',
    description: 'Navigations-Kacheln zu Verwaltungsbereichen',
    icon: LayoutGrid,
    defaultSize: 'full',
    dashboardTypes: ['club'],
    category: 'lists',
  },
};

// ─── Default Layouts ───

function createWidget(type: string, order: number, size?: WidgetSize): DashboardWidget {
  const def = WIDGET_REGISTRY[type];
  return {
    id: `${type}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    visible: true,
    order,
    size: size ?? def?.defaultSize ?? 'sm',
  };
}

export function getDefaultLayout(dashboardType: 'superadmin' | 'club'): DashboardLayout {
  if (dashboardType === 'superadmin') {
    return [
      createWidget('kpi_clubs', 0),
      createWidget('kpi_members', 1),
      createWidget('kpi_trainers', 2),
      createWidget('kpi_revenue', 3),
      createWidget('club_list', 4),
    ];
  }
  return [
    createWidget('kpi_members', 0),
    createWidget('kpi_trainers', 1),
    createWidget('kpi_courts', 2),
    createWidget('management_menu', 3),
  ];
}

/**
 * Get available widgets that are NOT yet in the current layout.
 */
export function getAvailableWidgets(
  dashboardType: 'superadmin' | 'club',
  currentLayout: DashboardLayout
): WidgetDefinition[] {
  const usedTypes = new Set(currentLayout.map((w) => w.type));
  return Object.values(WIDGET_REGISTRY).filter(
    (def) => def.dashboardTypes.includes(dashboardType) && !usedTypes.has(def.type)
  );
}
