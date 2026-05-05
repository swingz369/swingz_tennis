'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Calendar, MapPin, User, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  roles?: string[];
  onMenuClick?: () => void;
}

export function MobileBottomNav({ roles, onMenuClick }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Training', href: '/training-schedule', icon: Calendar },
    { name: 'Courts', href: '/courts', icon: MapPin },
    { name: 'Profil', href: '/profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#0f2d22] border-t border-gray-200 dark:border-white/10 safe-area-pb">
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
            >
              <item.icon className={cn('h-5 w-5', isActive && 'scale-110')} />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <Menu className="h-5 w-5" />
          <span className="text-xs font-medium">Menü</span>
        </button>
      </div>
    </nav>
  );
}
