import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SWINGZ — KI-gestütztes Tennisclub-Management',
  description:
    'Die Plattform für Tennisclub-Management: KI-Trainingsplanung, Mitgliederverwaltung, Buchungsmanagement und Analytics. 14 Tage kostenlos testen.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'SWINGZ — Optimale Trainingspläne. Maximale Performance.',
    description:
      'KI-gesteuerte Plattform für Tennisclub-Management. Optimiere Trainingspläne, verwalte Mitglieder und steigere die Effizienz.',
    siteName: 'SWINGZ',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SWINGZ — Tennisclub-Management mit KI',
    description: 'Optimale Trainingspläne. Maximale Performance. 14 Tage kostenlos testen.',
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
