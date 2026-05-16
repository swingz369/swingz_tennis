import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Trophy, Clock, CreditCard, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface MemberDashboardProps {
  user: {
    name?: string;
    email?: string;
  };
  noMembership?: boolean;
}

/**
 * Member Dashboard - Server Component
 * Optimized: Removed 'use client' as no interactivity needed
 * All navigation uses Next.js Link (works in Server Components)
 */
export function MemberDashboard({ user, noMembership }: MemberDashboardProps) {
  const userName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Member';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Willkommen zurück, {userName}!</h1>
        <p className="text-muted-foreground mt-2">Hier ist deine Übersicht für heute</p>
      </div>

      {/* No membership notice */}
      {noMembership && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/50 p-4">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Noch kein Verein zugewiesen
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Du bist noch keinem Verein zugeordnet. Bitte wende dich an deinen Administrator oder{' '}
              <Link href="/apply" className="underline font-medium">
                beantrage die Mitgliedschaft
              </Link>
              .
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nächstes Training</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Morgen</div>
            <p className="text-xs text-muted-foreground">18:00 Uhr - Platz 3</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/training-schedule">Details ansehen</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meine Buchungen</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Aktive Buchungen</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/bookings">Alle ansehen</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anwesenheit</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-muted-foreground">Letzten 30 Tage</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/attendance-history">Historie ansehen</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offene Rechnung</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€45,00</div>
            <p className="text-xs text-muted-foreground">Fällig in 5 Tagen</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/billing">Bezahlen</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Deine nächsten Trainings</CardTitle>
          <CardDescription>Kommende Sessions diese Woche</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-l-4 border-brand-light pl-4 py-2">
              <div>
                <p className="font-medium">Gruppen-Training Fortgeschritten</p>
                <p className="text-sm text-muted-foreground">Mittwoch, 18:00 - 19:30</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/training-schedule">Details</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between border-l-4 border-brand-light pl-4 py-2">
              <div>
                <p className="font-medium">Einzel-Training</p>
                <p className="text-sm text-muted-foreground">Freitag, 17:00 - 18:00</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/training-schedule">Details</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
