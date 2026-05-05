'use client';

import { useState } from 'react';
import { AdvancedSearch } from '@/components/search/advanced-search';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, User, Calendar, MapPin, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface SearchResult {
  id: string;
  type: 'members' | 'sessions' | 'bookings' | 'invoices' | 'courts';
  title: string;
  subtitle?: string;
  status?: string;
  url: string;
}

export default function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (query: string, _filters: any) => {
    setLoading(true);
    setSearched(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock results
      const mockResults: SearchResult[] = [
        {
          id: '1',
          type: 'members',
          title: 'Max Mustermann',
          subtitle: 'max.mustermann@example.com',
          status: 'active',
          url: '/members/1',
        },
        {
          id: '2',
          type: 'bookings',
          title: 'Gruppen-Training Fortgeschritten',
          subtitle: '07.05.2026, 18:00 Uhr',
          status: 'confirmed',
          url: '/bookings/2',
        },
        {
          id: '3',
          type: 'invoices',
          title: 'Rechnung #INV-2026-001',
          subtitle: '€45.00 · Fällig: 15.05.2026',
          status: 'pending',
          url: '/billing',
        },
      ];

      setResults(query ? mockResults : []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setResults([]);
    setSearched(false);
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'members':
        return User;
      case 'sessions':
      case 'bookings':
        return Calendar;
      case 'invoices':
        return CreditCard;
      case 'courts':
        return MapPin;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'members':
        return 'Mitglied';
      case 'sessions':
        return 'Session';
      case 'bookings':
        return 'Buchung';
      case 'invoices':
        return 'Rechnung';
      case 'courts':
        return 'Platz';
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;

    switch (status) {
      case 'active':
      case 'confirmed':
        return <Badge variant="success">Aktiv</Badge>;
      case 'pending':
        return <Badge variant="warning">Ausstehend</Badge>;
      case 'cancelled':
        return <Badge variant="error">Storniert</Badge>;
      case 'completed':
        return <Badge variant="secondary">Abgeschlossen</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Suche</h1>
        <p className="text-muted-foreground mt-2">
          Durchsuche alle Daten mit erweiterten Filtern und Sortieroptionen
        </p>
      </div>

      <AdvancedSearch onSearch={handleSearch} onClearFilters={handleClearFilters} />

      {/* Results */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Suche läuft...
          </CardContent>
        </Card>
      ) : searched && results.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={Search}
              title="Keine Ergebnisse"
              description="Versuche andere Suchbegriffe oder passe die Filter an."
              action={{
                label: 'Filter zurücksetzen',
                onClick: handleClearFilters,
              }}
            />
          </CardContent>
        </Card>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {results.length} Ergebnis{results.length !== 1 && 'se'} gefunden
            </p>
          </div>

          <div className="space-y-2">
            {results.map((result) => {
              const Icon = getTypeIcon(result.type);
              return (
                <Card key={result.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <Link href={result.url} className="block">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 rounded-lg bg-muted">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{result.title}</h3>
                              {getStatusBadge(result.status)}
                            </div>
                            {result.subtitle && (
                              <p className="text-sm text-muted-foreground">{result.subtitle}</p>
                            )}
                            <Badge variant="outline" className="mt-2">
                              {getTypeLabel(result.type)}
                            </Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          Details →
                        </Button>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
