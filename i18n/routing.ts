import { createNavigation } from 'next-intl/navigation';

export const locales = ['de', 'en'] as const;
export const defaultLocale = 'de';

export const pathnames = {
  '/': '/',
  '/dashboard': '/dashboard',
  '/bookings': '/bookings',
  '/scheduler': '/scheduler',
  '/admin/analytics': '/admin/analytics',
  '/admin/billing': '/admin/billing',
  '/admin/clubs': '/admin/clubs',
  '/admin/members': '/admin/members',
  '/admin/schedules': '/admin/schedules',
  '/admin/settings': '/admin/settings',
  '/admin/onboarding': '/admin/onboarding',
  '/trainer': '/trainer',
  '/member': '/member',
  '/login': '/login',
  '/register': '/register',
  '/forgot-password': '/forgot-password',
  '/reset-password': '/reset-password',
  '/set-password': '/set-password',
  '/verify-email': '/verify-email',
} as const;

export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales,
  pathnames,
});
