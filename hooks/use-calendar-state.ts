import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  format,
  parseISO,
  isValid as isValidDate,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  subDays,
} from 'date-fns';

export type ViewMode = 'agenda' | 'weekly' | 'daily' | 'list' | 'month' | 'matrix';

const VIEW_MODES: ViewMode[] = ['agenda', 'weekly', 'daily', 'list', 'month', 'matrix'];

export function isViewMode(value: string | null): value is ViewMode {
  return !!value && (VIEW_MODES as string[]).includes(value);
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValidDate(parsed) ? parsed : null;
}

/**
 * Ansichts-/Datums-/Platz-Zustand des Platzkalenders + URL-Synchronisation
 * (Phase 1: eine geteilte Kalender-URL zeigt beim Empfänger dieselbe
 * Ansicht — die URL gewinnt immer gegenüber `defaultView`).
 *
 * Eigene Parameter-Namen (`calView` statt `view`): `places-hub-tabs.tsx`
 * bettet den Kalender in einen Tab ein, der bereits `?view=calendar|manage`
 * für die Tab-Auswahl benutzt — ein gemeinsamer Name würde sich überschreiben.
 */
export function useCalendarState({
  defaultView,
  isMobile,
  isAdmin,
  isTrainer,
  rolesLoading,
}: {
  defaultView?: ViewMode;
  isMobile: boolean;
  isAdmin: boolean;
  isTrainer: boolean;
  rolesLoading: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlView = searchParams.get('calView');
  const urlDate = parseDateParam(searchParams.get('calDate'));

  const [viewMode, setViewMode] = useState<ViewMode>(
    isViewMode(urlView) ? urlView : (defaultView ?? 'agenda')
  );
  const [currentWeek, setCurrentWeek] = useState(urlDate ?? new Date());
  const [selectedDate, setSelectedDate] = useState(urlDate ?? new Date());
  const [mobileSelectedDay, setMobileSelectedDay] = useState(urlDate ?? new Date());
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(
    searchParams.get('calCourt')
  );

  // Mehrfach-Platzfilter (Admin/Trainer); null = Standard (alle bzw. die ersten 4)
  const [visibleCourtIds, setVisibleCourtIds] = useState<string[] | null>(
    searchParams.get('calCourts')?.split(',').filter(Boolean) ?? null
  );

  // Rollen-Vorgabe (Mitglied → agenda, Trainer/Admin → weekly) nachziehen, sobald
  // die Rollen geladen sind — nur wenn weder die URL noch der Aufrufer
  // (`defaultView`-Prop) schon etwas vorgegeben haben.
  const roleViewAppliedRef = useRef(false);
  useEffect(() => {
    if (roleViewAppliedRef.current || rolesLoading) return;
    roleViewAppliedRef.current = true;
    if (isViewMode(urlView) || defaultView !== undefined) return; // URL/Aufrufer gewinnt
    if (isAdmin || isTrainer) setViewMode('weekly');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesLoading, isAdmin, isTrainer]);

  // ── Kalender-Zustand zurück in die URL schreiben ──
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('calView', viewMode);
    params.set('calDate', format(viewMode === 'weekly' ? currentWeek : selectedDate, 'yyyy-MM-dd'));
    if (selectedCourtId) params.set('calCourt', selectedCourtId);
    else params.delete('calCourt');
    if (visibleCourtIds) params.set('calCourts', visibleCourtIds.join(','));
    else params.delete('calCourts');
    const next = `${pathname}?${params.toString()}`;
    if (next !== `${pathname}?${searchParams.toString()}`) {
      router.replace(next, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, currentWeek, selectedDate, selectedCourtId, visibleCourtIds, pathname]);

  // ── Sync mobile selected day when week changes ──
  useEffect(() => {
    if (isMobile && viewMode === 'weekly') {
      const weekMonday = startOfWeek(currentWeek, { weekStartsOn: 1 });
      // Preserve day-of-week offset so navigating weeks keeps the same weekday
      const dayOffset = Math.min(
        mobileSelectedDay.getDay() === 0 ? 6 : mobileSelectedDay.getDay() - 1,
        6
      );
      setMobileSelectedDay(addDays(weekMonday, dayOffset));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek, isMobile, viewMode]);

  // ── Week calculations ──
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const goToPrevious = () => {
    if (viewMode === 'weekly') setCurrentWeek(subWeeks(currentWeek, 1));
    else if (viewMode === 'month') setSelectedDate(subMonths(selectedDate, 1));
    else setSelectedDate(subDays(selectedDate, 1));
  };
  const goToNext = () => {
    if (viewMode === 'weekly') setCurrentWeek(addWeeks(currentWeek, 1));
    else if (viewMode === 'month') setSelectedDate(addMonths(selectedDate, 1));
    else setSelectedDate(addDays(selectedDate, 1));
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentWeek(today);
    setSelectedDate(today);
    setMobileSelectedDay(today);
  };

  return {
    viewMode,
    setViewMode,
    currentWeek,
    setCurrentWeek,
    selectedDate,
    setSelectedDate,
    mobileSelectedDay,
    setMobileSelectedDay,
    selectedCourtId,
    setSelectedCourtId,
    visibleCourtIds,
    setVisibleCourtIds,
    weekStart,
    weekEnd,
    weekDays,
    goToPrevious,
    goToNext,
    goToToday,
  };
}
