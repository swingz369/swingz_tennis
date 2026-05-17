// services/scheduling/src/index.ts
import express from 'express';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:8000',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-key'
);

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Optimize Schedule - V4 KI-Prompts
app.post('/api/schedule/optimize', async (req, res) => {
  const { clubId, season, year } = req.body;

  try {
    // Hole Club-Daten
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .single();

    if (clubError || !club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    // Hole Trainer
    const { data: trainers, error: trainerError } = await supabase
      .from('trainers')
      .select('*')
      .eq('club_id', clubId)
      .eq('is_active', true);

    if (trainerError) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Hole Trainingsgruppen
    const { data: schedule } = await supabase
      .from('schedules')
      .select(
        `
        *,
        training_groups (*)
      `
      )
      .eq('club_id', clubId)
      .eq('season_year', year)
      .single();

    // KI-Prompt - Verbesserte Version für bessere Qualität
    const prompt = `
Als erfahrener Tennis-Trainer erstelle einen optimalen Trainingsplan für folgende Konfiguration:

Club: ${club.name}
Saison: ${season} ${year}

Verfügbare Trainer:
${trainers?.map((t: any) => `- ${t.name}: ${t.specialties.join(', ')} (${t.max_hours_per_week}h/Woche)`).join('\n')}

Trainingsgruppen:
${schedule?.training_groups?.map((g: any) => `- ${g.name}: ${g.level} (${g.ageGroup}), ${g.member_ids?.length || 0} Mitglieder`).join('\n') || 'Keine Gruppen definiert'}

ANFORDERUNGEN:
1. Erstelle maximal 5 Trainingseinheiten pro Woche (Mo-Fr)
2. Verteile Trainer fair (keine Überlastung >40h/Woche)
3. Berücksichtige Trainer-Spezialitäten
4. Gruppen mit mehr Mitgliedern priorisieren
5. Gib valides JSON zurück

JSON FORMAT:
{
  "schedule": {
    "week": "2024-W15",
    "sessions": [
      {
        "day": "monday",
        "start_time": "17:00",
        "duration_minutes": 90,
        "trainer_id": "${trainers?.[0]?.id || 't-1'}",
        "group_id": "${schedule?.training_groups?.[0]?.id || 'g-1'}",
        "court": "Court 1",
        "notes": "Taktik-Training"
      }
    ]
  }
}

Antworte AUSSCHLIESSLICH mit valide JSON, keine Erklärungen!
`;

    // Try OpenAI API with fallback on failure
    const aiResponse = await (async (): Promise<string | null> => {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Du bist ein Tennis-Trainingsplaner. Du erstellst strukturierte JSON-Pläne.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        });
        return completion.choices[0]?.message?.content ?? null;
      } catch (apiError) {
        console.error('OpenAI API call failed — using rule-based fallback:', apiError);
        return null;
      }
    })();
    let scheduleData;

    try {
      // Extrahiere JSON aus Response
      const jsonMatch = aiResponse?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scheduleData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('AI Response Parse Error:', parseError);
      console.error('Raw AI Response:', aiResponse);

      // Fallback: Manueller Plan
      scheduleData = {
        schedule: {
          week: `${year}-W15`,
          sessions: [
            {
              day: 'monday',
              start_time: '17:00',
              duration_minutes: 90,
              trainer_id: trainers?.[0]?.id || 't-1',
              group_id: schedule?.training_groups?.[0]?.id || 'g-1',
              court: 'Court 1',
              notes: 'Standard-Training (KI-Fehler)',
            },
          ],
        },
      };
    }

    // Cache in Redis
    await redis.setex(`schedule:${clubId}:${year}`, 3600, JSON.stringify(scheduleData));

    // Event veröffentlichen
    await redis.publish(
      'schedule:optimized',
      JSON.stringify({
        clubId,
        schedule: scheduleData,
        timestamp: new Date().toISOString(),
      })
    );

    res.json({
      success: true,
      data: scheduleData,
      source: aiResponse ? 'ai' : 'fallback',
    });
  } catch (error) {
    console.error('Scheduling error:', error);
    res.status(500).json({ error: 'Scheduling failed' });
  }
});

// Get Cached Schedule
app.get('/api/schedule/:clubId/:year', async (req, res) => {
  const { clubId, year } = req.params;

  const cached = await redis.get(`schedule:${clubId}:${year}`);
  if (cached) {
    return res.json({ cached: true, data: JSON.parse(cached) });
  }

  res.status(404).json({ error: 'Schedule not found' });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Scheduling Service running on port ${PORT}`);
});
