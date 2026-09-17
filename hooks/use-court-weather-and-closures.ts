import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import type { CourtClosure } from '@/lib/court-calendar-utils';

export interface WeatherData {
  temperature: number;
  condition: string;
  description: string;
  windSpeed: number;
  precipitation: number;
  recommendation: 'green' | 'yellow' | 'red';
  city: string;
}

/** Wetter-Vorhersage (nur Admin, rein informativ) + aktive Platzsperren
 *  (court_closures, alle Rollen — sonst sehen Member/Trainer admin-gesetzte
 *  Sperren nicht im Grid). */
export function useCourtWeatherAndClosures(clubId: string | null, isAdmin: boolean) {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [courtClosures, setCourtClosures] = useState<CourtClosure[]>([]);

  const fetchClosures = useCallback(async () => {
    if (!clubId) return;
    try {
      const res = await apiFetch('/api/weather/closures?active=true');
      if (res.ok) {
        const data = await res.json();
        setCourtClosures(data.closures ?? []);
      }
    } catch {
      /* ignore */
    }
  }, [clubId]);

  useEffect(() => {
    fetchClosures();
  }, [fetchClosures]);

  useEffect(() => {
    if (!clubId || !isAdmin) return;
    const fetchWeather = async () => {
      try {
        const res = await apiFetch('/api/weather/check');
        if (res.ok) {
          const data = await res.json();
          setWeatherData(data.weather ? { ...data.weather, city: data.city ?? 'Berlin' } : null);
        }
      } catch {
        /* ignore */
      }
    };
    fetchWeather();
  }, [clubId, isAdmin]);

  return { weatherData, courtClosures, refetchClosures: fetchClosures };
}
