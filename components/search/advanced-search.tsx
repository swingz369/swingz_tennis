'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, X, Calendar, User, MapPin, CreditCard } from 'lucide-react';

interface AdvancedSearchFilters {
  type?: 'all' | 'members' | 'sessions' | 'bookings' | 'invoices' | 'courts';
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'relevance' | 'date' | 'name';
  sortOrder?: 'asc' | 'desc';
}

interface AdvancedSearchProps {
  onSearch?: (query: string, filters: AdvancedSearchFilters) => void;
  onClearFilters?: () => void;
}

/**
 * Nur was tatsächlich gebunden ist: Cmd/Ctrl+K in components/command-palette.tsx,
 * der Rest in hooks/use-keyboard-shortcuts.ts. Der frühere Shortcut-Dialog listete
 * zusätzlich "/" und Cmd+Shift+N — beides war nirgends im Code verdrahtet.
 */
const KEYBOARD_SHORTCUTS = [
  { keys: 'Cmd/Ctrl+K', description: 'Schnellsuche öffnen' },
  { keys: 'Cmd/Ctrl+D', description: 'Dashboard öffnen' },
  { keys: 'Cmd/Ctrl+B', description: 'Buchungen öffnen' },
  { keys: 'Cmd/Ctrl+M', description: 'Mitglieder öffnen' },
  { keys: 'Cmd/Ctrl+S', description: 'Einstellungen öffnen' },
  { keys: 'Esc', description: 'Dialog schließen' },
];

export function AdvancedSearch({ onSearch, onClearFilters }: AdvancedSearchProps) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AdvancedSearchFilters>({
    type: 'all',
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  const handleSearch = () => {
    onSearch?.(query, filters);
  };

  const handleClearFilters = () => {
    setFilters({
      type: 'all',
      sortBy: 'relevance' as const,
      sortOrder: 'desc' as const,
    });
    setQuery('');
    onClearFilters?.();
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v && v !== 'all' && v !== 'relevance' && v !== 'desc'
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Erweiterte Suche</CardTitle>
            <CardDescription>Durchsuche alle Daten mit erweiterten Filtern</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Mitgliedern, Buchungen, Rechnungen..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
              aria-label="Suchbegriff"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Suche löschen"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} className="gap-2">
            <Search className="h-4 w-4" />
            Suchen
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="space-y-4 p-4 border rounded-xl bg-muted/50">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Type Filter */}
              <div className="space-y-2">
                <label htmlFor="search-type" className="text-sm font-medium">
                  Typ
                </label>
                <Select
                  value={filters.type}
                  onValueChange={(value) =>
                    setFilters({ ...filters, type: value as AdvancedSearchFilters['type'] })
                  }
                >
                  <SelectTrigger id="search-type" aria-label="Typ auswählen">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="members">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Mitglieder
                      </div>
                    </SelectItem>
                    <SelectItem value="sessions">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Sessions
                      </div>
                    </SelectItem>
                    <SelectItem value="bookings">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Buchungen
                      </div>
                    </SelectItem>
                    <SelectItem value="invoices">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Rechnungen
                      </div>
                    </SelectItem>
                    <SelectItem value="courts">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Plätze
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <label htmlFor="search-status" className="text-sm font-medium">
                  Status
                </label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters({ ...filters, status: value })}
                >
                  <SelectTrigger id="search-status" aria-label="Status auswählen">
                    <SelectValue placeholder="Alle Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="pending">Ausstehend</SelectItem>
                    <SelectItem value="confirmed">Bestätigt</SelectItem>
                    <SelectItem value="cancelled">Storniert</SelectItem>
                    <SelectItem value="completed">Abgeschlossen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div className="space-y-2">
                <label htmlFor="search-sort" className="text-sm font-medium">
                  Sortieren nach
                </label>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) =>
                    setFilters({ ...filters, sortBy: value as AdvancedSearchFilters['sortBy'] })
                  }
                >
                  <SelectTrigger id="search-sort" aria-label="Sortierung auswählen">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevanz</SelectItem>
                    <SelectItem value="date">Datum</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div className="space-y-2">
                <label htmlFor="search-date-from" className="text-sm font-medium">
                  Datum von
                </label>
                <Input
                  id="search-date-from"
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  aria-label="Startdatum"
                />
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <label htmlFor="search-date-to" className="text-sm font-medium">
                  Datum bis
                </label>
                <Input
                  id="search-date-to"
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  aria-label="Enddatum"
                />
              </div>

              {/* Sort Order */}
              <div className="space-y-2">
                <label htmlFor="search-order" className="text-sm font-medium">
                  Reihenfolge
                </label>
                <Select
                  value={filters.sortOrder}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      sortOrder: value as AdvancedSearchFilters['sortOrder'],
                    })
                  }
                >
                  <SelectTrigger id="search-order" aria-label="Sortierreihenfolge">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Absteigend</SelectItem>
                    <SelectItem value="asc">Aufsteigend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                {activeFilterCount > 0 && (
                  <Badge variant="secondary">{activeFilterCount} aktive Filter</Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="gap-2">
                <X className="h-4 w-4" />
                Filter zurücksetzen
              </Button>
            </div>
          </div>
        )}

        {/* Search Tips */}
        <div className="text-xs text-muted-foreground">
          <strong>Tipp:</strong> Nutze &quot;&quot; für exakte Phrasensuche, z.B. &quot;Max
          Mustermann&quot;
        </div>

        {/* Tastenkürzel — früher hinter einem schwebenden Button unten rechts, der auf
            jeder Seite im Weg lag. Hier sucht man ohnehin nach dem schnellen Weg. */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Tastenkürzel
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {KEYBOARD_SHORTCUTS.map((s) => (
              <div key={s.keys} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{s.description}</span>
                <span className="flex gap-1 shrink-0">
                  {s.keys.split('+').map((k) => (
                    <Badge
                      key={k}
                      variant="outline"
                      className="min-w-[32px] justify-center font-mono text-xs"
                    >
                      {k}
                    </Badge>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
