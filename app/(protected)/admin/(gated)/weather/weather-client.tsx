'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  CloudRain,
  Sun,
  Cloud,
  Snowflake,
  Wind,
  Thermometer,
  AlertTriangle,
  RefreshCw,
  Plus,
  X,
  Droplets,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface WeatherData {
  temperature: number;
  condition: string;
  description: string;
  windSpeed: number;
  precipitation: number;
  recommendation: 'green' | 'yellow' | 'red';
  affectedCourts: string[];
}

interface Court {
  id: string;
  name: string;
  surface: string;
}

interface Closure {
  id: string;
  court_id: string;
  reason: string;
  weather_condition: string | null;
  start_date: string;
  end_date: string | null;
  description: string | null;
  auto_generated: boolean;
  courts?: { name: string; surface: string };
}

function WeatherIcon({ condition }: { condition: string }) {
  switch (condition) {
    case 'Rain':
    case 'Drizzle':
      return <CloudRain className="h-8 w-8 text-info-500" />;
    case 'Snow':
      return <Snowflake className="h-8 w-8 text-info-400" />;
    case 'Thunderstorm':
      return <AlertTriangle className="h-8 w-8 text-error-500" />;
    case 'Clear':
      return <Sun className="h-8 w-8 text-warning-500" />;
    default:
      return <Cloud className="h-8 w-8 text-gray-400" />;
  }
}

function RecommendationBadge({ level }: { level: 'green' | 'yellow' | 'red' }) {
  const config = {
    green: {
      label: 'Freigegeben',
      color: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
      icon: Sun,
    },
    yellow: {
      label: 'Eingeschränkt',
      color: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
      icon: AlertTriangle,
    },
    red: {
      label: 'Gesperrt',
      color: 'bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-300',
      icon: CloudRain,
    },
  };
  const c = config[level];
  return (
    <Badge className={`${c.color} gap-1.5`}>
      <c.icon className="h-3.5 w-3.5" />
      {c.label}
    </Badge>
  );
}

export default function WeatherClient() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [outdoorCourts, setOutdoorCourts] = useState<Court[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewClosure, setShowNewClosure] = useState(false);
  const [newClosure, setNewClosure] = useState({
    court_id: '',
    reason: 'weather',
    description: '',
    start_date: '',
    end_date: '',
    notify_members: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [weatherRes, closuresRes] = await Promise.all([
        apiFetch('/api/weather/check'),
        apiFetch('/api/weather/closures?active=true'),
      ]);

      if (weatherRes.ok) {
        const data = await weatherRes.json();
        setWeather(data.weather);
        setOutdoorCourts(data.outdoorCourts ?? []);
      }

      if (closuresRes.ok) {
        const data = await closuresRes.json();
        setClosures(data.closures ?? []);
      }
    } catch {
      toast.error('Fehler beim Laden der Wetterdaten');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateClosure = async () => {
    if (!newClosure.court_id || !newClosure.start_date) {
      toast.error('Platz und Startdatum erforderlich');
      return;
    }
    try {
      const res = await apiFetch('/api/weather/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClosure),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Platzsperre erstellt');
      setShowNewClosure(false);
      setNewClosure({
        court_id: '',
        reason: 'weather',
        description: '',
        start_date: '',
        end_date: '',
        notify_members: false,
      });
      fetchData();
    } catch {
      toast.error('Fehler beim Erstellen der Platzsperre');
    }
  };

  const handleRemoveClosure = async (id: string) => {
    try {
      await apiFetch(`/api/weather/closures/${id}`, { method: 'DELETE' });
      toast.success('Platzsperre aufgehoben');
      fetchData();
    } catch {
      toast.error('Fehler beim Aufheben');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weather Overview */}
      {weather && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <WeatherIcon condition={weather.condition} />
              <div>
                <div className="text-2xl font-bold">{Math.round(weather.temperature)}°C</div>
                <div className="text-sm text-muted-foreground capitalize">
                  {weather.description}
                </div>
              </div>
            </CardTitle>
            <div className="flex items-center gap-3">
              <RecommendationBadge level={weather.recommendation} />
              <Button variant="ghost" size="icon" onClick={fetchData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Thermometer className="h-4 w-4 text-error-400" />
                <span>{Math.round(weather.temperature)}°C</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Wind className="h-4 w-4 text-info-400" />
                <span>{weather.windSpeed} m/s</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Droplets className="h-4 w-4 text-info-400" />
                <span>{weather.precipitation} mm</span>
              </div>
            </div>
            {weather.recommendation !== 'green' && (
              <div className="mt-4 p-3 rounded-xl bg-warning-50 dark:bg-warning-900/30 border border-warning-200 dark:border-warning-800">
                <p className="text-sm text-warning-800 dark:text-warning-300">
                  {weather.recommendation === 'red'
                    ? '⚠️ Achtung: Schlechte Wetterbedingungen — Außenplätze sollten gesperrt werden.'
                    : '⚡ Eingeschränkte Bedingungen — Bitte prüfe die Platzverhältnisse vor Ort.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Closures */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Aktive Platzsperren</CardTitle>
          <Button size="sm" onClick={() => setShowNewClosure(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Neue Sperre
          </Button>
        </CardHeader>
        <CardContent>
          {closures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sun className="h-8 w-8 mx-auto mb-2 text-success-400" />
              <p>Keine aktiven Platzsperren</p>
            </div>
          ) : (
            <div className="space-y-2">
              {closures.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted border"
                >
                  <div>
                    <div className="font-medium text-sm">{c.courts?.name ?? 'Platz'}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.reason === 'weather'
                        ? '🌧️ Wetter'
                        : c.reason === 'maintenance'
                          ? '🔧 Wartung'
                          : c.reason === 'tournament'
                            ? '🏆 Vereinsturnier'
                            : c.reason === 'event'
                              ? '📅 Veranstaltung'
                              : '📋 ' + c.reason}
                      {c.weather_condition && ` · ${c.weather_condition}`}
                      {c.description && ` · ${c.description}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(c.start_date).toLocaleDateString('de-DE')}
                      {c.end_date && ` — ${new Date(c.end_date).toLocaleDateString('de-DE')}`}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveClosure(c.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* New Closure Form */}
          {showNewClosure && (
            <div className="mt-4 p-4 border rounded-xl bg-muted/50 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wc-court" className="text-xs font-medium">
                    Platz
                  </label>
                  <select
                    id="wc-court"
                    value={newClosure.court_id}
                    onChange={(e) => setNewClosure({ ...newClosure, court_id: e.target.value })}
                    className="w-full mt-1 p-2 rounded border bg-background text-sm"
                  >
                    <option value="">Platz wählen…</option>
                    {outdoorCourts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.surface})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="wc-reason" className="text-xs font-medium">
                    Grund
                  </label>
                  <select
                    id="wc-reason"
                    value={newClosure.reason}
                    onChange={(e) => setNewClosure({ ...newClosure, reason: e.target.value })}
                    className="w-full mt-1 p-2 rounded border bg-background text-sm"
                  >
                    <option value="weather">Wetter</option>
                    <option value="maintenance">Wartung</option>
                    <option value="event">Veranstaltung</option>
                    <option value="tournament">Vereinsturnier</option>
                    <option value="other">Sonstiges</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wc-start" className="text-xs font-medium">
                    Von
                  </label>
                  <Input
                    id="wc-start"
                    type="datetime-local"
                    value={newClosure.start_date}
                    onChange={(e) => setNewClosure({ ...newClosure, start_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="wc-end" className="text-xs font-medium">
                    Bis (optional)
                  </label>
                  <Input
                    id="wc-end"
                    type="datetime-local"
                    value={newClosure.end_date}
                    onChange={(e) => setNewClosure({ ...newClosure, end_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <Input
                placeholder="Beschreibung (optional)"
                value={newClosure.description}
                onChange={(e) => setNewClosure({ ...newClosure, description: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newClosure.notify_members || newClosure.reason === 'tournament'}
                  disabled={newClosure.reason === 'tournament'}
                  onChange={(e) =>
                    setNewClosure({ ...newClosure, notify_members: e.target.checked })
                  }
                  className="rounded"
                />
                <span>
                  Alle Mitglieder benachrichtigen
                  {newClosure.reason === 'tournament' && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (bei Vereinsturnier automatisch)
                    </span>
                  )}
                </span>
              </label>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowNewClosure(false)}>
                  Abbrechen
                </Button>
                <Button size="sm" onClick={handleCreateClosure}>
                  Sperre erstellen
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
