import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Sidebar Structure Tests — Source-Level Verification
 *
 * Die Navigations-Definitionen leben seit dem Layout-Refactoring in
 * lib/navigation.ts (nicht mehr in components/layout/sidebar.tsx).
 * Diese Tests prüfen die Rollen-Trennung auf Quellcode-Ebene;
 * das gerenderte Verhalten pro Rolle deckt role-access.spec.ts ab.
 */

test.describe('Sidebar Component - Role-based Navigation', () => {
  const navCode = readFileSync(join(process.cwd(), 'lib/navigation.ts'), 'utf-8');
  const sidebarCode = readFileSync(join(process.cwd(), 'components/layout/sidebar.tsx'), 'utf-8');

  test('superadmin role shows platform-wide navigation', async () => {
    expect(navCode).toContain('superadminSidebarSections');
    expect(navCode).toContain('Vereinsübersicht');
    expect(navCode).toContain('Admins verwalten');
    expect(navCode).toContain('/superadmin/tenants');
    expect(navCode).toContain('/superadmin/clubs');
    expect(navCode).toContain('/superadmin/dashboard');
    // Sektions-Labels
    expect(navCode).toContain("'Meine Vereine'");
    expect(navCode).toContain("'Verwaltung'");
  });

  test('admin role shows club-scoped navigation', async () => {
    expect(navCode).toContain('adminSidebarSections');
    expect(navCode).toContain('Saisonplanung');
    expect(navCode).toContain('Alle Mitglieder');
    expect(navCode).toContain('/admin/seasons');
    expect(navCode).toContain('/admin/members');
    // Sektions-Labels — die vier Kernmodule aus lib/features.ts, 1:1
    expect(navCode).toContain("'Mitglieder'");
    expect(navCode).toContain("'Trainer'");
    expect(navCode).toContain("'Saison & Plätze'");
    expect(navCode).toContain("'Finanzen'");
  });

  test('trainer role shows trainer-specific navigation', async () => {
    expect(navCode).toContain('trainerSidebarSections');
    expect(navCode).toContain('Verfügbarkeit');
    expect(navCode).toContain('Trainer-Profil');
    expect(navCode).toContain('/trainer/availability');
  });

  test('member role shows basic navigation', async () => {
    expect(navCode).toContain('memberSidebarSections');
    expect(navCode).toContain('Platz buchen');
    expect(navCode).toContain('/bookings');
    // Sektions-Labels
    expect(navCode).toContain("'Spielen'");
    expect(navCode).toContain("'Mein Verein'");
  });

  test('role separation: superadmin and admin have different navigation structures', async () => {
    // Die Sidebar wählt die Sections rollenbasiert aus getrennten Funktionen
    expect(sidebarCode).toContain('superadminSidebarSections');
    expect(sidebarCode).toContain('adminSidebarSections');
    expect(sidebarCode).toContain('memberSidebarSections');
    expect(sidebarCode).toContain('trainerSidebarSections');
  });

  test('no role overlap: admin sections do not reference superadmin routes', async () => {
    const start = navCode.indexOf('export function adminSidebarSections');
    const end = navCode.indexOf('export function memberSidebarSections');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const adminSection = navCode.substring(start, end);
    expect(adminSection).not.toContain('/superadmin');
    expect(adminSection).not.toContain('/owner');
  });
});
