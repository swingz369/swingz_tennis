import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * GET /api/weather/check — Check weather and auto-close outdoor courts
 * Requires admin role. Uses OpenWeatherMap API (if configured) or returns mock data.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'No club selected' }, { status: 400 });
    }

    const supabase = auth.supabase;

    // Get club info
    const { data: club } = await supabase
      .from('clubs')
      .select('name, opening_hours')
      .eq('id', clubId)
      .single();

    // Get club city from system_settings for weather geocoding
    const { data: citySettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('club_id', clubId)
      .eq('key', 'club_city')
      .limit(1);
    const clubCity: string | null = citySettings?.[0]?.value ?? null;

    // Get outdoor courts
    const { data: outdoorCourts } = await supabase
      .from('courts')
      .select('id, name, surface, has_indoor')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .eq('has_indoor', false);

    // Get active weather closures (new table — cast needed)
    const { data: activeClosures } = await (supabase as any)
      .from('court_closures')
      .select(
        'id, court_id, reason, weather_condition, start_date, end_date, description, auto_generated'
      )
      .eq('club_id', clubId)
      .eq('is_active', true)
      .eq('reason', 'weather');

    // Try to fetch weather data from OpenWeatherMap if API key is available
    const weatherApiKey = process.env.OPENWEATHER_API_KEY;
    let weatherData: {
      temperature: number;
      condition: string;
      description: string;
      windSpeed: number;
      precipitation: number;
      recommendation: 'green' | 'yellow' | 'red';
      affectedCourts: string[];
    } | null = null;

    if (weatherApiKey && outdoorCourts && outdoorCourts.length > 0) {
      try {
        // Use club city for geocoding, fall back to Berlin
        let lat = 52.52;
        let lon = 13.405;

        if (clubCity) {
          const geoRes = await fetch(
            `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(clubCity)}&limit=1&appid=${weatherApiKey}`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.length > 0) {
              lat = geoData[0].lat;
              lon = geoData[0].lon;
            }
          }
        }

        const weatherRes = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${weatherApiKey}&units=metric&lang=de`
        );

        if (weatherRes.ok) {
          const data = await weatherRes.json();
          const temp = data.main?.temp ?? 20;
          const weatherMain = data.weather?.[0]?.main ?? 'Clear';
          const weatherDesc = data.weather?.[0]?.description ?? '';
          const windSpeed = data.wind?.speed ?? 0;
          const rain = data.rain?.['1h'] ?? 0;
          const snow = data.snow?.['1h'] ?? 0;

          // Determine recommendation
          let recommendation: 'green' | 'yellow' | 'red' = 'green';
          if (weatherMain === 'Thunderstorm' || snow > 2 || rain > 10) {
            recommendation = 'red';
          } else if (
            weatherMain === 'Rain' ||
            weatherMain === 'Drizzle' ||
            windSpeed > 10 ||
            temp < 2
          ) {
            recommendation = 'yellow';
          }

          const affectedCourts =
            recommendation === 'red' ? (outdoorCourts ?? []).map((c) => c.id) : [];

          weatherData = {
            temperature: temp,
            condition: weatherMain,
            description: weatherDesc,
            windSpeed,
            precipitation: rain + snow,
            recommendation,
            affectedCourts,
          };
        }
      } catch {
        // Weather API unavailable — fall through to mock data
      }
    }

    // Fallback mock weather data
    if (!weatherData) {
      weatherData = {
        temperature: 18,
        condition: 'Clouds',
        description: 'Bewölkt',
        windSpeed: 5,
        precipitation: 0,
        recommendation: 'green',
        affectedCourts: [],
      };
    }

    return NextResponse.json({
      weather: weatherData,
      outdoorCourts: outdoorCourts ?? [],
      activeClosures: activeClosures ?? [],
      club: club?.name ?? 'Verein',
      city: clubCity ?? 'Berlin',
    });
  });
}
