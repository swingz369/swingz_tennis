import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, DollarSign, Activity } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface SuperadminDashboardProps {
  user: {
    name?: string;
    email?: string;
  };
}

/**
 * Superadmin Dashboard - Server Component
 * Optimized: Removed 'use client' as no interactivity needed
 */
export function SuperadminDashboard({ user }: SuperadminDashboardProps) {
  // Ensure user has safe defaults
  const userName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Superadmin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Superadmin Dashboard - {userName}</h1>
        <p className="text-muted-foreground mt-2">Plattform-weite Übersicht und Verwaltung</p>
      </div>

      {/* Platform Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clubs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <p className="text-xs text-muted-foreground">+2 diesen Monat</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/admin/tenants">Verwalten</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamt Mitglieder</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4,820</div>
            <p className="text-xs text-muted-foreground">Über alle Clubs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plattform-Umsatz</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€385K</div>
            <p className="text-xs text-muted-foreground">+24% zum Vormonat</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">99.9%</div>
            <p className="text-xs text-muted-foreground">Uptime letzte 30 Tage</p>
          </CardContent>
        </Card>
      </div>

      {/* Club Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Club-Übersicht</CardTitle>
          <CardDescription>Top 5 Clubs nach Aktivität</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-l-4 border-brand-light pl-4 py-2">
              <div>
                <p className="font-medium">Tennis Berlin</p>
                <p className="text-sm text-muted-foreground">
                  580 Mitglieder · 8 Courts · €45K/Monat
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/clubs">Details</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between border-l-4 border-brand-light pl-4 py-2">
              <div>
                <p className="font-medium">Squash Munich</p>
                <p className="text-sm text-muted-foreground">
                  420 Mitglieder · 6 Courts · €32K/Monat
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/clubs">Details</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between border-l-4 border-brand-light pl-4 py-2">
              <div>
                <p className="font-medium">Badminton Hamburg</p>
                <p className="text-sm text-muted-foreground">
                  350 Mitglieder · 5 Courts · €28K/Monat
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/clubs">Details</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Actions */}
      <Card>
        <CardHeader>
          <CardTitle>System-Verwaltung</CardTitle>
          <CardDescription>Administrative Funktionen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3">
            <Button variant="outline" asChild className="justify-start">
              <Link href="/admin/tenants">
                <Building2 className="mr-2 h-4 w-4" />
                Neuen Club erstellen
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/admin/settings">
                <Activity className="mr-2 h-4 w-4" />
                System-Einstellungen
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/admin/analytics">
                <DollarSign className="mr-2 h-4 w-4" />
                Finanz-Analyse
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
