import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RsvpSection } from '@/components/rsvp-section';
import { useSubmitRsvp } from '@/hooks/use-rsvp';

// --- Mocks ----------------------------------------------------------------
vi.mock('@/hooks/use-rsvp', () => ({
  useSubmitRsvp: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockMutateAsync = vi.fn();
const mockUseSubmitRsvp = vi.mocked(useSubmitRsvp);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const defaultProps = {
  sessionId: 'session-1',
  sessionDate: new Date('2026-06-15T00:00:00Z'),
  startTime: '17:00',
  endTime: '18:30',
  courtName: 'Platz 1',
  trainerName: 'Anna Schmidt',
};

describe('RsvpSection (RTL)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ ok: true });
    mockUseSubmitRsvp.mockReturnValue({
      mutateAsync: mockMutateAsync,
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useSubmitRsvp>);
  });

  // ─── Rendering ─────────────────────────────────────────────────────────
  describe('Rendering', () => {
    it('rendert die 3 Action-Buttons (Zusage/Absage/Vielleicht)', () => {
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });
      expect(screen.getByRole('button', { name: /Zusage/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Absage/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Vielleicht/i })).toBeInTheDocument();
    });

    it('rendert die iCal/Google-Export-Buttons', () => {
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });
      expect(screen.getByTitle(/Kalender exportieren/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Google Kalender/i)).toBeInTheDocument();
    });

    it('verwendet data-rsvp-status Attribute für Test-Hooks', () => {
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });
      expect(screen.getByTestId ? screen.getByTestId : null); // skip if not present
      const accepted = document.querySelector('[data-rsvp-status="accepted"]');
      const declined = document.querySelector('[data-rsvp-status="declined"]');
      const maybe = document.querySelector('[data-rsvp-status="maybe"]');
      expect(accepted).toBeInTheDocument();
      expect(declined).toBeInTheDocument();
      expect(maybe).toBeInTheDocument();
    });

    it('zeigt KEINEN Live-Status-Indikator wenn currentStatus undefined', () => {
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });
      expect(screen.queryByText(/Status:/)).not.toBeInTheDocument();
    });

    it('zeigt KEINEN pending-Button (nur 3 Action-Keys)', () => {
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });
      // queryAllByRole returns [] when no match (vs getAllByRole which throws)
      const pendingButtons = screen.queryAllByRole('button', { name: /Wartet auf Antwort/i });
      expect(pendingButtons).toHaveLength(0);
    });
  });

  // ─── Pre-selected Status ──────────────────────────────────────────────
  describe('Pre-selected Status', () => {
    it('zeigt den Status-Indikator wenn currentStatus="yes"', () => {
      render(<RsvpSection {...defaultProps} currentStatus="yes" />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText(/Status: Zusage/)).toBeInTheDocument();
    });

    it('markiert den korrekten Button als aktiv (aria-pressed=true)', () => {
      render(<RsvpSection {...defaultProps} currentStatus="declined" />, {
        wrapper: createWrapper(),
      });
      const absageBtn = screen.getByRole('button', { name: /Absage/i });
      expect(absageBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('akzeptiert Legacy-Aliase (currentStatus="attending" → Zusage aktiv)', () => {
      render(<RsvpSection {...defaultProps} currentStatus="attending" />, {
        wrapper: createWrapper(),
      });
      const zusageBtn = screen.getByRole('button', { name: /Zusage/i });
      expect(zusageBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('normalisiert Großschreibung (currentStatus="Accepted" → Zusage aktiv)', () => {
      render(<RsvpSection {...defaultProps} currentStatus="Accepted" />, {
        wrapper: createWrapper(),
      });
      const zusageBtn = screen.getByRole('button', { name: /Zusage/i });
      expect(zusageBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  // ─── Klick-Interaktion ───────────────────────────────────────────────
  describe('Klick-Interaktion', () => {
    it('ruft useSubmitRsvp.mutateAsync mit sessionId+status auf', async () => {
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByRole('button', { name: /Zusage/i }));
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          sessionId: 'session-1',
          status: 'accepted',
        });
      });
    });

    it('setzt Status-Indikator nach erfolgreichem Klick auf "Zusage"', async () => {
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByRole('button', { name: /Vielleicht/i }));
      await waitFor(() => {
        expect(screen.getByText(/Status: Vielleicht/)).toBeInTheDocument();
      });
    });

    it('setzt aria-pressed=true für den geklickten Button', async () => {
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByRole('button', { name: /Absage/i }));
      await waitFor(() => {
        const absageBtn = screen.getByRole('button', { name: /Absage/i });
        expect(absageBtn).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('setzt aria-pressed=false für die anderen Buttons', async () => {
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByRole('button', { name: /Zusage/i }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Absage/i })).toHaveAttribute(
          'aria-pressed',
          'false'
        );
        expect(screen.getByRole('button', { name: /Vielleicht/i })).toHaveAttribute(
          'aria-pressed',
          'false'
        );
      });
    });
  });

  // ─── Failure-Revert ───────────────────────────────────────────────────
  describe('Failure-Revert', () => {
    it('revertiert auf currentStatus wenn mutateAsync fehlschlägt', async () => {
      mockMutateAsync.mockRejectedValueOnce(new Error('Server-Fehler'));
      render(<RsvpSection {...defaultProps} currentStatus="yes" />, {
        wrapper: createWrapper(),
      });

      // Klick auf Absage (würde Status ändern)
      fireEvent.click(screen.getByRole('button', { name: /Absage/i }));

      // Status sollte wieder "Zusage" sein (vom currentStatus) — catch-Block im Component
      await waitFor(() => {
        expect(screen.getByText(/Status: Zusage/)).toBeInTheDocument();
      });

      // Absage-Button sollte nicht mehr aktiv sein
      const absageBtn = screen.getByRole('button', { name: /Absage/i });
      expect(absageBtn).toHaveAttribute('aria-pressed', 'false');
    });

    it('zeigt keinen Status-Indikator nach Fehlschlag wenn kein currentStatus', async () => {
      mockMutateAsync.mockRejectedValueOnce(new Error('Netzwerkfehler'));
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: /Zusage/i }));

      // Nach Fehlschlag: kein Status-Indikator mehr (Status wurde auf null zurückgesetzt)
      await waitFor(() => {
        expect(screen.queryByText(/Status:/)).not.toBeInTheDocument();
      });
    });

    it('mutateAsync wurde aufgerufen', async () => {
      mockMutateAsync.mockRejectedValueOnce(new Error('Server-Fehler'));
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: /Zusage/i }));
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          sessionId: 'session-1',
          status: 'accepted',
        });
      });
    });
  });

  // ─── Pending-State (useSubmitRsvp.isPending) ─────────────────────────
  describe('Pending-State', () => {
    it('deaktiviert alle Buttons während isPending', () => {
      mockUseSubmitRsvp.mockReturnValue({
        mutateAsync: mockMutateAsync,
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        isSuccess: false,
        data: undefined,
        error: null,
        reset: vi.fn(),
      } as unknown as ReturnType<typeof useSubmitRsvp>);

      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: /Zusage/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Absage/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Vielleicht/i })).toBeDisabled();
    });
  });

  // ─── Accessibility ───────────────────────────────────────────────────
  describe('Accessibility', () => {
    it('die Button-Gruppe hat ein aria-label', () => {
      render(<RsvpSection {...defaultProps} />, { wrapper: createWrapper() });
      expect(screen.getByRole('group', { name: /RSVP-Status setzen/i })).toBeInTheDocument();
    });

    it('der Status-Indikator hat aria-live=polite', () => {
      render(<RsvpSection {...defaultProps} currentStatus="yes" />, {
        wrapper: createWrapper(),
      });
      const status = screen.getByText(/Status: Zusage/);
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });
});
