/**
 * Wizard-Schritt-Roundtrip: goToStep schreibt den Schritt in die URL, und ein
 * Schrittwechsel in der URL (Browser-Zurück) spiegelt sich zurück in den Reducer.
 * Siehe docs/ARCHIV/2026-09-17-ux-analyse-und-sanierungsprompt.md Phase 1.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { WizardProvider, useWizard } from '@/lib/season-planning/wizard-context';

// Der globale Mock in src/__tests__/setup.ts liefert bei jedem Aufruf ein frisches,
// leeres URLSearchParams und No-Op push/replace — für den Roundtrip hier lokal
// durch einen zustandsbehafteten Mock ersetzt (überschreibt den globalen Mock nur
// für diese Datei).
let currentParams = new URLSearchParams();
const push = vi.fn((url: string) => {
  const query = url.split('?')[1] ?? '';
  currentParams = new URLSearchParams(query);
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/admin/seasons/season-1/planning',
  useSearchParams: () => currentParams,
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <WizardProvider seasonId="season-1" clubId="club-1" initialStep={1}>
      {children}
    </WizardProvider>
  );
}

describe('wizard-context — Schritt-URL-Roundtrip', () => {
  beforeEach(() => {
    currentParams = new URLSearchParams();
    push.mockClear();
  });

  it('schreibt goToStep in die URL', () => {
    const { result } = renderHook(() => useWizard(), { wrapper });

    act(() => {
      result.current.goToStep(3);
    });

    expect(result.current.state.currentStep).toBe(3);
    expect(push).toHaveBeenCalledWith('/admin/seasons/season-1/planning?step=3', {
      scroll: false,
    });
  });

  it('übernimmt einen Schrittwechsel aus der URL in den Reducer (Browser-Zurück)', () => {
    const { result, rerender } = renderHook(() => useWizard(), { wrapper });

    act(() => {
      result.current.goToStep(3);
    });
    expect(result.current.state.currentStep).toBe(3);

    // Browser-Zurück ändert die URL, ohne goToStep aufzurufen — genau das
    // simuliert ein popstate-Event.
    act(() => {
      currentParams = new URLSearchParams('step=1');
    });
    rerender();

    expect(result.current.state.currentStep).toBe(1);
  });

  it('nextStep/prevStep bleiben innerhalb 1..4 und schreiben die URL mit', () => {
    const { result } = renderHook(() => useWizard(), { wrapper });

    act(() => {
      result.current.prevStep();
    });
    expect(result.current.state.currentStep).toBe(1);
    expect(push).toHaveBeenCalledWith('/admin/seasons/season-1/planning?step=1', {
      scroll: false,
    });

    act(() => {
      result.current.nextStep();
    });
    expect(result.current.state.currentStep).toBe(2);
  });
});
