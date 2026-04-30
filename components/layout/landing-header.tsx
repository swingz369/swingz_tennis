'use client';

import Link from 'next/link';
import { ProfessionalButton } from '@/components/ui/professional';
import { Trophy } from 'lucide-react';

export function LandingHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brandPrimary to-brandPrimary/80"
              style={{ boxShadow: '0 12px 40px -8px rgba(27, 67, 50, 0.6)' }}
            >
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <span
              className="text-2xl font-bold text-white"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              SWINGZ
            </span>
          </Link>

          {/* CTA */}
          <div className="hidden md:flex md:items-center md:gap-4">
            <Link href="/login">
              <ProfessionalButton size="md" variant="secondary">
                Anmelden
              </ProfessionalButton>
            </Link>
            <Link href="/login">
              <ProfessionalButton size="md" variant="primary">
                Kostenlos starten
              </ProfessionalButton>
            </Link>
          </div>

          {/* Mobile CTA */}
          <div className="md:hidden">
            <Link href="/login">
              <ProfessionalButton size="sm" variant="primary">
                Login
              </ProfessionalButton>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
