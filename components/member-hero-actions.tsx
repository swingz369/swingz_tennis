'use client';

import Link from 'next/link';
import {
  Calendar,
  MessageSquare,
  CreditCard,
  GraduationCap,
  Trophy,
  ClipboardCheck,
} from 'lucide-react';

interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  color: string;
}

const ACTIONS: QuickAction[] = [
  {
    label: 'Buchen',
    href: '/bookings',
    icon: Calendar,
    color:
      'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30',
  },
  {
    label: 'Nachrichten',
    href: '/messages',
    icon: MessageSquare,
    color:
      'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/20 dark:text-violet-300 dark:hover:bg-violet-500/30',
  },
  {
    label: 'Rechnungen',
    href: '/billing',
    icon: CreditCard,
    color:
      'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30',
  },
  {
    label: 'Trainer',
    href: '/member/trainer-booking',
    icon: GraduationCap,
    color:
      'bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-500/20 dark:text-teal-300 dark:hover:bg-teal-500/30',
  },
  {
    label: 'Turniere',
    href: '/member/tournaments',
    icon: Trophy,
    color:
      'bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-500/20 dark:text-orange-300 dark:hover:bg-orange-500/30',
  },
  {
    label: 'Präferenzen',
    href: '/member/preferences',
    icon: ClipboardCheck,
    color:
      'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30',
  },
];

export function MemberHeroActions() {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${action.color}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
