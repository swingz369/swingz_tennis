'use client';

import { CheckCircle2, XCircle, HelpCircle, Hourglass } from 'lucide-react';
import { RsvpSection } from '@/components/rsvp-section';
import { getRsvpStatusBadge } from '@/lib/rsvp-status';

const SAMPLE_DATE = new Date('2026-06-15T17:00:00Z');
const SAMPLE_START = '17:00:00';
const SAMPLE_END = '18:30:00';
const SAMPLE_COURT = 'Platz 1';
const SAMPLE_TRAINER = 'Anna Schmidt';

interface SnapshotCase {
  key: string;
  label: string;
  currentStatus: string | null;
}

const CASES: SnapshotCase[] = [
  { key: 'yes', label: 'yes', currentStatus: 'yes' },
  { key: 'no', label: 'no', currentStatus: 'no' },
  { key: 'maybe', label: 'maybe', currentStatus: 'maybe' },
  { key: 'pending', label: 'pending', currentStatus: 'pending' },
  { key: 'null', label: 'null', currentStatus: null },
];

export default function RsvpSnapshotPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-foreground">RSVP Snapshot</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visual verification of the unified RSVP status presentation. Each row shows the action
            button group (left) and the corresponding status badge (right) for one of the 5 status
            paths.
          </p>
        </header>

        {/* ═══ Side-by-side: Buttons + Badge ═══ */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Action buttons + matching badge
          </h2>
          <div className="rounded-xl border border-border bg-background divide-y divide-border">
            {CASES.map((c) => {
              const badge = getRsvpStatusBadge(c.currentStatus);
              return (
                <div
                  key={c.key}
                  className="grid grid-cols-[160px_1fr_1fr] items-center gap-4 px-5 py-4"
                  data-testid={`rsvp-row-${c.key}`}
                >
                  <code className="text-xs font-mono text-muted-foreground">{c.label}</code>

                  {/* RsvpSection buttons (useSubmitRsvp will 401 but that's fine) */}
                  <div data-testid={`rsvp-buttons-${c.key}`}>
                    <RsvpSection
                      sessionId={`snapshot-${c.key}`}
                      sessionDate={SAMPLE_DATE}
                      startTime={SAMPLE_START}
                      endTime={SAMPLE_END}
                      courtName={SAMPLE_COURT}
                      trainerName={SAMPLE_TRAINER}
                      currentStatus={c.currentStatus}
                    />
                  </div>

                  {/* Badge render — same code path as member-training-schedule */}
                  <div data-testid={`rsvp-badge-${c.key}`}>
                    {badge ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border ${badge.color}`}
                      >
                        <badge.icon className="h-3.5 w-3.5" />
                        RSVP: {badge.label}
                      </span>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">
                        (kein Badge — kein Status)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══ Static icon legend ═══ */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Icon reference
          </h2>
          <div className="rounded-xl border border-border bg-background p-4 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> Zusage
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <XCircle className="h-4 w-4 text-red-600" /> Absage
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <HelpCircle className="h-4 w-4 text-amber-600" /> Vielleicht
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Hourglass className="h-4 w-4 text-blue-600" /> Wartet auf Antwort
            </span>
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground text-center">
          🧪 Temporary debug route — safe to delete after verification.
        </p>
      </div>
    </div>
  );
}
