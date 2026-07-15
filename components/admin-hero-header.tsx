'use client';

import Link from 'next/link';
import { UserPlus, PenSquare, ChevronRight } from 'lucide-react';
import { AnimatedCounter, ScrollReveal } from '@/components/animations';
import { Button } from '@/components/ui/button';

interface AdminHeroHeaderProps {
  firstName: string;
  clubName: string;
  isSuperadmin: boolean;
  memberCount: number;
  trainerCount: number;
  todaySessionCount: number;
}

export function AdminHeroHeader({
  firstName,
  clubName,
  isSuperadmin,
  memberCount,
  trainerCount,
  todaySessionCount,
}: AdminHeroHeaderProps) {
  return (
    <ScrollReveal>
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-primary via-brand-primary/95 to-brand-dark p-6 md:p-8 text-white">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-background/5 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-brand-accent/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/70 mb-1">
                {clubName} ·{' '}
                <span className={isSuperadmin ? 'text-info-300' : 'text-brand-accent'}>
                  {isSuperadmin ? 'Superadmin' : 'Admin'}
                </span>
              </p>
              <h1 className="text-2xl md:text-3xl font-bold font-display">Hallo, {firstName}</h1>
              <p className="text-white/70 mt-2">
                <AnimatedCounter value={memberCount} /> Mitglieder ·{' '}
                <AnimatedCounter value={trainerCount} /> Trainer ·{' '}
                <AnimatedCounter value={todaySessionCount} /> Sessions heute
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                asChild
                className="bg-background/15 backdrop-blur-sm border-white/20 text-white hover:bg-background/25 gap-2"
              >
                <Link href="/admin/members">
                  <UserPlus className="h-4 w-4" />
                  Mitglied einladen
                </Link>
              </Button>
              <Button
                asChild
                className="bg-background/15 backdrop-blur-sm border-white/20 text-white hover:bg-background/25 gap-2"
              >
                <Link href="/messages">
                  <PenSquare className="h-4 w-4" />
                  Nachricht senden
                </Link>
              </Button>
              {isSuperadmin && (
                <Link
                  href="/select-admin-club"
                  className="flex items-center gap-1.5 text-xs font-medium text-white/80 bg-white/10 backdrop-blur-sm hover:bg-white/20 px-3 py-2 rounded-xl transition-colors"
                >
                  Verein wechseln <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </ScrollReveal>
  );
}
