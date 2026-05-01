'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, User, Mail, Calendar, Check, X } from 'lucide-react';
import type { Member } from '../member.types';

interface Props {
  initialMember: Member;
  clubId: string;
}

interface BookingData {
  id: string;
  session_start: string | null;
  session_end: string | null;
  trainer_name: string | null;
  booked_at: string | null;
  status: string;
}

export function MembersDetailClient({ initialMember, clubId }: Props) {
  const router = useRouter();
  const [member, setMember] = useState<Member>(initialMember);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/bookings?memberId=${member.id}&clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
    }
  }, [member.id, clubId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleRoleChange = async (newRole: Member['role']) => {
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler bei Rollenänderung');
      }

      setMember((prev) => ({ ...prev, role: newRole }));
      toast.success(`Rolle geändert zu ${newRole}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler';
      toast.error(message);
    }
  };

  const handleToggleActive = async () => {
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !member.is_active }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler');
      }

      setMember((prev) => ({ ...prev, is_active: !prev.is_active }));
      toast.success(`Mitglied ${member.is_active ? 'deaktiviert' : 'aktiviert'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler';
      toast.error(message);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-brand-primary">Mitgliedsdetails</h1>
          <p className="text-muted-foreground">Verwaltung von {member.full_name}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profil-Karte */}
        <Card className="md:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-brand-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-brand-primary" />
              </div>
              <div>
                <CardTitle>{member.full_name}</CardTitle>
                <CardDescription>{member.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{member.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Beigetreten: {formatDate(member.joined_at)}</span>
            </div>

            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Rolle</Label>
                <Select value={member.role} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="superadmin">Superadmin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Status</Label>
                <Button
                  variant={member.is_active ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleToggleActive}
                >
                  {member.is_active ? (
                    <>
                      <Check className="h-4 w-4 mr-1" /> Aktiv
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-1" /> Inaktiv
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Buchungen */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Buchungen</CardTitle>
            <CardDescription>Alle Trainingsbuchungen dieses Mitglieds</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Laden...</div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Noch keine Buchungen</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum/Uhrzeit</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Gebucht am</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        {b.session_start ? new Date(b.session_start).toLocaleString('de-DE') : '-'}
                      </TableCell>
                      <TableCell>{b.trainer_name || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            b.status === 'confirmed'
                              ? 'bg-green-100 text-green-700'
                              : b.status === 'cancelled'
                                ? 'bg-red-100 text-red-700'
                                : b.status === 'no_show'
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-yellow-100 text-yellow-700'
                          }
                        >
                          {b.status === 'confirmed'
                            ? 'Bestätigt'
                            : b.status === 'cancelled'
                              ? 'Storniert'
                              : b.status === 'no_show'
                                ? 'Nicht erschienen'
                                : 'Ausstehend'}
                        </Badge>
                      </TableCell>
                      <TableCell>{b.booked_at ? formatDate(b.booked_at) : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
