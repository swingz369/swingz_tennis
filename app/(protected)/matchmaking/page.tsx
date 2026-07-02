'use client';

import { MatchmakingPanel } from '@/components/ai/matchmaking-panel';
import { ScrollReveal } from '@/components/animations';

export default function MatchmakingPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
          KI-gestützt
        </p>
        <h1 className="text-2xl font-bold text-foreground dark:text-white tracking-tight">
          Matchmaking
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Finde Trainingspartner mit passendem Level und gemeinsamen Interessen
        </p>
      </div>

      <ScrollReveal delay={100}>
        <MatchmakingPanel />
      </ScrollReveal>
    </div>
  );
}
