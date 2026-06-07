import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '../test-utils';
import TrainerAvailabilityManager from '@/components/trainer-availability-manager';

/* ── Mock apiFetch ── */

const mockApiFetch = vi.fn();
vi.mock('@/lib/api-fetch', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

/* ── Helpers ── */

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers(),
    redirected: false,
    statusText: '',
    type: 'basic' as const,
    url: '',
    clone: () => mockResponse(status, body),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => JSON.stringify(body),
  } as Response;
}

/** Shortcut: mock returns empty slots (renders empty state after loading) */
function mockEmptySlots() {
  mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
}

/**
 * Assert that the combined text content of the rendered tree contains
 * the given substrings. Works around fragmented text across <strong>
 * and other inline elements that confuses getByText.
 */
function expectText(...substrings: string[]) {
  const allText = document.body.textContent || '';
  for (const s of substrings) {
    expect(allText).toContain(s);
  }
}

function expectNotText(...substrings: string[]) {
  const allText = document.body.textContent || '';
  for (const s of substrings) {
    expect(allText).not.toContain(s);
  }
}

/**
 * Build a date-based slot as returned by the real API.
 * `date` is ISO YYYY-MM-DD; the component converts it to a weekday internally.
 */
function apiSlot(
  date: string,
  start_time: string,
  end_time: string,
  status = 'available',
  id?: string
) {
  return {
    id: id ?? `api-${date}-${start_time}`,
    trainer_id: 'trainer-1',
    date,
    start_time,
    end_time,
    status,
    notes: null,
  };
}

/* ── Tests ── */

describe('TrainerAvailabilityManager (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading spinner then transitions to empty state', async () => {
    mockEmptySlots();
    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Keine Verfügbarkeiten eingetragen')).toBeInTheDocument();
    });

    // Empty state chip buttons should be present
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('19:00')).toBeInTheDocument();
  });

  it('clicking a preset chip in the empty state adds a slot and transitions to grid view', async () => {
    mockEmptySlots();
    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Keine Verfügbarkeiten eingetragen')).toBeInTheDocument();
    });

    // Click the "08:00" chip button in the empty state
    fireEvent.click(screen.getByText('08:00'));

    // Grid view: Monday card shows the slot badge
    await waitFor(() => {
      expect(screen.getByText('1 Fenster')).toBeInTheDocument();
    });

    // Summary: "1 Tag · 1 Zeitfenster"
    expectText('1 Tag', '1 Zeitfenster');
    // Empty state gone
    expectNotText('Keine Verfügbarkeiten eingetragen');
  });

  it('clicking the same chip twice toggles it off and returns to empty state', async () => {
    mockEmptySlots();
    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Keine Verfügbarkeiten eingetragen')).toBeInTheDocument();
    });

    // Click "11:00" → grid view
    fireEvent.click(screen.getByText('11:00'));

    await waitFor(() => {
      expect(screen.getByText('1 Fenster')).toBeInTheDocument();
    });

    // Find the Monday "11:00" chip — should be active (brand-primary)
    const allChips = screen.getAllByText('11:00');
    const mondayChip = allChips.find((el) => el.className.includes('bg-brand-primary'));
    expect(mondayChip).toBeTruthy();

    // Click again → toggle off
    fireEvent.click(mondayChip!);

    // Empty state returns
    await waitFor(() => {
      expect(screen.getByText('Keine Verfügbarkeiten eingetragen')).toBeInTheDocument();
    });
  });

  it('calls apiFetch with week date range on mount', async () => {
    mockEmptySlots();
    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Keine Verfügbarkeiten eingetragen')).toBeInTheDocument();
    });

    // URL now includes from/to date params for the selected week
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/trainer/availability?from=')
    );
    expect(mockApiFetch).toHaveBeenCalledWith(expect.stringContaining('&to='));
  });

  it('pre-fills slots from the API and shows them in the grid', async () => {
    // Build date-based slots for the current week (Mon=1, Wed=3, Fri=5)
    // The component will convert dates to weekdays via new Date(date).getDay()
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const wednesday = new Date(monday);
    wednesday.setDate(monday.getDate() + 2);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          apiSlot(fmt(monday), '08:00', '09:00', 'available', 'existing-1'),
          apiSlot(fmt(wednesday), '11:00', '12:00', 'available', 'existing-2'),
          apiSlot(fmt(friday), '16:00', '17:00', 'booked', 'existing-3'),
        ],
      })
    );

    render(<TrainerAvailabilityManager />);

    // Grid view (not empty state)
    await waitFor(() => {
      expect(screen.getByText('Speichern')).toBeInTheDocument();
    });

    expectNotText('Keine Verfügbarkeiten eingetragen');

    // Summary: "3 Tage · 3 Zeitfenster"
    expectText('3 Tage', '3 Zeitfenster');

    expect(screen.getByText('Montag')).toBeInTheDocument();
    expect(screen.getByText('Mittwoch')).toBeInTheDocument();
    expect(screen.getByText('Freitag')).toBeInTheDocument();
  });

  it('clicking a chip in the grid view (per-day toggles) adds a second slot', async () => {
    // Build Monday date for the current week
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Pre-fill one slot for Monday
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [apiSlot(fmt(monday), '08:00', '09:00', 'available', 'existing-1')],
      })
    );

    render(<TrainerAvailabilityManager />);

    // Monday shows "1 Fenster"
    await waitFor(() => {
      expect(screen.getByText('1 Fenster')).toBeInTheDocument();
    });

    expectText('1 Tag', '1 Zeitfenster');

    // Click "09:30" chip specifically in the Monday card (scope with within)
    const mondayHeading = screen.getByText('Montag');
    // Walk up to the Card that contains the heading (CardHeader→Card)
    const mondayCard = mondayHeading.closest('.rounded-t-lg')?.parentElement;
    expect(mondayCard).toBeTruthy();
    const mondayChip09 = within(mondayCard!).getByText('09:30');
    fireEvent.click(mondayChip09);

    // Monday now "2 Fenster"
    await waitFor(() => {
      expect(screen.getByText('2 Fenster')).toBeInTheDocument();
    });

    // Summary: still 1 Tag but 2 Zeitfenster
    expectText('1 Tag', '2 Zeitfenster');
  });

  it('shows month and week navigation UI', async () => {
    mockEmptySlots();
    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Keine Verfügbarkeiten eingetragen')).toBeInTheDocument();
    });

    // Month navigation
    expect(screen.getByText('Heute')).toBeInTheDocument();

    // Week range label is present (format depends on current date, check for "–")
    expectText('–');
  });

  it('shows 403 error message when trainer profile is missing', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(403, { error: 'Kein Trainer-Profil' }));

    render(<TrainerAvailabilityManager />);

    // Error message appears (empty state is also shown — existing component behavior)
    await waitFor(() => {
      expect(screen.getByText('Kein Trainer-Profil')).toBeInTheDocument();
    });
  });

  it('shows generic error message on fetch failure', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Netzwerkfehler'));

    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Netzwerkfehler')).toBeInTheDocument();
    });
  });

  it('saveSlots DELETEs API slots that were removed from the UI', async () => {
    // Build dates for current week
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const tuesday = new Date(monday);
    tuesday.setDate(monday.getDate() + 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // 1. Mount: API returns 2 existing slots (Mon + Tue)
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          apiSlot(fmt(monday), '08:00', '09:00', 'available', 'existing-mon'),
          apiSlot(fmt(tuesday), '11:00', '12:00', 'available', 'existing-tue'),
        ],
      })
    );

    render(<TrainerAvailabilityManager />);

    // Both slots loaded → grid view with 2 Tage, 2 Zeitfenster
    await waitFor(() => {
      expect(screen.getByText('Speichern')).toBeInTheDocument();
    });
    expectText('2 Tage', '2 Zeitfenster');

    // 2. Remove Tuesday's slot by toggling the "11:00" chip
    // Find the Tuesday card and click the active "11:00" chip
    const dienstagHeading = screen.getByText('Dienstag');
    const dienstagCard = dienstagHeading.closest('.rounded-t-lg')?.parentElement;
    expect(dienstagCard).toBeTruthy();
    const dienstagChip11 = within(dienstagCard!).getByText('11:00');
    fireEvent.click(dienstagChip11);

    // Now only 1 Tag, 1 Zeitfenster
    await waitFor(() => {
      expectText('1 Tag', '1 Zeitfenster');
    });

    // 3. Save: mock GET-existing (2 slots), DELETE for Tue, re-fetch GET
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          apiSlot(fmt(monday), '08:00', '09:00', 'available', 'existing-mon'),
          apiSlot(fmt(tuesday), '11:00', '12:00', 'available', 'existing-tue'),
        ],
      })
    );
    // DELETE existing-tue
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { success: true }));
    // Re-fetch after save returns only the remaining Monday slot
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [apiSlot(fmt(monday), '08:00', '09:00', 'available', 'existing-mon')],
      })
    );

    // Click Speichern
    fireEvent.click(screen.getByText('Speichern'));

    // 4. Message shows deleted count
    await waitFor(() => {
      expectText('1 bereits vorhanden', '1 gelöscht');
    });

    // DELETE was called for the removed Tuesday slot
    expect(mockApiFetch).toHaveBeenCalledWith('/api/trainer/availability/existing-tue', {
      method: 'DELETE',
    });
  });

  it('saveSlots does not DELETE booked slots that remain in the UI', async () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const tuesday = new Date(monday);
    tuesday.setDate(monday.getDate() + 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Mount: API returns 2 slots (Mon available, Tue booked)
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          apiSlot(fmt(monday), '08:00', '09:00', 'available', 'existing-mon'),
          apiSlot(fmt(tuesday), '11:00', '12:00', 'booked', 'existing-tue'),
        ],
      })
    );

    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Speichern')).toBeInTheDocument();
    });

    // Toggle off Monday's "08:00" chip to remove the editable slot
    const montagHeading = screen.getByText('Montag');
    const montagCard = montagHeading.closest('.rounded-t-lg')?.parentElement;
    expect(montagCard).toBeTruthy();
    const montagChip08 = within(montagCard!).getByText('08:00');
    fireEvent.click(montagChip08);

    // After toggle, UI has: Tue (booked, still visible)

    // Save: GET returns both (Mon available, Tue booked)
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          apiSlot(fmt(monday), '08:00', '09:00', 'available', 'existing-mon'),
          apiSlot(fmt(tuesday), '11:00', '12:00', 'booked', 'existing-tue'),
        ],
      })
    );
    // DELETE existing-mon (removed from UI)
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { success: true }));
    // Re-fetch after save: only Tue remains (booked, NOT deleted)
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [apiSlot(fmt(tuesday), '11:00', '12:00', 'booked', 'existing-tue')],
      })
    );

    fireEvent.click(screen.getByText('Speichern'));

    // Tue was NOT deleted (it's still in UI), Mon was deleted
    await waitFor(() => {
      expectText('1 bereits vorhanden', '1 gelöscht');
      expect(document.body.textContent).not.toMatch(/Fehler/);
    });

    // DELETE was NOT called for the booked Tue slot (it stays in UI)
    const deleteCalls = mockApiFetch.mock.calls.filter(
      (call: unknown[]) => (call[1] as Record<string, unknown>)?.method === 'DELETE'
    );
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0][0]).toBe('/api/trainer/availability/existing-mon');
  });

  it('shows "Auf alle Wochen im Monat anwenden" button when slots exist', async () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [apiSlot(fmt(monday), '08:00', '09:00', 'available', 'existing-1')],
      })
    );

    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Auf alle Wochen im Monat anwenden')).toBeInTheDocument();
    });

    // Button is enabled when slots exist
    const btn = screen.getByText('Auf alle Wochen im Monat anwenden');
    expect(btn.closest('button')).not.toBeDisabled();
  });

  it('apply-to-month button is disabled when no slots configured', async () => {
    mockEmptySlots();
    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Keine Verfügbarkeiten eingetragen')).toBeInTheDocument();
    });

    const btn = screen.getByText('Auf alle Wochen im Monat anwenden');
    expect(btn.closest('button')).toBeDisabled();
  });

  it('clicking "Nächste Woche" changes the displayed week range and triggers a new fetch', async () => {
    // Mount: current week, returns empty
    mockEmptySlots();
    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Keine Verfügbarkeiten eingetragen')).toBeInTheDocument();
    });

    // Capture the initial URL
    const firstCall = mockApiFetch.mock.calls[0][0] as string;
    expect(firstCall).toContain('from=');
    expect(firstCall).toContain('&to=');

    // Mock next week fetch (also empty)
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));

    // Click next week button — find by title attribute
    const nextWeekBtn = screen.getByTitle('Nächste Woche');
    fireEvent.click(nextWeekBtn);

    // Component fetches with new week range
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });

    const secondCall = mockApiFetch.mock.calls[1][0] as string;
    expect(secondCall).toContain('from=');
    expect(secondCall).toContain('&to=');
    // The from/to params differ from the first call (week shifted by 7 days)
    expect(secondCall).not.toBe(firstCall);
  });

  it('clicking "Vorherige Woche" then "Heute" returns to the current week', async () => {
    // Mount: current week
    mockEmptySlots();
    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Keine Verfügbarkeiten eingetragen')).toBeInTheDocument();
    });

    const initialUrl = mockApiFetch.mock.calls[0][0] as string;

    // Step 1: Go to previous week
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    const prevWeekBtn = screen.getByTitle('Vorherige Woche');
    fireEvent.click(prevWeekBtn);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });

    // Step 2: Click "Heute"
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    const heuteBtn = screen.getByText('Heute');
    fireEvent.click(heuteBtn);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(3);
    });

    // Third call should return to the original current week
    const thirdUrl = mockApiFetch.mock.calls[2][0] as string;
    expect(thirdUrl).toBe(initialUrl);
  });

  it('"Heute" button is disabled when already on current week', async () => {
    mockEmptySlots();
    render(<TrainerAvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText('Keine Verfügbarkeiten eingetragen')).toBeInTheDocument();
    });

    const heuteBtn = screen.getByText('Heute');
    expect(heuteBtn.closest('button')).toBeDisabled();
  });
});
