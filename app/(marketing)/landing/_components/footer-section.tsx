/**
 * Footer — App-Design
 *
 * 4-Spalten-Link-Grid (Brand / Produkt / Unternehmen / Rechtliches)
 * in normaler App-Typografie. Server Component.
 */

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { IconBox } from '@/components/ui/icon-box';

const LINK_GROUPS = [
  {
    heading: 'Produkt',
    links: [
      { href: '#section-features', label: 'Funktionen' },
      { href: '#section-pricing', label: 'Preise' },
      { href: '/trial-training', label: 'Probetraining' },
    ],
  },
  {
    heading: 'Unternehmen',
    links: [
      { href: '/about', label: 'Über uns' },
      { href: '/contact', label: 'Kontakt' },
      { href: '/impressum', label: 'Impressum' },
    ],
  },
  {
    heading: 'Rechtliches',
    links: [
      { href: '/datenschutz', label: 'Datenschutz' },
      { href: '/terms', label: 'AGB' },
      { href: '/avv', label: 'AVV' },
    ],
  },
];

export function FooterSection() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <IconBox icon={Trophy} size="sm" variant="gradient-primary" />
              <span className="font-display text-lg font-bold tracking-tight text-foreground">
                SWINGZ
              </span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Tennisclub-Management, das im Hintergrund arbeitet — damit das Vereinsleben im
              Vordergrund bleibt.
            </p>
          </div>
          {LINK_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="text-sm font-semibold text-foreground mb-4">{group.heading}</p>
              <ul className="space-y-2 text-sm">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-block py-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© 2026 SWINGZ GmbH · Alle Rechte vorbehalten</p>
          <p>München · DE · EU-Hosting · DSGVO-konform</p>
        </div>
      </div>
    </footer>
  );
}
