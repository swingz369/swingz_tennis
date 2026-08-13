'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Users,
  GraduationCap,
  Calendar,
  Building2,
  SlidersHorizontal,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { apiFetch } from '@/lib/api-fetch';
import { useSearchDialog } from '@/components/command-palette-context';

interface SearchResult {
  id: string;
  type: 'member' | 'booking' | 'trainer' | 'club';
  title: string;
  subtitle?: string;
  url: string;
}

const TYPE_ORDER = [
  { type: 'member', label: 'Mitglieder', icon: Users },
  { type: 'trainer', label: 'Trainer', icon: GraduationCap },
  { type: 'booking', label: 'Buchungen', icon: Calendar },
  { type: 'club', label: 'Vereine', icon: Building2 },
] as const;

/**
 * Fokussierte Suche — öffnet über das Lupen-Icon im Header und zeigt **nur**
 * Suchergebnisse (keine Aktionen, keine Navigation, keine Theme-Wechsel).
 * Die Command Palette (⌘K) bleibt separat für Navigation/Aktionen/Themes.
 */
export function SearchDialog() {
  const { open, setOpen } = useSearchDialog();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Frischer Zustand bei jedem Öffnen.
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  // Debounced Server-Suche (ab 2 Zeichen).
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data.slice(0, 8) : []);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const hasQuery = query.trim().length >= 2;

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Suche" shouldFilter={false}>
      <CommandInput
        placeholder="Mitglieder, Trainer, Buchungen oder Vereine suchen…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!hasQuery ? (
          <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
            <Search className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Mitglieder, Trainer, Buchungen und Vereine durchsuchen
            </p>
            <p className="text-xs text-muted-foreground/70">Mindestens 2 Zeichen eingeben</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Suche…
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Keine Ergebnisse für „{query.trim()}“</p>
          </div>
        ) : (
          TYPE_ORDER.map(({ type, label, icon: Icon }) => {
            const group = results.filter((r) => r.type === type);
            if (group.length === 0) return null;
            return (
              <CommandGroup key={type} heading={label}>
                {group.map((result) => (
                  <CommandItem
                    key={`${type}-${result.id}`}
                    onSelect={() => navigate(result.url)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{result.title}</span>
                      {result.subtitle && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })
        )}
      </CommandList>

      {/* Footer: Sprung zur erweiterten Suche (Filter) */}
      <button
        type="button"
        onClick={() => navigate('/search')}
        className="flex items-center gap-2 border-t px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="flex-1 text-left">Erweiterte Suche mit Filtern</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </CommandDialog>
  );
}
