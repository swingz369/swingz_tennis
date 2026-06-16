import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Registrieren — SWINGZ',
  description:
    'Registriere deinen Tennisclub bei SWINGZ. 14 Tage kostenlos testen, keine Kreditkarte erforderlich. KI-gestützte Trainingsplanung ab sofort.',
  alternates: {
    canonical: '/register',
  },
  openGraph: {
    title: 'Jetzt registrieren — SWINGZ',
    description:
      'Erstelle deinen Club in wenigen Minuten und starte mit KI-gestützter Trainingsplanung. 14 Tage kostenlos.',
    url: '/register',
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
