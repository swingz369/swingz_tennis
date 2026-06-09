'use client';

import { useState, useCallback, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from '@/lib/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  User,
  AlertTriangle,
  Ban,
  CheckCircle,
  Eye,
  ArrowUpDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-fetch';
import { useCourts } from '@/hooks/use-courts';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AdminBooking {
  id: string;
  source: 'booking' | 'season_plan';
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'scheduled';
  session_start_time: string | null;
  start_time: string | null;
  end_time: string | null;
  payment_status: string | null;
  notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  booked_at: string | null;
  court_name: string;
  court_surface: string | null;
  court_number: number | null;
  session_id: string | null;
  session_type: string;
  session_notes: string | null;
  session_trainer_id: string | null;
  session_max_participants: number | null;
  member_name: string;
  member_email: string;
  member_id: string;
  trainer_name: string | null;
  group_ids: string[] | null;
  week_number: number | null;
}

interface BookingsResponse {
  bookings: AdminBooking[];
  total: number;
  filtered: number;
  seasonPlanCount?: number;
}

type SourceFilter = 'all' | 'booking' | 'season_plan';
type SortField = 'session_start_time' | 'status' | 'member_name' | 'court_name';
type SortDir = 'asc' | 'desc';

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: 'success' | 'warning' | 'error' | 'secondary' | 'default';
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  confirmed: { label: 'Bestätigt', variant: 'success', icon: CheckCircle },
  pending: { label: 'Ausstehend', variant: 'warning', icon: Clock },
  cancelled: { label: 'Storniert', variant: 'secondary', icon: X },
  no_show: { label: 'Nicht erschienen', variant: 'error', icon: AlertTriangle },
  scheduled: { label: 'Geplant', variant: 'default', icon: CalendarIcon },
};

const SOURCE_CONFIG: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'error' | 'secondary' | 'default' }
> = {
  booking: { label: 'Buchung', variant: 'secondary' },
  season_plan: { label: 'Saison-Training', variant: 'default' },
};

// ─── Component ─────────────────────────────────────────────────────────────────

interface CourtBookingsListProps {
  clubId: string;
  isAdmin: boolean;
}

export default function CourtBookingsList({ clubId, isAdmin }: CourtBookingsListProps) {
  const queryClient = useQueryClient();
  const { data: courts = [] } = useCourts(clubId);

  // ── Filter state ──
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [courtFilter, setCourtFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ── Sort state ──
  const [sortField, setSortField] = useState<SortField>('session_start_time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Pagination ──
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // ── Detail dialog ──
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Debounce search ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Fetch bookings ──
  // Use a high limit since we merge season plan sessions client-side
  const fetchLimit = 1000;
  const params = new URLSearchParams();
  params.set('clubId', clubId);
  params.set('limit', String(fetchLimit));
  params.set('offset', '0');
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (courtFilter !== 'all') params.set('courtId', courtFilter);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data, isLoading, isFetching, error } = useQuery<BookingsResponse>({
    queryKey: [
      'admin-bookings',
      clubId,
      statusFilter,
      sourceFilter,
      courtFilter,
      dateFrom,
      dateTo,
      debouncedSearch,
    ],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/bookings?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load bookings');
      }
      return res.json();
    },
    enabled: !!clubId && isAdmin,
    staleTime: 15_000,
  });

  // ── Client-side filter + sort + paginate ──
  const filteredBookings = (data?.bookings ?? [])
    .filter((b) => {
      if (sourceFilter === 'all') return true;
      return b.source === sourceFilter;
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'session_start_time') {
        const aTime = a.session_start_time || '';
        const bTime = b.session_start_time || '';
        return mul * aTime.localeCompare(bTime);
      }
      if (sortField === 'status') {
        return mul * (a.status || '').localeCompare(b.status || '');
      }
      if (sortField === 'member_name') {
        const aName = a.trainer_name || a.member_name || '';
        const bName = b.trainer_name || b.member_name || '';
        return mul * aName.localeCompare(bName);
      }
      if (sortField === 'court_name') {
        return mul * (a.court_name || '').localeCompare(b.court_name || '');
      }
      return 0;
    });
  const totalFiltered = filteredBookings.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  // Client-side pagination for the merged list
  const bookings = filteredBookings.slice(page * pageSize, (page + 1) * pageSize);

  // ── Sort toggle ──
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      className={`h-3.5 w-3.5 ml-1 inline-block transition-colors ${
        sortField === field ? 'text-brandPrimary' : 'text-muted-foreground/40'
      }`}
    />
  );

  // ── Admin action ──
  const handleAdminAction = useCallback(
    async (bookingId: string, action: 'cancel' | 'no_show' | 'confirm', reason?: string) => {
      setActionLoading(true);
      try {
        const res = await apiFetch('/api/admin/bookings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId, action, reason }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Aktion fehlgeschlagen');
        }
        const labels: Record<string, string> = {
          cancel: 'Buchung storniert',
          no_show: 'Als nicht erschienen markiert',
          confirm: 'Buchung bestätigt',
        };
        toast.success(labels[action] || 'Aktion erfolgreich');
        setSelectedBooking(null);
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : String(err) || 'Fehler');
      } finally {
        setActionLoading(false);
      }
    },
    [queryClient]
  );

  // ── Render ──
  return (
    <div className="space-y-4 animate-in">
      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <Card variant="flat">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Mitglied oder Platz suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Date from */}
            <div className="flex items-center gap-1.5">
              <Label className="text-xs whitespace-nowrap">Von</Label>
              <Input
                type="date"
                className="w-36 h-9 text-xs"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
              />
            </div>

            {/* Date to */}
            <div className="flex items-center gap-1.5">
              <Label className="text-xs whitespace-nowrap">Bis</Label>
              <Input
                type="date"
                className="w-36 h-9 text-xs"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
              />
            </div>

            {/* Court filter */}
            <Select
              value={courtFilter}
              onValueChange={(v) => {
                setCourtFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40 h-9 text-xs">
                <SelectValue placeholder="Alle Plätze" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Plätze</SelectItem>
                {courts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Source filter */}
            <Select
              value={sourceFilter}
              onValueChange={(v: SourceFilter) => {
                setSourceFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40 h-9 text-xs">
                <SelectValue placeholder="Alle Einträge" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Einträge</SelectItem>
                <SelectItem value="booking">Platzbuchungen</SelectItem>
                <SelectItem value="season_plan">Saison-Training</SelectItem>
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue placeholder="Alle Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="confirmed">Bestätigt</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="cancelled">Storniert</SelectItem>
                <SelectItem value="no_show">Nicht erschienen</SelectItem>
                <SelectItem value="scheduled">Geplant</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear filters */}
            {(statusFilter !== 'all' ||
              sourceFilter !== 'all' ||
              courtFilter !== 'all' ||
              dateFrom ||
              dateTo ||
              searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setSourceFilter('all');
                  setCourtFilter('all');
                  setDateFrom('');
                  setDateTo('');
                  setSearchQuery('');
                  setDebouncedSearch('');
                  setPage(0);
                }}
                className="gap-1 text-xs"
              >
                <X className="h-3.5 w-3.5" />
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <Card variant="bordered" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th
                  className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                  onClick={() => toggleSort('session_start_time')}
                >
                  Datum / Zeit <SortIcon field="session_start_time" />
                </th>
                <th
                  className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                  onClick={() => toggleSort('member_name')}
                >
                  Mitglied <SortIcon field="member_name" />
                </th>
                <th
                  className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                  onClick={() => toggleSort('court_name')}
                >
                  Platz <SortIcon field="court_name" />
                </th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Herkunft
                </th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Typ
                </th>
                <th
                  className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                  onClick={() => toggleSort('status')}
                >
                  Status <SortIcon field="status" />
                </th>
                <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="p-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-red-500" />
                    <p>Fehler beim Laden der Buchungen</p>
                    <p className="text-xs mt-1">{(error as Error).message}</p>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <CalendarIcon className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Keine Einträge gefunden</p>
                    <p className="text-xs mt-1">
                      {searchQuery ||
                      statusFilter !== 'all' ||
                      sourceFilter !== 'all' ||
                      courtFilter !== 'all' ||
                      dateFrom ||
                      dateTo
                        ? 'Passe die Filter an, um Ergebnisse zu sehen.'
                        : 'Es liegen noch keine Einträge vor.'}
                    </p>
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const isSeasonPlan = booking.source === 'season_plan';
                  const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  const sourceCfg = SOURCE_CONFIG[booking.source] || SOURCE_CONFIG.booking;
                  const sessionTypeLabel =
                    booking.session_type === 'walk_in'
                      ? 'Walk-in'
                      : booking.session_type === 'event'
                        ? 'Event'
                        : booking.session_type === 'maintenance'
                          ? 'Wartung'
                          : 'Training';

                  return (
                    <tr
                      key={`${booking.source}-${booking.id}`}
                      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div>
                            <div className="font-medium">
                              {booking.session_start_time
                                ? format(parseISO(booking.session_start_time), 'dd.MM.yyyy', {
                                    locale: de,
                                  })
                                : '—'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {booking.start_time || '—'}
                              {booking.end_time ? ` – ${booking.end_time}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {isSeasonPlan ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <User className="h-3.5 w-3.5 text-amber-600" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">
                                {booking.trainer_name || '—'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {booking.week_number != null
                                  ? `KW ${booking.week_number}`
                                  : 'Trainer'}
                                {booking.group_ids && booking.group_ids.length > 0
                                  ? ` · ${booking.group_ids.length} Gruppe(n)`
                                  : ''}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-brandPrimary/10 flex items-center justify-center flex-shrink-0">
                              <User className="h-3.5 w-3.5 text-brandPrimary" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{booking.member_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {booking.member_email}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span>{booking.court_name}</span>
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <Badge variant={sourceCfg.variant} size="sm">
                          {sourceCfg.label}
                        </Badge>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <Badge variant="secondary" size="sm">
                          {sessionTypeLabel}
                        </Badge>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <Badge variant={statusCfg.variant} size="sm" className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Details anzeigen"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        {totalFiltered > 0 && (
          <div className="flex items-center justify-between p-3 border-t border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">
              {isFetching ? (
                <span className="inline-flex items-center gap-1">
                  <span className="animate-pulse">Lädt...</span>
                </span>
              ) : (
                <>
                  Zeige {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalFiltered)} von{' '}
                  {totalFiltered} Einträgen
                </>
              )}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs px-2 tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Detail Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-brandPrimary" />
                  Buchungsdetails
                </DialogTitle>
                <DialogDescription>
                  {selectedBooking.session_start_time
                    ? format(parseISO(selectedBooking.session_start_time), 'EEEE, dd. MMMM yyyy', {
                        locale: de,
                      })
                    : 'Kein Datum'}
                  {selectedBooking.start_time && ` · ${selectedBooking.start_time}`}
                  {selectedBooking.end_time && ` – ${selectedBooking.end_time}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Member / Trainer */}
                {selectedBooking.source === 'season_plan' ? (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                    <User className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{selectedBooking.trainer_name || '—'}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedBooking.week_number != null
                          ? `KW ${selectedBooking.week_number}`
                          : 'Trainer'}
                        {selectedBooking.group_ids && selectedBooking.group_ids.length > 0
                          ? ` · ${selectedBooking.group_ids.length} Gruppe(n)`
                          : ''}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <User className="h-5 w-5 text-brandPrimary mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{selectedBooking.member_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedBooking.member_email}
                      </div>
                    </div>
                  </div>
                )}

                {/* Court + Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium">{selectedBooking.court_name}</div>
                      {selectedBooking.court_surface && (
                        <div className="text-xs text-muted-foreground capitalize">
                          {selectedBooking.court_surface === 'clay'
                            ? 'Sand'
                            : selectedBooking.court_surface === 'hard'
                              ? 'Hartplatz'
                              : selectedBooking.court_surface === 'grass'
                                ? 'Rasen'
                                : selectedBooking.court_surface}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium">
                        {selectedBooking.session_type === 'walk_in'
                          ? 'Walk-in'
                          : selectedBooking.session_type === 'event'
                            ? 'Event'
                            : selectedBooking.session_type === 'maintenance'
                              ? 'Wartung'
                              : 'Training'}
                      </div>
                      {selectedBooking.session_max_participants && (
                        <div className="text-xs text-muted-foreground">
                          Max. {selectedBooking.session_max_participants} TN
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Herkunft */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Herkunft</span>
                  <Badge
                    variant={SOURCE_CONFIG[selectedBooking.source]?.variant || 'secondary'}
                    size="md"
                  >
                    {SOURCE_CONFIG[selectedBooking.source]?.label || selectedBooking.source}
                  </Badge>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {(() => {
                    const cfg = STATUS_CONFIG[selectedBooking.status] || STATUS_CONFIG.pending;
                    const Icon = cfg.icon;
                    return (
                      <Badge variant={cfg.variant} size="md" className="gap-1">
                        <Icon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </Badge>
                    );
                  })()}
                </div>

                {/* Booked at */}
                {selectedBooking.booked_at && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">Gebucht am</span>
                    <span className="text-sm font-medium">
                      {format(parseISO(selectedBooking.booked_at), 'dd.MM.yyyy HH:mm', {
                        locale: de,
                      })}
                    </span>
                  </div>
                )}

                {/* Payment */}
                {selectedBooking.payment_status && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">Zahlung</span>
                    <Badge
                      variant={
                        selectedBooking.payment_status === 'paid'
                          ? 'success'
                          : selectedBooking.payment_status === 'unpaid'
                            ? 'warning'
                            : 'secondary'
                      }
                      size="md"
                    >
                      {selectedBooking.payment_status === 'paid'
                        ? 'Bezahlt'
                        : selectedBooking.payment_status === 'unpaid'
                          ? 'Offen'
                          : selectedBooking.payment_status === 'refunded'
                            ? 'Erstattet'
                            : selectedBooking.payment_status}
                    </Badge>
                  </div>
                )}

                {/* Notes */}
                {selectedBooking.notes && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Notizen</div>
                    <div className="text-sm">{selectedBooking.notes}</div>
                  </div>
                )}

                {/* Cancellation info */}
                {selectedBooking.status === 'cancelled' && selectedBooking.cancelled_at && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <div className="font-medium">
                      Storniert am{' '}
                      {format(parseISO(selectedBooking.cancelled_at), 'dd.MM.yyyy HH:mm', {
                        locale: de,
                      })}
                    </div>
                    {selectedBooking.cancellation_reason && (
                      <div className="text-xs mt-1">
                        Grund: {selectedBooking.cancellation_reason}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Admin Actions ──────────────────────────────────────────── */}
              {isAdmin &&
                selectedBooking.source === 'booking' &&
                selectedBooking.status !== 'cancelled' && (
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    {selectedBooking.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdminAction(selectedBooking.id, 'confirm')}
                        disabled={actionLoading}
                        className="gap-1.5"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Bestätigen
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAdminAction(selectedBooking.id, 'no_show')}
                      disabled={actionLoading}
                      className="gap-1.5 text-amber-600 hover:text-amber-700"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Nicht erschienen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleAdminAction(selectedBooking.id, 'cancel', 'admin_cancellation')
                      }
                      disabled={actionLoading}
                      className="gap-1.5 text-red-600 hover:text-red-700"
                    >
                      <Ban className="h-4 w-4" />
                      Stornieren
                    </Button>
                  </DialogFooter>
                )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
