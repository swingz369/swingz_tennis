import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anmelden | SWINGZ',
  description:
    'Melde dich bei SWINGZ an und verwalte deinen Tennisclub. Trainingsplanung, Buchungsmanagement und mehr.',
  robots: { index: false, follow: true },
  alternates: {
    canonical: '/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
