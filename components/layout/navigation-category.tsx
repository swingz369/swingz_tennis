'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';

interface SubItem {
  name: string;
  href: string;
}

interface NavigationCategoryProps {
  name: string;
  icon: LucideIcon;
  subItems: SubItem[];
  onClose?: () => void;
}

export function NavigationCategory({
  name,
  icon: Icon,
  subItems,
  onClose,
}: NavigationCategoryProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(() => {
    // Auto-open if any sub-item is active
    return subItems.some((item) => pathname?.startsWith(item.href));
  });

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
          'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
        )}
        aria-expanded={isOpen}
        aria-label={`${name} ${isOpen ? 'einklappen' : 'ausklappen'}`}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{name}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            isOpen && 'transform rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="ml-8 space-y-1" role="group" aria-label={`${name} Untermenü`}>
          {subItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onClose?.()}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF8C5A] text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
