import { describe, it, expect } from 'vitest';
import {
  buildSetupChecklist,
  missingSeasonPrerequisites,
  type SetupCounts,
} from '@/lib/setup-checklist';

const empty: SetupCounts = {
  courts: 0,
  trainers: 0,
  members: 0,
  feeCategories: 0,
  seasons: 0,
};

describe('buildSetupChecklist', () => {
  it('markiert bei leerem Verein nichts als erledigt', () => {
    const { doneCount, allDone } = buildSetupChecklist(empty);
    expect(doneCount).toBe(0);
    expect(allDone).toBe(false);
  });

  it('leitet den Status aus den Zählern ab, statt ihn zu speichern', () => {
    const { steps } = buildSetupChecklist({ ...empty, courts: 2 });
    expect(steps.find((s) => s.key === 'courts')?.done).toBe(true);
    expect(steps.find((s) => s.key === 'trainers')?.done).toBe(false);
  });

  it('blockiert die Saisonplanung, solange Plätze/Trainer/Mitglieder fehlen', () => {
    const season = buildSetupChecklist({ ...empty, courts: 1 }).steps.find(
      (s) => s.key === 'seasons'
    )!;
    expect(season.blocked).toBe(true);
    expect(season.blockedBy).toEqual(['Trainer einladen', 'Mitglieder einladen']);
  });

  it('gibt die Saisonplanung frei, sobald die Voraussetzungen stehen', () => {
    const season = buildSetupChecklist({
      ...empty,
      courts: 1,
      trainers: 1,
      members: 1,
    }).steps.find((s) => s.key === 'seasons')!;
    expect(season.blocked).toBe(false);
    expect(season.blockedBy).toEqual([]);
  });

  it('meldet allDone erst, wenn jeder Schritt Daten hat', () => {
    const full = buildSetupChecklist({
      courts: 1,
      trainers: 1,
      members: 1,
      feeCategories: 1,
      seasons: 1,
    });
    expect(full.allDone).toBe(true);
    expect(full.doneCount).toBe(full.totalCount);
  });
});

describe('missingSeasonPrerequisites', () => {
  it('nennt alle drei Lücken bei leerem Verein', () => {
    expect(missingSeasonPrerequisites(empty).map((s) => s.key)).toEqual([
      'courts',
      'trainers',
      'members',
    ]);
  });

  it('gibt frei, sobald Plätze, Trainer und Mitglieder da sind', () => {
    expect(missingSeasonPrerequisites({ ...empty, courts: 1, trainers: 1, members: 2 })).toEqual(
      []
    );
  });

  it('sperrt weiterhin, wenn nach der ersten Saison die Plätze wegfallen', () => {
    // Anders als die Checkliste: dort gilt ein erledigter Schritt nie als blockiert.
    const missing = missingSeasonPrerequisites({
      ...empty,
      trainers: 1,
      members: 5,
      seasons: 1,
    });
    expect(missing.map((s) => s.key)).toEqual(['courts']);
  });

  it('liefert Label und Link für die Fehlermeldung mit', () => {
    const [step] = missingSeasonPrerequisites({ ...empty, trainers: 1, members: 1 });
    expect(step.label).toBe('Plätze anlegen');
    expect(step.href).toBe('/admin/courts');
  });
});
