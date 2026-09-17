'use client';

/**
 * Kleine, zustandslose Hinweisbanner des Platzkalenders — Wetter (Admin),
 * aktive Platzsperren (alle Rollen) und die "keine Sessions"-Warnung
 * (Admin). Ausgelagert aus unified-court-calendar.tsx (Sanierungsplan
 * Phase 2.2), da sie reine Darstellung ohne eigenen Zustand sind.
 */
import Link from 'next/link';
import { AlertTriangle, Cloud, CloudRain, Lock, Snowflake, Sun } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';
import type { WeatherData } from '@/hooks/use-court-weather-and-closures';
import type { CourtClosure } from '@/lib/court-calendar-utils';

export function WeatherBanner({ weatherData }: { weatherData: WeatherData }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3 text-sm">
        <IconBox
          icon={
            weatherData.condition === 'Rain' || weatherData.condition === 'Drizzle'
              ? CloudRain
              : weatherData.condition === 'Snow'
                ? Snowflake
                : weatherData.condition === 'Thunderstorm'
                  ? AlertTriangle
                  : weatherData.condition === 'Clear'
                    ? Sun
                    : Cloud
          }
          size="sm"
          variant={
            weatherData.recommendation === 'red'
              ? 'red'
              : weatherData.recommendation === 'yellow'
                ? 'amber'
                : 'green'
          }
        />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-foreground">{weatherData.city}</span>
          <span className="ml-2 text-muted-foreground">
            {Math.round(weatherData.temperature)}°C · {weatherData.description}
          </span>
          <span className="ml-2 text-xs text-muted-foreground/70">
            ({weatherData.windSpeed} m/s, {weatherData.precipitation} mm)
          </span>
        </div>
        {weatherData.recommendation !== 'green' && (
          <Badge
            variant={weatherData.recommendation === 'red' ? 'error' : 'warning'}
            className="whitespace-nowrap"
          >
            {weatherData.recommendation === 'red' ? '⚠️ Außenplätze sperren' : '⚡ Platz prüfen'}
          </Badge>
        )}
        <Link
          href="/admin/courts?view=manage&tab=closures"
          className="text-xs font-medium text-muted-foreground hover:text-brand-light transition-colors whitespace-nowrap"
        >
          Details →
        </Link>
      </CardContent>
    </Card>
  );
}

/** Aktive Platzsperren — für alle Rollen sichtbar (kein Namensleck, nur Grund). */
export function ActiveClosuresBanner({
  courtClosures,
  courts,
}: {
  courtClosures: CourtClosure[];
  courts: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {courtClosures.map((c) => {
        const courtName = courts.find((ct) => ct.id === c.court_id)?.name ?? 'Platz';
        return (
          <div
            key={c.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-brand-accent-50 border border-brand-accent-200 text-brand-accent-800 text-xs font-medium dark:bg-brand-accent-950/30 dark:border-brand-accent-800 dark:text-brand-accent-300"
          >
            <Lock className="h-3 w-3" />
            <span>{courtName}</span>
            <span className="opacity-70">
              ·{' '}
              {c.reason === 'weather'
                ? '🌧️ Wetter'
                : c.reason === 'maintenance'
                  ? '🔧 Wartung'
                  : c.reason}
            </span>
            {c.description && <span className="opacity-60">· {c.description}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function ZeroSessionsWarning() {
  return (
    <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-warning-800">
            Keine zukünftigen Sessions gefunden
          </p>
          <p className="text-sm text-warning-700 mt-1">
            Es sind aktuell keine Sessions für die Zukunft geplant. Bitte den{' '}
            <Link
              href="/admin/seasons"
              className="font-semibold text-warning-800 underline hover:text-warning-900 transition-colors"
            >
              Saisonplan
            </Link>{' '}
            veröffentlichen, damit Sessions erstellt und Buchungen ermöglicht werden.
          </p>
        </div>
      </div>
    </div>
  );
}
