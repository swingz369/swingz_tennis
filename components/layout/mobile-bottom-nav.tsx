'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Calendar, MapPin, User, Menu, GraduationCap, ClipboardCheck } from 'lucide-react';

interface MobileBottomNavProps {
  roles?: string[];
  onMenuClick?: () => void;
}

export function MobileBottomNav({ roles, onMenuClick }: MobileBottomNavProps) {
  const pathname = usePathname();

  // Check user roles
  const isAdmin = roles?.some((r) => r === 'admin' || r === 'superadmin');
  const isTrainer = roles?.includes('trainer') || isAdmin;

  // Navigation items based on role
  let navItems = [];

  if (isTrainer) {
    // Trainer bottom navigation
    navItems = [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Trainer', href: '/trainer', icon: GraduationCap },
      { name: 'Termine', href: '/scheduler', icon: Calendar },
      { name: 'Anwesenheit', href: '/attendance-history', icon: ClipboardCheck },
    ];
  } else {
    // Member bottom navigation (default)
    navItems = [
      { name: 'Home', href: '/dashboard', icon: Home },
      { name: 'Training', href: '/training-schedule', icon: Calendar },
      { name: 'Courts', href: '/courts', icon: MapPin },
      { name: 'Profil', href: '/profile', icon: User },
    ];
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#0f2d22] border-t border-gray-200 dark:border-white/10 safe-area-pb"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
                isActive
                  ? 'text-[#40916C] dark:text-[#52B788]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${item.name}${isActive ? ' (aktuelle Seite)' : ''}`}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'scale-110')} aria-hidden="true" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-[#40916C]"
          aria-label="Hauptmenü öffnen"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className="text-xs font-medium">Menü</span>
        </button>
      </div>
    </nav>
  );
}
