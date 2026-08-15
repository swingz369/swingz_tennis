'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CloudRain,
  Sun,
  Cloud,
  Snowflake,
  Wind,
  Thermometer,
  AlertTriangle,
  RefreshCw,
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

/**
 * Reine Wetter-Prognose-Karte (informativ). Die Sperren-Verwaltung selbst liegt
 * in closures-tab.tsx und ist NICHT an dieses (optionale) Feature gekoppelt.
 */
export default function WeatherClient() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/weather/check');
      if (res.ok) {
        const data = await res.json();
        setWeather(data.weather);
        setCity(data.city ?? null);
        setUnavailableReason(data.unavailableReason ?? null);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Statt still zu verschwinden wird der Grund genannt — vorher rendert die Karte
  // nichts und der Admin konnte nicht wissen, warum kein Wetter dasteht.
  if (!weather) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            {unavailableReason ?? 'Wetterdaten sind derzeit nicht abrufbar.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-3">
          <WeatherIcon condition={weather.condition} />
          <div>
            <div className="text-2xl font-bold">{Math.round(weather.temperature)}°C</div>
            <div className="text-sm text-muted-foreground capitalize">{weather.description}</div>
            <div className="text-xs text-muted-foreground">
              Aktuell{city ? ` in ${city}` : ''} — keine Vorhersage
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
  );
}
