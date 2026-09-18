import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zugang anfragen | SWINGZ',
  description:
    'Fordere Zugang zu SWINGZ für deinen Tennisclub an. Wir richten dein Konto persönlich ein und melden uns innerhalb von 1 bis 2 Werktagen.',
  alternates: {
    canonical: '/register',
  },
  openGraph: {
    title: 'Zugang anfragen | SWINGZ',
    description:
      'Fordere Zugang für deinen Verein an: persönliche Einrichtung, Antwort innerhalb von 1 bis 2 Werktagen.',
    url: '/register',
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
