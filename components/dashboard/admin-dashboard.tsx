'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, DollarSign, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface AdminDashboardProps {
  user: {
    name?: string;
    email?: string;
  };
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Admin Dashboard - {user.name?.split(' ')[0] || 'Admin'}
        </h1>
        <p className="text-muted-foreground mt-2">Vereinsverwaltung und Übersicht</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mitglieder</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">320</div>
            <p className="text-xs text-muted-foreground">+12 diesen Monat</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/admin/members">Verwalten</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktive Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">Diese Woche</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/admin/schedules">Planen</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Umsatz (Monat)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€24,500</div>
            <p className="text-xs text-muted-foreground">+18% zum Vormonat</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/admin/billing">Details</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auslastung</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78%</div>
            <p className="text-xs text-muted-foreground">Court-Belegung</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/admin/analytics">Analyse</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ausstehende Genehmigungen</CardTitle>
            <CardDescription>Benötigen deine Aufmerksamkeit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium">Abwesenheitsanträge</p>
                    <p className="text-sm text-muted-foreground">3 neue Anträge</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/approvals">Prüfen</Link>
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium">Stundenzettel</p>
                    <p className="text-sm text-muted-foreground">5 zur Genehmigung</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/approvals">Prüfen</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Offene Rechnungen</CardTitle>
            <CardDescription>Zahlungsübersicht</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Bezahlt</p>
                    <p className="text-sm text-muted-foreground">€18,200 (285 Rechnungen)</p>
                  </div>
                </div>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium">Überfällig</p>
                    <p className="text-sm text-muted-foreground">€2,450 (12 Rechnungen)</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/billing">Mahnungen</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Schnellzugriff</CardTitle>
          <CardDescription>Häufig genutzte Funktionen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3">
            <Button variant="outline" asChild className="justify-start">
              <Link href="/admin/members">
                <Users className="mr-2 h-4 w-4" />
                Mitglied einladen
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/admin/schedules">
                <Calendar className="mr-2 h-4 w-4" />
                Session planen
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/admin/billing">
                <DollarSign className="mr-2 h-4 w-4" />
                Rechnung erstellen
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
