import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface TrainerDashboardProps {
  user: {
    name?: string;
    email?: string;
  };
}

/**
 * Trainer Dashboard - Server Component
 * Optimized: Removed 'use client' as no interactivity needed
 */
export function TrainerDashboard({ user }: TrainerDashboardProps) {
  const userName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Trainer';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trainer Dashboard - {userName}</h1>
        <p className="text-muted-foreground mt-2">Übersicht deiner Trainings und Teilnehmer</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heute Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">+2 morgen geplant</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/scheduler">Zum Scheduler</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teilnehmer</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">28</div>
            <p className="text-xs text-muted-foreground">Aktive Schüler</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/admin/members">Alle ansehen</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anwesenheitsrate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground">Letzte 30 Tage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Einnahmen (Monat)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€2,450</div>
            <p className="text-xs text-muted-foreground">+12% zum Vormonat</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Heutige Sessions</CardTitle>
          <CardDescription>Dein Trainingsplan für heute</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-l-4 border-[#FF6B35] pl-4 py-2">
              <div>
                <p className="font-medium">Anfänger Gruppe A</p>
                <p className="text-sm text-muted-foreground">
                  09:00 - 10:30 · Platz 1 · 8 Teilnehmer
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/scheduler">Anwesenheit erfassen</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between border-l-4 border-[#FF6B35] pl-4 py-2">
              <div>
                <p className="font-medium">Fortgeschrittene</p>
                <p className="text-sm text-muted-foreground">
                  14:00 - 15:30 · Platz 2 · 6 Teilnehmer
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/scheduler">Details</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between border-l-4 border-[#FF6B35] pl-4 py-2">
              <div>
                <p className="font-medium">Privat-Training</p>
                <p className="text-sm text-muted-foreground">
                  17:00 - 18:00 · Platz 3 · 1 Teilnehmer
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/scheduler">Details</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
