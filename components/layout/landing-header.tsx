'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Trophy, Menu, X } from 'lucide-react';

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/80 dark:bg-brand-950/80 backdrop-blur-2xl shadow-lg shadow-black/[0.03] border-b border-gray-200/50 dark:border-white/[0.06]'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-br from-brand-light/50 via-brand-primary/30 to-sunrise/30 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-700" />
              <div
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-500 ${
                  scrolled
                    ? 'bg-gradient-to-br from-brand-light to-brand-primary shadow-lg shadow-brand-primary/20'
                    : 'bg-gradient-to-br from-brand-light/90 to-brand-primary shadow-2xl shadow-brand-primary/40'
                }`}
              >
                <Trophy className="h-5 w-5 text-white" />
              </div>
            </div>
            <span
              className={`text-2xl font-bold tracking-tight transition-colors duration-500 ${
                scrolled ? 'text-gray-900 dark:text-white' : 'text-white'
              }`}
            >
              SWINGZ
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Hauptnavigation">
            <a
              href="#features"
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 ${
                scrolled
                  ? 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Funktionen
            </a>
            <a
              href="#pricing"
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 ${
                scrolled
                  ? 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Preise
            </a>
            <a
              href="#testimonials"
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 ${
                scrolled
                  ? 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Referenzen
            </a>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex md:items-center md:gap-3">
            <Link href="/login">
              <Button
                size="md"
                variant={scrolled ? 'ghost' : 'secondary'}
                className={
                  !scrolled ? 'bg-white/10 text-white hover:bg-white/20 border-white/20' : ''
                }
              >
                Anmelden
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="md"
                variant="primary"
                className={`transition-all duration-500 ${
                  scrolled
                    ? 'shadow-lg shadow-brand-primary/20 hover:shadow-xl hover:shadow-brand-primary/30'
                    : 'shadow-2xl shadow-brand-primary/30 hover:shadow-brand-primary/50'
                }`}
              >
                Kostenlos starten
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden p-2 rounded-xl transition-colors ${
              scrolled
                ? 'text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-white/10'
                : 'text-white hover:bg-white/10'
            }`}
            aria-label={mobileMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden transition-all duration-300 overflow-hidden ${
          mobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div
          className={`px-4 py-4 space-y-2 ${
            scrolled
              ? 'bg-white dark:bg-surface-dark border-t border-gray-100 dark:border-white/10'
              : 'bg-brand-950/95 backdrop-blur-xl'
          }`}
        >
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              scrolled
                ? 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            Funktionen
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              scrolled
                ? 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            Preise
          </a>
          <a
            href="#testimonials"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              scrolled
                ? 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            Referenzen
          </a>
          <div className="pt-2 flex gap-3">
            <Link href="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
              <Button variant={scrolled ? 'outline' : 'secondary'} size="md" className="w-full">
                Anmelden
              </Button>
            </Link>
            <Link href="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="primary" size="md" className="w-full">
                Starten
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
