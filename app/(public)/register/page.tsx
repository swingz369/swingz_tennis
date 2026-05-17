import PublicRegistrationForm from '@/components/public-registration-form';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function PublicRegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary/5 to-brand-light/5">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-brand-light" />
            <span className="text-xl font-bold text-brand-primary">SWINGZ</span>
          </Link>
        </div>

        {/* Registration Form */}
        <PublicRegistrationForm />

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Deine Daten werden vertraulich behandelt und nur für die Mitgliedschaft verwendet.{' '}
          <Link href="/datenschutz" className="underline hover:text-brand-primary">
            Datenschutzerklärung
          </Link>
        </p>
      </div>
    </div>
  );
}
