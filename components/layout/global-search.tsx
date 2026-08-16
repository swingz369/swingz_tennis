'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  Users,
  GraduationCap,
  Calendar,
  Building2,
  Loader2,
  CornerDownLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-fetch';
import { createLogger } from '@/lib/logger';

const log = createLogger('layout:global-search');

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

const TYPE_META = new Map(TYPE_ORDER.map((t) => [t.type, t]));

interface GlobalSearchProps {
  className?: string;
}

/**
 * Globale Suche als Dropdown direkt im Header — Tippen im Feld, Ergebnisse
 * klappen darunter auf. Vorher öffnete ein Klick auf das Feld einen modalen
 * Dialog (`SearchDialog`): der legte sich über die Seite, aus der man gerade
 * heraus sucht, und riss den Kontext weg. Der Dialog bleibt für Mobile, wo ein
 * Overlay die richtige Form ist.
 *
 * Umgesetzt als ARIA-Combobox (Feld + Listbox), damit Pfeiltasten, Enter, Esc
 * und Screenreader dasselbe Modell sehen wie die Maus.
 */
export function GlobalSearch({ className }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;

  // Ergebnisse nach Typ gruppiert, aber als flache Liste durchnummeriert —
  // die Tastatursteuerung braucht einen einzigen linearen Index.
  const grouped = useMemo(() => {
    const out: Array<{
      label: string;
      icon: (typeof TYPE_ORDER)[number]['icon'];
      items: SearchResult[];
    }> = [];
    for (const { type, label, icon } of TYPE_ORDER) {
      const items = results.filter((r) => r.type === type);
      if (items.length > 0) out.push({ label, icon, items });
    }
    return out;
  }, [results]);

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Debounced Server-Suche (ab 2 Zeichen), identischer Vertrag wie SearchDialog.
  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = res.ok ? await res.json() : [];
        setResults(Array.isArray(data) ? data.slice(0, 8) : []);
        setActiveIndex(0);
      } catch (e) {
        if (!controller.signal.aborted) {
          log.error('Suche fehlgeschlagen', e instanceof Error ? e : undefined);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [trimmed]);

  // Klick außerhalb schließt das Dropdown — der Suchbegriff bleibt stehen,
  // damit ein versehentlicher Klick die Eingabe nicht wegwirft.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // ⌘K / Strg+K fokussiert das Feld, statt (wie früher) nur ein leeres
  // Dropdown aufzuklappen, in dem niemand tippt.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Aktive Zeile in den sichtbaren Bereich scrollen.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const navigate = useCallback(
    (url: string) => {
      setOpen(false);
      setQuery('');
      router.push(url);
    },
    [router]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || flat.length === 0) {
      if (e.key === 'ArrowDown' && flat.length > 0) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = flat[activeIndex];
      if (hit) navigate(hit.url);
    }
  };

  const showPanel = open && hasQuery;
  let runningIndex = -1;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="global-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            showPanel && flat[activeIndex] ? `global-search-option-${activeIndex}` : undefined
          }
          aria-label="Mitglieder, Trainer, Buchungen und Vereine durchsuchen"
          placeholder="Mitglied, Platz, Rechnung …"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            'w-full rounded-xl border border-border bg-card py-2 pl-9 text-sm text-foreground',
            'placeholder:text-muted-foreground transition-colors',
            'hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            // Platz rechts für den Zurücksetzen-Knopf.
            'pr-9 [&::-webkit-search-cancel-button]:hidden'
          )}
        />
        {/* Kein ⌘K-Badge mehr: Das Feld ist sichtbar und direkt tippbar, der
            Hinweis war reine Dekoration — und auf Windows/Linux mit dem
            ⌘-Zeichen sogar falsch. Das Kürzel selbst funktioniert weiter. */}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Suche zurücksetzen"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showPanel && (
        <div
          ref={listRef}
          id="global-search-listbox"
          role="listbox"
          aria-label="Suchergebnisse"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[22rem] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
        >
          {loading && flat.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Suche…
            </div>
          ) : flat.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Keine Ergebnisse für „{trimmed}“
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className="py-1">
                <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((result) => {
                  runningIndex++;
                  const index = runningIndex;
                  const active = index === activeIndex;
                  const Icon = TYPE_META.get(result.type)?.icon ?? Search;
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      role="option"
                      id={`global-search-option-${index}`}
                      data-index={index}
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      // onMouseDown statt onClick: der Outside-Handler schließt
                      // das Panel beim mousedown, ein onClick käme nie an.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        navigate(result.url);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors',
                        active ? 'bg-muted' : 'hover:bg-muted/60'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {result.title}
                        </span>
                        {result.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {result.subtitle}
                          </span>
                        )}
                      </span>
                      {active && (
                        <CornerDownLeft
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
