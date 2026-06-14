import PublicRegistrationForm from '@/components/public-registration-form';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Trophy, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Registrierung — SWINGZ',
  description:
    'Registriere dich für den Early Access von SWINGZ — KI-gestütztes Tennisclub-Management.',
};
import { IconBox } from '@/components/ui/icon-box';
import { ThemeToggleWrapper } from './theme-toggle-wrapper';

export const dynamic = 'force-dynamic';

export default function PublicRegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary/5 to-brand-light/5 dark:bg-card">
      {/* Theme Toggle */}
      <ThemeToggleWrapper />
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <IconBox
              icon={Trophy}
              size="md"
              variant="gradient-primary"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <span className="text-xl font-bold text-brand-primary dark:text-white font-display">
              SWINGZ
            </span>
          </Link>
          <p className="text-sm text-muted-foreground">Early Access — Registrierung</p>
        </div>

        {/* Registration Form */}
        <PublicRegistrationForm />

        {/* Back to login */}
        <div className="text-center mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zum Login
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Deine Daten werden vertraulich behandelt und DSGVO-konform verarbeitet.{' '}
          <Link href="/datenschutz" className="underline hover:text-brand-primary">
            Datenschutzerklärung
          </Link>
        </p>
      </div>
    </div>
  );
}
