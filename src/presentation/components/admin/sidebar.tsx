// src/presentation/components/admin/sidebar.tsx
'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
  { href: '/admin/clubs', label: 'Vereine', icon: '🏆' },
  { href: '/bookings', label: 'Buchungen', icon: '📝' },
  { href: '/admin/members', label: 'Mitglieder', icon: '👥' },
  { href: '/admin/schedules', label: 'Trainingspläne', icon: '📅' },
  { href: '/admin/billing', label: 'Abrechnung', icon: '💳' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-muted/50 border-r">
      <div className="p-4">
        <h2 className="text-lg font-semibold">Admin Panel</h2>
      </div>
      <nav className="space-y-1 p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
              'hover:bg-accent hover:text-accent-foreground',
              'transition-colors'
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
