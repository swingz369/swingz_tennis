// src/presentation/app/(admin)/layout.tsx
import { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
  { href: '/admin/clubs', label: 'Vereine', icon: '🏆' },
  { href: '/admin/members', label: 'Mitglieder', icon: '👥' },
  { href: '/admin/schedules', label: 'Trainingspläne', icon: '📅' },
  { href: '/admin/billing', label: 'Abrechnung', icon: '💳' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
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
        <div className="flex-1">
          <header className="h-16 border-b flex items-center justify-between px-6">
            <div className="text-sm text-muted-foreground">
              Tennisclub Management
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm">Admin User</span>
              <Link href="/" className="text-sm underline">
                Zur Seite
              </Link>
            </div>
          </header>
          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
