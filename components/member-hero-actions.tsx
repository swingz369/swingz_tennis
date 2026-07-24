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
      'bg-info-50 text-info-700 hover:bg-info-100 dark:bg-info-500/20 dark:text-info-300 dark:hover:bg-info-500/30',
  },
  {
    label: 'Nachrichten',
    href: '/messages',
    icon: MessageSquare,
    color:
      'bg-info-50 text-info-700 hover:bg-info-100 dark:bg-info-500/20 dark:text-info-300 dark:hover:bg-info-500/30',
  },
  {
    label: 'Rechnungen',
    href: '/billing',
    icon: CreditCard,
    color:
      'bg-warning-50 text-warning-700 hover:bg-warning-100 dark:bg-warning-500/20 dark:text-warning-300 dark:hover:bg-warning-500/30',
  },
  {
    label: 'Trainer',
    href: '/member/trainer-booking',
    icon: GraduationCap,
    color:
      'bg-info-50 text-info-700 hover:bg-info-100 dark:bg-info-500/20 dark:text-info-300 dark:hover:bg-info-500/30',
  },
  {
    label: 'Turniere',
    href: '/member/tournaments',
    icon: Trophy,
    color:
      'bg-brand-accent-50 text-brand-accent-700 hover:bg-brand-accent-100 dark:bg-brand-accent-500/20 dark:text-brand-accent-300 dark:hover:bg-brand-accent-500/30',
  },
  {
    label: 'Präferenzen',
    href: '/member/preferences',
    icon: ClipboardCheck,
    color:
      'bg-success-50 text-success-700 hover:bg-success-100 dark:bg-success-500/20 dark:text-success-300 dark:hover:bg-success-500/30',
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${action.color}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
