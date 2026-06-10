'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CenteredModal } from '@/components/ui/centered-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Award, Plus, Search, GraduationCap, Euro, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

export interface TrainerAvailabilitySlot {
  id: string;
  trainerId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'unavailable' | 'booked' | 'blocked';
  notes?: string;
}

export interface TrainerProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  bio?: string;
  profileImageUrl?: string;
  qualifications: Array<{
    id: string;
    name: string;
    issuer: string;
    issuedDate: string;
    expiryDate?: string;
    certificateUrl?: string;
    verified: boolean;
    verifiedAt?: string;
    verifiedBy?: string;
  }>;
  specializations: Array<{
    id: string;
    name: string;
    level: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  }>;
  experience: {
    years: number;
    previousClubs: string[];
    achievements: string[];
  };
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  hourlyRate?: number;
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  preferredTimeSlots: Array<{
    start: string;
    end: string;
  }>;
  languages: string[];
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function TrainerProfileManagement({ clubId: _clubId }: { clubId: string }) {
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    loadTrainers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTrainers = async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/api/trainer-profiles');
      if (!response.ok) {
        throw new Error('Failed to load trainers');
      }
      const data = await response.json();
      setTrainers(data.profiles || []);
    } catch (error) {
      console.error('Failed to load trainers:', error);
      toast.error('Fehler beim Laden der Trainer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteTrainer = async () => {
    if (!inviteEmail) {
      toast.error('Bitte eine E-Mail-Adresse eingeben');
      return;
    }
    setInviteLoading(true);
    try {
      const res = await apiFetch('/api/members/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteName || undefined,
          role: 'trainer',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Einladen');
      toast.success(data.message ?? 'Trainer erfolgreich eingeladen');
      setShowInviteForm(false);
      setInviteEmail('');
      setInviteName('');
      loadTrainers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setInviteLoading(false);
    }
  };

  const getStatusVariant = (
    status: TrainerProfile['status']
  ): 'success' | 'secondary' | 'warning' | 'error' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'secondary';
      case 'on_leave':
        return 'warning';
      case 'terminated':
        return 'error';
    }
  };

  const getStatusLabel = (status: TrainerProfile['status']) => {
    switch (status) {
      case 'active':
        return 'Aktiv';
      case 'inactive':
        return 'Inaktiv';
      case 'on_leave':
        return 'Urlaub';
      case 'terminated':
        return 'Beendet';
    }
  };

  const filteredTrainers = trainers.filter((trainer) => {
    const matchesStatus = statusFilter === 'all' || trainer.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      `${trainer.firstName} ${trainer.lastName} ${trainer.email}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // ── Loading Skeleton ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-11 w-64 rounded-xl" />
          <Skeleton className="h-11 w-44 rounded-xl" />
        </div>
        <div className="rounded-lg border border-border/60 dark:border-white/10 p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">Trainer-Verwaltung</h1>
          <p className="text-muted-foreground dark:text-muted-foreground mt-1 text-sm">
            Übersicht und Management aller Trainerprofile
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="md" variant="gradient" onClick={() => setShowInviteForm(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Neuer Trainer</span>
          </Button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Input
          variant="search"
          leftIcon={<Search className="h-5 w-5" />}
          placeholder="Nach Name oder E-Mail suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Alle Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="inactive">Inaktiv</SelectItem>
              <SelectItem value="on_leave">Urlaub</SelectItem>
              <SelectItem value="terminated">Beendet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Empty State ────────────────────────────────────────────────────── */}
      {filteredTrainers.length === 0 ? (
        <Card variant="flat" className="p-12 gradient-border glass text-center">
          <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-2xl bg-brandPrimary/10 mb-6 shadow-glow-primary">
            <GraduationCap className="h-10 w-10 text-brandPrimary" />
          </div>
          <h3 className="text-2xl font-bold text-brand-primary">
            {searchQuery || statusFilter !== 'all' ? 'Keine Treffer' : 'Noch keine Trainer'}
          </h3>
          <p className="text-muted-foreground dark:text-muted-foreground mt-2 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all'
              ? 'Passe deine Filterkriterien an, um Ergebnisse zu sehen.'
              : 'Füge deinen ersten Trainer hinzu, um loszulegen.'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Button
              size="lg"
              variant="gradient"
              onClick={() => setShowInviteForm(true)}
              className="mt-8"
              leftIcon={<Plus className="h-5 w-5" />}
            >
              Trainer hinzufügen
            </Button>
          )}
        </Card>
      ) : (
        /* ── Full-Width Trainer Table ─────────────────────────────────── */
        <div className="rounded-lg border border-border/60 dark:border-white/10 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">E-Mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Spezialisierungen</TableHead>
                <TableHead className="hidden lg:table-cell">Qualifikationen</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Stundensatz</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrainers.map((trainer) => (
                <TableRow
                  key={trainer.id}
                  className="hover:bg-muted/40 dark:hover:bg-background/40"
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-brandPrimary/20 to-brandPrimary/5 shrink-0">
                        <User className="h-4 w-4 text-brandPrimary" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {trainer.firstName} {trainer.lastName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground md:hidden">
                          {trainer.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {trainer.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(trainer.status)} size="sm">
                      {getStatusLabel(trainer.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {trainer.specializations.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {trainer.specializations.slice(0, 2).map((s) => (
                          <Badge key={s.id} variant="outline" size="sm">
                            {s.name}
                          </Badge>
                        ))}
                        {trainer.specializations.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{trainer.specializations.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Award className="h-3.5 w-3.5" />
                      {trainer.qualifications.length}
                    </span>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-right tabular-nums text-sm">
                    {trainer.hourlyRate ? (
                      <span className="inline-flex items-center gap-1">
                        <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                        {trainer.hourlyRate}/h
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link href={`/admin/trainers/${trainer.id}`}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Details anzeigen</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Count ──────────────────────────────────────────────────────────── */}
      {trainers.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {filteredTrainers.length} von {trainers.length} Trainern
        </p>
      )}

      {/* ── Invite Modal ──────────────────────────────────────────────────── */}
      <CenteredModal open={showInviteForm} onClose={() => setShowInviteForm(false)}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Trainer einladen</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowInviteForm(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Lade einen neuen Trainer zu deinem Verein ein
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="font-semibold">
              E-Mail-Adresse *
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="trainer@beispiel.de"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name" className="font-semibold">
              Name <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="invite-name"
              placeholder="Vor- und Nachname"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
          </div>
          <div className="bg-brandPrimary/5 border border-brandPrimary/10 p-3 rounded-lg text-sm text-muted-foreground dark:text-muted-foreground">
            Der Trainer erhält eine Einladungs-E-Mail und wird dem Verein mit der Rolle
            &quot;Trainer&quot; hinzugefügt.
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowInviteForm(false);
              setInviteEmail('');
              setInviteName('');
            }}
            disabled={inviteLoading}
            className="flex-1"
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleInviteTrainer}
            disabled={inviteLoading || !inviteEmail}
            variant="gradient"
            className="flex-1"
          >
            {inviteLoading ? 'Wird gesendet...' : 'Einladung senden'}
          </Button>
        </div>
      </CenteredModal>
    </div>
  );
}
