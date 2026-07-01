'use client';

import { MatchmakingPanel } from '@/components/ai/matchmaking-panel';
import { ScrollReveal } from '@/components/animations';

export default function MatchmakingPage() {
  return (
    <div className="space-y-6">
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary via-brand-primary/95 to-brand-dark p-6 md:p-8 text-white">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-background/5 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-brand-accent/10 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-medium text-white/70 mb-1">KI-gestützt</p>
            <h1 className="text-2xl md:text-3xl font-bold">Matchmaking</h1>
            <p className="text-white/70 mt-2">
              Finde Trainingspartner mit passendem Level und gemeinsamen Interessen
            </p>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={100}>
        <MatchmakingPanel />
      </ScrollReveal>
    </div>
  );
}
