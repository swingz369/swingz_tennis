'use client';

import { Card } from '@/components/ui/card';
import { Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export interface MemberProfileData {
  member: {
    id: string;
    email: string;
    fullName: string;
    memberSince: string;
    roles: string[];
    clubIds: string[];
    primaryClubId: string | null;
  };
  stats: {
    totalBookings: number;
    confirmed: number;
    cancelled: number;
    noShow: number;
  };
  recentBookings: Array<{
    id: string;
    status: string;
    bookedAt: string;
    session: {
      id: string;
      startTime: string;
      endTime: string;
      trainerId: string;
      court: string;
    } | null;
  }>;
}

export function MemberProfileClient({ data }: { data: MemberProfileData }) {
  const { member, stats, recentBookings } = data;

  const kpis = [
    {
      title: 'Gesamt Buchungen',
      value: stats.totalBookings.toString(),
      icon: Calendar,
      color: 'text-info-600',
    },
    {
      title: 'Bestätigt',
      value: stats.confirmed.toString(),
      icon: CheckCircle,
      color: 'text-success-600',
    },
    {
      title: 'Storniert',
      value: stats.cancelled.toString(),
      icon: XCircle,
      color: 'text-error-600',
    },
    {
      title: 'Nicht erschienen',
      value: stats.noShow.toString(),
      icon: AlertCircle,
      color: 'text-muted-foreground',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="px-2 py-1 bg-success-100 text-success-700 rounded-full text-xs font-medium">
            Bestätigt
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 bg-error-100 text-error-700 rounded-full text-xs font-medium">
            Storniert
          </span>
        );
      case 'no_show':
        return (
          <span className="px-2 py-1 bg-muted text-foreground rounded-full text-xs font-medium">
            Nicht erschienen
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-warning-100 text-warning-700 rounded-full text-xs font-medium">
            Ausstehend
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-primary">Mitgliedsprofil</h1>
        <p className="text-muted-foreground">Übersicht für {member.fullName}</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} variant="elevated" className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                <p className="text-3xl font-bold text-foreground mt-1">{kpi.value}</p>
              </div>
              <div className={`p-3 rounded-full bg-muted ${kpi.color}`}>
                <kpi.icon className="h-6 w-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Member Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="bordered" className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Persönliche Daten</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{member.fullName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-Mail</p>
              <p className="font-medium">{member.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mitglied seit</p>
              <p className="font-medium">
                {new Date(member.memberSince).toLocaleDateString('de-DE')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rollen</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {member.roles.map((role) => (
                  <span
                    key={role}
                    className="px-2 py-1 bg-brand-primary/10 text-brand-primary rounded text-xs font-medium"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card variant="bordered" className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Vereine</h3>
          {member.clubIds.length > 0 ? (
            <ul className="space-y-2">
              {member.clubIds.map((clubId) => (
                <li key={clubId} className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-brand-primary rounded-full" />
                  <span className="text-sm">{clubId}</span>
                  {clubId === member.primaryClubId && (
                    <span className="text-xs text-muted-foreground">(Primär)</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Vereinszugehörigkeit</p>
          )}
        </Card>
      </div>

      <Card variant="bordered" className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Letzte Buchungen</h3>
        {recentBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Session</th>
                  <th className="text-left py-2 px-3">Zeit</th>
                  <th className="text-left py-2 px-3">Platz</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Gebucht am</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((booking) => (
                  <tr key={booking.id} className="border-b last:border-0">
                    <td className="py-2 px-3">
                      {booking.session ? (
                        <span>
                          {booking.session.startTime} – {booking.session.endTime}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {booking.session ? `${booking.session.startTime} Uhr` : '-'}
                    </td>
                    <td className="py-2 px-3">{booking.session?.court || '-'}</td>
                    <td className="py-2 px-3">{getStatusBadge(booking.status)}</td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {new Date(booking.bookedAt).toLocaleDateString('de-DE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Noch keine Buchungen vorhanden</p>
        )}
      </Card>
    </div>
  );
}
