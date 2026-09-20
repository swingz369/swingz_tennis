'use client';

import { cn } from '@/lib/utils';
import { getSurfaceLabel } from '@/lib/court-calendar-utils';

type FilterCourt = { id: string; name: string; surface: string; hasIndoor?: boolean };

/** Ab so vielen Plätzen zeigt der Kalender standardmäßig nur die ersten {n} Plätze. */
export const DEFAULT_VISIBLE_COURTS = 4;

/** Sichtbare Plätze: explizite Auswahl, sonst alle (bzw. die ersten 4 bei vielen Plätzen). */
export function resolveVisibleCourts<T extends { id: string }>(
  courts: T[],
  visibleIds: string[] | null
): T[] {
  if (visibleIds) {
    const picked = courts.filter((c) => visibleIds.includes(c.id));
    if (picked.length > 0) return picked;
  }
  return courts.length > DEFAULT_VISIBLE_COURTS ? courts.slice(0, DEFAULT_VISIBLE_COURTS) : courts;
}

const chipClass = (on: boolean) =>
  cn(
    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
    on
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border bg-card text-foreground hover:bg-muted'
  );

/** Platz-Filter: „Alle“, Gruppen (Belag/Halle) und einzelne Plätze als Mehrfachauswahl. */
export function CourtFilterChips({
  courts,
  visible,
  onChange,
}: {
  courts: FilterCourt[];
  visible: FilterCourt[];
  onChange: (ids: string[]) => void;
}) {
  const visibleIds = new Set(visible.map((c) => c.id));
  const sameSet = (ids: string[]) =>
    ids.length === visibleIds.size && ids.every((id) => visibleIds.has(id));

  const groups = [
    ...new Map(
      courts.map((c) => [c.hasIndoor ? 'Halle' : getSurfaceLabel(c.surface), c.hasIndoor])
    ).keys(),
  ].map((label) => ({
    label,
    ids: courts
      .filter((c) => (c.hasIndoor ? 'Halle' : getSurfaceLabel(c.surface)) === label)
      .map((c) => c.id),
  }));
  const allIds = courts.map((c) => c.id);

  const toggle = (id: string) => {
    if (!visibleIds.has(id)) return onChange([...visibleIds, id]);
    if (visibleIds.size > 1) onChange([...visibleIds].filter((x) => x !== id));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Plätze filtern">
      <button type="button" className={chipClass(sameSet(allIds))} onClick={() => onChange(allIds)}>
        Alle {courts.length}
      </button>
      {groups.length > 1 &&
        groups.map((g) => (
          <button
            key={g.label}
            type="button"
            className={chipClass(sameSet(g.ids))}
            onClick={() => onChange(g.ids)}
          >
            {g.label}
          </button>
        ))}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      {courts.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={visibleIds.has(c.id)}
          className={chipClass(visibleIds.has(c.id))}
          onClick={() => toggle(c.id)}
        >
          {c.name}
        </button>
      ))}
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {visible.length} von {courts.length} sichtbar
      </span>
    </div>
  );
}
