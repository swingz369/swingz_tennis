'use client';

import { useState } from 'react';
import { AdvancedSearch } from '@/components/search/advanced-search';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, User, Calendar, MapPin } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-fetch';

interface SearchResult {
  id: string;
  type: 'member' | 'booking' | 'trainer' | 'club';
  title: string;
  subtitle?: string;
  url: string;
  relevance: number;
}

export default function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (query: string, _filters: any) => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({ q: query, limit: '20' });
      const response = await apiFetch(`/api/search?${params}`);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: SearchResult[] = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
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
      case 'member':
        return User;
      case 'booking':
        return Calendar;
      case 'trainer':
        return User;
      case 'club':
        return MapPin;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'member':
        return 'Mitglied';
      case 'booking':
        return 'Buchung';
      case 'trainer':
        return 'Trainer';
      case 'club':
        return 'Verein';
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
