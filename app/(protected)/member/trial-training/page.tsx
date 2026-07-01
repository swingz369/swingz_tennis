import { requireAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  GraduationCap,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface TrialTrainingRow {
  id: string;
  participant_first_name: string;
  participant_last_name: string;
  participant_email: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration: number | null;
  trainer_name: string | null;
  court_name: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const statusConfig: Record<
  string,
  { label: string; icon: typeof CheckCircle2; color: string; description: string }
> = {
  requested: {
    label: 'Angefragt',
    icon: AlertCircle,
    color:
      'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-300 dark:border-warning-800',
    description: 'Deine Anfrage ist eingegangen. Wir melden uns in Kürze mit einem Termin.',
  },
  scheduled: {
    label: 'Terminiert',
    icon: Calendar,
    color:
      'bg-info-50 text-info-700 border-info-200 dark:bg-info-900/20 dark:text-info-300 dark:border-info-800',
    description: 'Dein Probetraining ist terminiert. Wir freuen uns auf dich!',
  },
  completed: {
    label: 'Abgeschlossen',
    icon: CheckCircle2,
    color:
      'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-300 dark:border-success-800',
    description: 'Dein Probetraining ist abgeschlossen. Willkommen im Verein!',
  },
  cancelled: {
    label: 'Abgesagt',
    icon: XCircle,
    color:
      'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800',
    description: 'Dieses Probetraining wurde abgesagt.',
  },
  no_show: {
    label: 'Nicht erschienen',
    icon: XCircle,
    color:
      'bg-error-50 text-error-700 border-error-200 dark:bg-error-900/20 dark:text-error-300 dark:border-error-800',
    description: 'Leider bist du nicht zum Probetraining erschienen.',
  },
  converted: {
    label: 'Mitglied geworden',
    icon: Sparkles,
    color:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Super! Du bist jetzt offizielles Mitglied. Willkommen!',
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(time: string | null) {
  if (!time) return '';
  return time.substring(0, 5);
}

export default async function MemberTrialTrainingPage() {
  const { supabase, user } = await requireAuth();

  // Get user email and active membership
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from('users').select('email').eq('id', user.id).maybeSingle(),
    supabase
      .from('user_club_memberships')
      .select('club_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1),
  ]);

  const email = profile?.email ?? user.email ?? null;
  const clubId = memberships?.[0]?.club_id ?? null;

  let trainings: TrialTrainingRow[] = [];

  if (email && clubId) {
    const { data } = await supabase
      .from('trial_trainings')
      .select(
        'id, participant_first_name, participant_last_name, participant_email, scheduled_date, scheduled_time, duration, trainer_name, court_name, status, notes, created_at'
      )
      .ilike('participant_email', email)
      .eq('club_id', clubId)
      .order('scheduled_date', { ascending: false });

    trainings = data ?? [];
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-brand-primary" />
          Probetrainings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Deine Probetraining-Anfragen und Termine
        </p>
      </div>

      {/* Empty State */}
      {trainings.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="py-16 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-semibold text-foreground mb-2">Noch kein Probetraining</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Du hast noch kein Probetraining angefragt. Vereinbare jetzt einen kostenlosen
              Schnuppertermin!
            </p>
            <Link href="/bookings">
              <Button className="gap-2">
                <Calendar className="h-4 w-4" />
                Probetraining anfragen
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Training Cards */}
      <div className="space-y-4">
        {trainings.map((t) => {
          const config = statusConfig[t.status] ?? statusConfig.requested;
          const StatusIcon = config.icon;
          const isUpcoming = t.status === 'scheduled' && t.scheduled_date;
          return (
            <Card
              key={t.id}
              className={`hover:shadow-md transition-shadow ${isUpcoming ? 'border-brand-primary/30' : ''}`}
            >
              <CardContent className="p-5">
                {/* Status + Date Header */}
                <div className="flex items-start justify-between mb-3">
                  <Badge className={`${config.color} text-xs gap-1`}>
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Angefragt am {new Date(t.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground mb-3">{config.description}</p>

                {/* Details Grid */}
                {t.scheduled_date && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-brand-primary shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Datum</p>
                        <p className="text-sm font-medium">{formatDate(t.scheduled_date)}</p>
                      </div>
                    </div>
                    {t.scheduled_time && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-brand-primary shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Uhrzeit</p>
                          <p className="text-sm font-medium">
                            {formatTime(t.scheduled_time)}
                            {t.duration ? ` (${t.duration} Min)` : ''}
                          </p>
                        </div>
                      </div>
                    )}
                    {t.court_name && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-brand-primary shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Platz</p>
                          <p className="text-sm font-medium">{t.court_name}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Trainer */}
                {t.trainer_name && (
                  <div className="flex items-center gap-2 mt-3">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Trainer: <span className="font-medium text-foreground">{t.trainer_name}</span>
                    </span>
                  </div>
                )}

                {/* Notes */}
                {t.notes && (
                  <p className="text-xs text-muted-foreground mt-3 italic">&quot;{t.notes}&quot;</p>
                )}

                {/* Converted State */}
                {t.status === 'converted' && (
                  <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        Willkommen im Verein! Du kannst jetzt alle Mitgliederfunktionen nutzen.
                      </p>
                    </div>
                    <Link href="/member">
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-1 h-auto p-0 text-emerald-700 dark:text-emerald-300"
                      >
                        Zum Mitglieder-Dashboard →
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
