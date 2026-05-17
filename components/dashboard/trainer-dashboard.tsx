import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
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
        <StatCard icon={Calendar} value={4} label="Heute Sessions" sublabel="+2 morgen geplant">
          <Button asChild variant="link" className="p-0 h-auto">
            <Link href="/scheduler">Zum Scheduler</Link>
          </Button>
        </StatCard>

        <StatCard icon={Users} value={28} label="Teilnehmer" sublabel="Aktive Schüler">
          <Button asChild variant="link" className="p-0 h-auto">
            <Link href="/admin/members">Alle ansehen</Link>
          </Button>
        </StatCard>

        <StatCard
          icon={TrendingUp}
          value="92%"
          label="Anwesenheitsrate"
          sublabel="Letzte 30 Tage"
        />

        <StatCard
          icon={DollarSign}
          value="€2,450"
          label="Einnahmen (Monat)"
          sublabel="+12% zum Vormonat"
        />
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Heutige Sessions</CardTitle>
          <CardDescription>Dein Trainingsplan für heute</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-l-4 border-brand-accent pl-4 py-2">
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
            <div className="flex items-center justify-between border-l-4 border-brand-accent pl-4 py-2">
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
            <div className="flex items-center justify-between border-l-4 border-brand-accent pl-4 py-2">
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
