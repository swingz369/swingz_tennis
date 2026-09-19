'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { CenteredModal } from '@/components/ui/centered-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Calendar,
  MapPin,
  CheckCircle,
  AlertCircle,
  Edit,
  Save,
  Plus,
  Shield,
  Clock,
  Globe,
  PhoneCall,
  Trophy,
  Target,
  Briefcase,
  ArrowLeft,
  X,
  RefreshCw,
  XCircle,
  Trash2,
  Euro,
  Lock,
  Sparkles,
  Mail,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { formatDate, formatDateLong } from '@/lib/format';
import type {
  TrainerProfile,
  TrainerAvailabilitySlot,
} from '@/components/trainer-profile-management';
import { useUserRole } from '@/hooks/use-user-role';
import { useCurrentUser } from '@/hooks/use-current-user';

import { createLogger } from '@/lib/logger';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const log = createLogger('admin:trainers:[id]:trainer-detail-client');

interface WeeklyAvailabilitySlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  notes?: string;
}

interface TrainerDetailClientProps {
  trainerId: string;
}

export function TrainerDetailClient({ trainerId }: TrainerDetailClientProps) {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const { isAdmin } = useUserRole(currentUser?.roles);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<TrainerProfile>>({});
  const [availabilitySlots, setAvailabilitySlots] = useState<TrainerAvailabilitySlot[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [slotDate, setSlotDate] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('08:00');
  const [slotEndTime, setSlotEndTime] = useState('17:00');
  const [slotNotes, setSlotNotes] = useState('');
  const [slotSaving, setSlotSaving] = useState(false);
  const [weeklySlots, setWeeklySlots] = useState<WeeklyAvailabilitySlot[]>([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyDialogOpen, setWeeklyDialogOpen] = useState(false);
  const [weeklyDay, setWeeklyDay] = useState(1);
  const [weeklyStart, setWeeklyStart] = useState('08:00');
  const [weeklyEnd, setWeeklyEnd] = useState('17:00');
  const [weeklyNotes, setWeeklyNotes] = useState('');
  const [weeklySaving, setWeeklySaving] = useState(false);
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [absenceStartDate, setAbsenceStartDate] = useState('');
  const [absenceEndDate, setAbsenceEndDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('vacation');
  const [absenceSaving, setAbsenceSaving] = useState(false);

  // Trial training state
  interface TrialTraining {
    id: string;
    participant: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      dateOfBirth: string;
    };
    scheduledDate: string;
    scheduledTime: string;
    duration: number;
    trainer: { id: string; name: string };
    court: { id: string; name: string };
    status: string;
    notes?: string;
    createdAt: string;
  }
  const [trialTrainings, setTrialTrainings] = useState<TrialTraining[]>([]);
  const [trialsLoading, setTrialsLoading] = useState(false);

  const loadTrialTrainings = async (trainerUserId: string) => {
    setTrialsLoading(true);
    try {
      const res = await apiFetch(`/api/trial-trainings`);
      if (res.ok) {
        const data = await res.json();
        const all: TrialTraining[] = data.trialTrainings || [];
        setTrialTrainings(all.filter((t) => t.trainer?.id === trainerUserId));
      }
    } catch {
      // non-critical
    } finally {
      setTrialsLoading(false);
    }
  };

  const loadAllSlots = async (userId: string) => {
    setAvailLoading(true);
    setWeeklyLoading(true);
    try {
      const res = await apiFetch(`/api/trainer-availability?trainer_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        const all = data.availabilities || [];
        setAvailabilitySlots(
          all.filter(
            (a: { day_of_week?: number | null; date?: string | null; [k: string]: unknown }) =>
              !a.day_of_week && a.day_of_week !== 0 && a.date
          )
        );
        setWeeklySlots(
          all.filter(
            (a: { day_of_week?: number | null; [k: string]: unknown }) =>
              a.day_of_week !== undefined && a.day_of_week !== null
          )
        );
      }
    } catch (err) {
      log.error('Failed to load availability:', err);
    } finally {
      setAvailLoading(false);
      setWeeklyLoading(false);
    }
  };

  const loadTrainer = async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/trainer-profiles/${trainerId}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const detail = errBody.error || `HTTP ${res.status}`;
        throw new Error(`Failed to load trainer: ${detail}`);
      }
      const data = await res.json();
      setTrainer(data.trainerProfile);
      if (data.trainerProfile?.userId) {
        loadAllSlots(data.trainerProfile.userId);
        loadTrialTrainings(data.trainerProfile.userId);
      }
    } catch (err) {
      log.error('Failed to load trainer:', err);
      toast.error('Fehler beim Laden des Trainerprofils');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrainer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  const handleEdit = () => {
    if (!trainer) return;
    setEditForm({ ...trainer });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!trainer) return;
    try {
      // Strip admin-only fields for non-admin trainers to avoid a 403.
      // The PATCH handler rejects contractedHourlyRate from non-admins.
      const { contractedHourlyRate: _, ...body } = editForm;
      const payload = isAdmin ? editForm : body;

      const response = await apiFetch(`/api/trainer-profiles/${trainer.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to update trainer');
      const data = await response.json();
      setTrainer(data.trainerProfile);
      setIsEditing(false);
      toast.success('Trainerprofil erfolgreich aktualisiert');
    } catch (error) {
      toast.error('Fehler beim Aktualisieren des Trainerprofils');
      log.error('Update error:', error);
    }
  };

  const handleStatusChange = async (newStatus: TrainerProfile['status']) => {
    if (!trainer) return;
    try {
      const response = await apiFetch(`/api/trainer-profiles/${trainer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update status');
      const data = await response.json();
      setTrainer(data.trainerProfile);
      toast.success('Status aktualisiert');
    } catch (error) {
      toast.error('Fehler beim Aktualisieren des Status');
      log.error('Status update error:', error);
    }
  };

  const handleVerifyQualification = async (qualificationId: string) => {
    if (!trainer) return;
    try {
      const response = await apiFetch(
        `/api/trainer-profiles/${trainer.id}/qualifications/${qualificationId}/verify`,
        {
          method: 'POST',
          body: JSON.stringify({ verifiedBy: 'Admin' }),
        }
      );
      if (!response.ok) throw new Error('Failed to verify qualification');
      const data = await response.json();
      setTrainer(data.trainerProfile);
      toast.success('Qualifikation erfolgreich verifiziert');
    } catch (error) {
      toast.error('Fehler bei der Verifizierung');
      log.error('Verification error:', error);
    }
  };

  const handleAddWeeklySlot = async () => {
    if (!trainer) return;
    if (weeklyStart >= weeklyEnd) {
      toast.error('Startzeit muss vor Endzeit liegen');
      return;
    }
    setWeeklySaving(true);
    try {
      const res = await apiFetch('/api/trainer-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: trainer.userId,
          day_of_week: weeklyDay,
          start_time: weeklyStart,
          end_time: weeklyEnd,
          is_available: true,
          notes: weeklyNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'Fehler beim Speichern');
      }
      toast.success('Wöchentliche Verfügbarkeit hinzugefügt');
      setWeeklyDialogOpen(false);
      setWeeklyStart('08:00');
      setWeeklyEnd('17:00');
      setWeeklyNotes('');
      loadAllSlots(trainer.userId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setWeeklySaving(false);
    }
  };

  const handleDeleteWeeklySlot = async (slotId: string) => {
    if (!trainer) return;
    try {
      const res = await apiFetch(`/api/trainer-availability?id=${slotId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Fehler beim Löschen');
      toast.success('Verfügbarkeit gelöscht');
      loadAllSlots(trainer.userId);
    } catch {
      toast.error('Fehler beim Löschen der Verfügbarkeit');
    }
  };

  const handleAddSlot = async () => {
    if (!trainer || !slotDate || !slotStartTime || !slotEndTime) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    if (slotStartTime >= slotEndTime) {
      toast.error('Startzeit muss vor Endzeit liegen');
      return;
    }
    setSlotSaving(true);
    try {
      const res = await apiFetch('/api/trainer-availability', {
        method: 'POST',
        body: JSON.stringify({
          trainer_id: trainer.userId,
          date: slotDate,
          start_time: slotStartTime,
          end_time: slotEndTime,
          status: 'available',
          notes: slotNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'Fehler beim Speichern');
      }
      toast.success('Verfügbarkeit hinzugefügt');
      setSlotDialogOpen(false);
      setSlotDate('');
      setSlotStartTime('08:00');
      setSlotEndTime('17:00');
      setSlotNotes('');
      loadAllSlots(trainer.userId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSlotSaving(false);
    }
  };

  const handleAddAbsence = async () => {
    if (!trainer) return;
    if (!absenceStartDate || !absenceEndDate) {
      toast.error('Bitte Start- und Enddatum auswählen');
      return;
    }
    if (absenceStartDate > absenceEndDate) {
      toast.error('Startdatum muss vor Enddatum liegen');
      return;
    }
    setAbsenceSaving(true);
    try {
      const res = await apiFetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId: trainer.id,
          trainerName: `${trainer.firstName} ${trainer.lastName}`.trim(),
          type: absenceReason,
          startDate: absenceStartDate,
          endDate: absenceEndDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'Fehler beim Speichern');
      }
      toast.success('Abwesenheit erfolgreich eingetragen');
      setAbsenceDialogOpen(false);
      setAbsenceStartDate('');
      setAbsenceEndDate('');
      setAbsenceReason('vacation');
      setTrainer((prev) => (prev ? { ...prev, status: 'on_leave' as const } : null));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setAbsenceSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!trainer) return;
    try {
      const res = await apiFetch(`/api/trainer-availability?id=${slotId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Fehler beim Löschen');
      toast.success('Verfügbarkeit gelöscht');
      loadAllSlots(trainer.userId);
    } catch {
      toast.error('Fehler beim Löschen der Verfügbarkeit');
    }
  };

  const getSpecializationVariant = (
    level: string
  ): 'info' | 'success' | 'accent' | 'default' | 'outline' => {
    switch (level) {
      case 'beginner':
        return 'info';
      case 'intermediate':
        return 'success';
      case 'advanced':
        return 'accent';
      case 'professional':
        return 'default';
      default:
        return 'outline';
    }
  };

  const weekDays = [
    { value: 1, label: 'Montag', short: 'Mo' },
    { value: 2, label: 'Dienstag', short: 'Di' },
    { value: 3, label: 'Mittwoch', short: 'Mi' },
    { value: 4, label: 'Donnerstag', short: 'Do' },
    { value: 5, label: 'Freitag', short: 'Fr' },
    { value: 6, label: 'Samstag', short: 'Sa' },
    { value: 0, label: 'Sonntag', short: 'So' },
  ];

  const getWeeklySlotsForDay = (dayOfWeek: number) =>
    weeklySlots.filter((s) => s.day_of_week === dayOfWeek);

  // ── Loading Skeleton ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm">
          <Skeleton className="h-3.5 w-14 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>

        <div className="bg-background dark:bg-surface-dark rounded-xl border border-border dark:border-white/10 shadow-sm overflow-hidden">
          {/* Header skeleton */}
          <div className="p-5 border-b border-border dark:border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-7 w-48 rounded" />
                <Skeleton className="h-4 w-56 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
            </div>
          </div>

          {/* Tabs skeleton */}
          <div className="p-5 space-y-5">
            <div className="flex gap-6 border-b pb-3">
              <Skeleton className="h-4 w-12 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>

            {/* Personal info card skeleton */}
            <div className="rounded-xl border border-border p-5 space-y-4">
              <Skeleton className="h-5 w-44 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-5 w-full rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency contact card skeleton */}
            <div className="rounded-xl border border-border p-5 space-y-4">
              <Skeleton className="h-5 w-36 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-5 w-full rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Honorar card skeleton */}
            <div className="rounded-xl border border-border p-5 space-y-4">
              <Skeleton className="h-5 w-24 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-36 rounded" />
                  <Skeleton className="h-6 w-28 rounded" />
                  <Skeleton className="h-3 w-64 rounded" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-40 rounded" />
                  <Skeleton className="h-6 w-28 rounded" />
                  <Skeleton className="h-3 w-56 rounded" />
                </div>
              </div>
            </div>

            {/* Languages card skeleton */}
            <div className="rounded-xl border border-border p-5 space-y-3">
              <Skeleton className="h-5 w-24 rounded" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="p-6 text-muted-foreground">
        <Button variant="ghost" onClick={() => router.push('/admin/trainers')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zur Trainerliste
        </Button>
        <p className="mt-4">Trainer nicht gefunden.</p>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <Breadcrumb
        items={[
          { label: 'Trainer-Verwaltung', href: '/admin/trainers' },
          { label: `${trainer.firstName} ${trainer.lastName}` },
        ]}
        className="mb-4"
      />

      <div className="bg-background dark:bg-surface-dark rounded-xl border border-border dark:border-white/10 shadow-sm overflow-hidden animate-in">
        {/* ── Detail Header ────────────────────────────────────────────── */}
        <div className="p-5 border-b border-border dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div>
                <h2 className="text-xl md:text-2xl font-semibold text-foreground truncate">
                  {trainer.firstName} {trainer.lastName}
                </h2>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground truncate">
                  {trainer.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <StatusBadge status={trainer.status} size="lg" />
              {!isEditing && (
                <Button onClick={handleEdit} variant="primary" size="sm" className="gap-1.5">
                  <Edit className="h-4 w-4" />
                  Bearbeiten
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Detail Body ──────────────────────────────────────────────── */}
        <div className="p-5">
          <Tabs defaultValue="profile" className="space-y-5">
            <TabsList className="w-full justify-start bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b rounded-none px-0 gap-6 overflow-x-auto sticky top-0 z-20">
              <TabsTrigger
                value="profile"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Profil
              </TabsTrigger>
              <TabsTrigger
                value="qualifications"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Qualifikationen ({trainer.qualifications.length})
              </TabsTrigger>
              <TabsTrigger
                value="experience"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Erfahrung
              </TabsTrigger>
              <TabsTrigger
                value="availability"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Verfügbarkeit ({weeklySlots.length + availabilitySlots.length})
              </TabsTrigger>
              <TabsTrigger
                value="trials"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Probetrainings ({trialTrainings.length})
              </TabsTrigger>
            </TabsList>

            {/* ── Profile Tab ──────────────────────────────────────────── */}
            <TabsContent value="profile" className="space-y-6 animate-in">
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-primary" />
                    Persönliche Informationen
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Vorname</Label>
                      {isEditing ? (
                        <Input
                          value={editForm.firstName || ''}
                          onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        />
                      ) : (
                        <div className="font-medium">{trainer.firstName}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Nachname</Label>
                      {isEditing ? (
                        <Input
                          value={editForm.lastName || ''}
                          onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        />
                      ) : (
                        <div className="font-medium">{trainer.lastName}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">E-Mail</Label>
                      {isEditing ? (
                        <Input
                          value={editForm.email || ''}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                      ) : (
                        <div className="font-medium">{trainer.email}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Telefon</Label>
                      {isEditing ? (
                        <Input
                          value={editForm.phone || ''}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        />
                      ) : (
                        <div className="font-medium">{trainer.phone}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Geburtsdatum</Label>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editForm.dateOfBirth || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, dateOfBirth: e.target.value })
                          }
                        />
                      ) : (
                        <div className="font-medium">{formatDateLong(trainer.dateOfBirth)}</div>
                      )}
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Bio</Label>
                      {isEditing ? (
                        <Textarea
                          value={editForm.bio || ''}
                          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                          rows={3}
                          className="resize-none"
                        />
                      ) : (
                        <div className="text-foreground dark:text-foreground text-sm">
                          {trainer.bio || 'Keine Bio vorhanden'}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <PhoneCall className="h-4 w-4 text-brand-accent" />
                    Notfallkontakt
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      {isEditing ? (
                        <Input
                          value={editForm.emergencyContact?.name || ''}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              emergencyContact: {
                                name: e.target.value,
                                phone: editForm.emergencyContact?.phone || '',
                                relationship: editForm.emergencyContact?.relationship || '',
                              },
                            })
                          }
                        />
                      ) : (
                        <div className="font-medium">{trainer.emergencyContact.name}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Telefon</Label>
                      {isEditing ? (
                        <Input
                          value={editForm.emergencyContact?.phone || ''}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              emergencyContact: {
                                name: editForm.emergencyContact?.name || '',
                                phone: e.target.value,
                                relationship: editForm.emergencyContact?.relationship || '',
                              },
                            })
                          }
                        />
                      ) : (
                        <div className="font-medium">{trainer.emergencyContact.phone}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Beziehung</Label>
                      {isEditing ? (
                        <Input
                          value={editForm.emergencyContact?.relationship || ''}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              emergencyContact: {
                                name: editForm.emergencyContact?.name || '',
                                phone: editForm.emergencyContact?.phone || '',
                                relationship: e.target.value,
                              },
                            })
                          }
                        />
                      ) : (
                        <div className="font-medium">{trainer.emergencyContact.relationship}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-base">
                    <Euro className="h-4 w-4 text-brand-accent" />
                    Honorar
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* contracted_hourly_rate — admin-only */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        Vertragssatz (EUR/h)
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </Label>
                      {isEditing && isAdmin ? (
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={editForm.contractedHourlyRate ?? ''}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              contractedHourlyRate: e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            })
                          }
                          placeholder="z.B. 45.00"
                        />
                      ) : isEditing && !isAdmin ? (
                        <div className="font-medium flex items-center gap-1.5 text-muted-foreground">
                          {trainer.contractedHourlyRate != null
                            ? `${trainer.contractedHourlyRate.toFixed(2)} €/h`
                            : 'Nicht festgelegt'}
                          <span className="text-xs italic">(nur Admin)</span>
                        </div>
                      ) : (
                        <div className="font-medium">
                          {trainer.contractedHourlyRate != null
                            ? `${trainer.contractedHourlyRate.toFixed(2)} €/h`
                            : 'Nicht festgelegt'}
                        </div>
                      )}
                      <p className="text-2xs text-muted-foreground">
                        Vertraglich vereinbarter Stundensatz. Nur durch Admins änderbar.
                      </p>
                    </div>

                    {/* extra_hours_rate — admin + trainer editable */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Zusatzstunden-Satz (EUR/h)
                      </Label>
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={editForm.extraHoursRate ?? ''}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              extraHoursRate: e.target.value ? parseFloat(e.target.value) : null,
                            })
                          }
                          placeholder="z.B. 50.00"
                        />
                      ) : (
                        <div className="font-medium">
                          {trainer.extraHoursRate != null
                            ? `${trainer.extraHoursRate.toFixed(2)} €/h`
                            : 'Nicht festgelegt'}
                        </div>
                      )}
                      <p className="text-2xs text-muted-foreground">
                        {isAdmin
                          ? 'Satz für Zusatzstunden. Trainer kann diesen ebenfalls anpassen.'
                          : 'Du kannst diesen Satz selbst für deine Zusatzstunden festlegen.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-base">
                    <Globe className="h-4 w-4 text-primary" />
                    Sprachen
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {trainer.languages.length > 0 ? (
                      trainer.languages.map((lang, index) => (
                        <Badge key={index} variant="secondary">
                          {lang}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Keine Sprachen angegeben
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Qualifications Tab ───────────────────────────────────── */}
            <TabsContent value="qualifications" className="space-y-5 animate-in">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Zertifikate & Qualifikationen</h3>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Hinzufügen
                </Button>
              </div>
              {trainer.qualifications.length > 0 ? (
                <div className="space-y-3">
                  {trainer.qualifications.map((qual) => (
                    <Card key={qual.id} variant="flat">
                      <CardContent className="p-4 flex flex-col md:flex-row items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-semibold">{qual.name}</h4>
                            {qual.verified ? (
                              <Badge variant="success" className="gap-1 text-xs">
                                <CheckCircle className="h-3 w-3" /> Verifiziert
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="gap-1 text-xs">
                                <AlertCircle className="h-3 w-3" /> Ausstehend
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground dark:text-muted-foreground">
                            <div>
                              <span className="font-medium text-foreground">Aussteller:</span>{' '}
                              {qual.issuer}
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Ausgestellt:</span>{' '}
                              {formatDateLong(qual.issuedDate)}
                            </div>
                            {qual.expiryDate && (
                              <div>
                                <span className="font-medium text-foreground">Gültig bis:</span>{' '}
                                {formatDateLong(qual.expiryDate)}
                              </div>
                            )}
                            {qual.verifiedAt && (
                              <div>
                                <span className="font-medium text-foreground">Verifiziert am:</span>{' '}
                                {formatDateLong(qual.verifiedAt)}
                              </div>
                            )}
                          </div>
                        </div>
                        {!qual.verified && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleVerifyQualification(qual.id)}
                            className="shrink-0"
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Bestätigen
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Noch keine Qualifikationen vorhanden
                </div>
              )}

              <div className="pt-2">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-brand-accent" />
                  Spezialisierungen
                </h3>
                <div className="flex flex-wrap gap-2">
                  {trainer.specializations.length > 0 ? (
                    trainer.specializations.map((spec) => (
                      <Badge key={spec.id} variant={getSpecializationVariant(spec.level)} size="lg">
                        {spec.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Keine Spezialisierungen</span>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── Experience Tab ───────────────────────────────────────── */}
            <TabsContent value="experience" className="space-y-5 animate-in">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Berufserfahrung
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card variant="elevated">
                  <CardContent className="p-5 text-center">
                    <p className="text-muted-foreground dark:text-muted-foreground text-sm mb-1">
                      Branchenerfahrung
                    </p>
                    <div className="text-3xl font-bold tabular-nums text-foreground dark:text-white tabular-nums">
                      {trainer.experience.years} <span className="text-xl">Jahre</span>
                    </div>
                  </CardContent>
                </Card>
                <Card variant="elevated">
                  <CardContent className="p-5 text-center">
                    <p className="text-muted-foreground dark:text-muted-foreground text-sm mb-1">
                      Vorherige Vereine
                    </p>
                    <div className="text-3xl font-bold tabular-nums text-foreground dark:text-white tabular-nums">
                      {trainer.experience.previousClubs.length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card variant="bordered">
                  <CardContent className="p-5">
                    <h4 className="font-semibold mb-3">Ehemalige Stationen</h4>
                    {trainer.experience.previousClubs.length > 0 ? (
                      <div className="space-y-2">
                        {trainer.experience.previousClubs.map((club, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 text-foreground dark:text-foreground text-sm"
                          >
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>{club}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Keine vorherigen Stationen</p>
                    )}
                  </CardContent>
                </Card>

                <Card variant="bordered">
                  <CardContent className="p-5">
                    <h4 className="font-semibold mb-3">Größte Erfolge</h4>
                    {trainer.experience.achievements.length > 0 ? (
                      <div className="space-y-2">
                        {trainer.experience.achievements.map((achievement, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 text-foreground dark:text-foreground text-sm"
                          >
                            <Trophy className="h-4 w-4 text-brand-accent shrink-0" />
                            <span>{achievement}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Keine Erfolge eingetragen</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Availability Tab ─────────────────────────────────────── */}
            <TabsContent value="availability" className="space-y-6 animate-in">
              <Card variant="flat">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2 text-base">
                      <Calendar className="h-4 w-4 text-primary" />
                      Reguläre Wochenverfügbarkeit
                    </h3>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => loadAllSlots(trainer.userId)}
                            disabled={weeklyLoading}
                            aria-label="Aktualisieren"
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${weeklyLoading ? 'animate-spin' : ''}`}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Aktualisieren</TooltipContent>
                      </Tooltip>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWeeklyDialogOpen(true)}
                        className="gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Zeitfenster hinzufügen
                      </Button>
                    </div>
                  </div>
                  {weeklyLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : weeklySlots.length > 0 ? (
                    <div className="space-y-3">
                      {weekDays.map((day) => {
                        const daySlots = getWeeklySlotsForDay(day.value);
                        if (daySlots.length === 0) return null;
                        return (
                          <div key={day.value} className="border rounded-xl p-3">
                            <h4 className="font-semibold text-sm text-primary mb-2">{day.label}</h4>
                            <div className="space-y-2">
                              {daySlots.map((slot) => (
                                <div
                                  key={slot.id}
                                  className="flex items-center justify-between bg-success-50 border border-success-200 rounded p-3"
                                >
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-success-600" />
                                    <span className="font-medium text-sm">
                                      {slot.start_time} – {slot.end_time}
                                    </span>
                                    <Badge variant="success" size="sm">
                                      Verfügbar
                                    </Badge>
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => slot.id && handleDeleteWeeklySlot(slot.id)}
                                        aria-label="Löschen"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-error-400 hover:text-error-600" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Löschen</TooltipContent>
                                  </Tooltip>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Keine wöchentlichen Verfügbarkeiten eingetragen.
                      <br />
                      <span className="text-xs">
                        Klicke auf &quot;Zeitfenster hinzufügen&quot; um eine regelmäßige
                        Verfügbarkeit zu hinterlegen.
                      </span>
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Weekly Slot Dialog */}
              <CenteredModal open={weeklyDialogOpen} onClose={() => setWeeklyDialogOpen(false)}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Neue wöchentliche Verfügbarkeit</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setWeeklyDialogOpen(false)}
                        aria-label="Schließen"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Schließen</TooltipContent>
                  </Tooltip>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Wochentag</Label>
                    <Select
                      value={String(weeklyDay)}
                      onValueChange={(v) => setWeeklyDay(parseInt(v))}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {weekDays.map((day) => (
                          <SelectItem key={day.value} value={String(day.value)}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Startzeit</Label>
                      <Input
                        type="time"
                        value={weeklyStart}
                        onChange={(e) => setWeeklyStart(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Endzeit</Label>
                      <Input
                        type="time"
                        value={weeklyEnd}
                        onChange={(e) => setWeeklyEnd(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notizen (optional)</Label>
                    <Input
                      value={weeklyNotes}
                      onChange={(e) => setWeeklyNotes(e.target.value)}
                      placeholder="z.B. Nur Anfängertraining"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setWeeklyDialogOpen(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button className="flex-1" onClick={handleAddWeeklySlot} disabled={weeklySaving}>
                    {weeklySaving ? 'Speichern...' : 'Hinzufügen'}
                  </Button>
                </div>
              </CenteredModal>

              <Card variant="flat">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2 text-base">
                      <Clock className="h-4 w-4 text-brand-accent" />
                      Konkrete Verfügbarkeiten
                    </h3>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => loadAllSlots(trainer.userId)}
                            disabled={availLoading}
                            aria-label="Aktualisieren"
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${availLoading ? 'animate-spin' : ''}`}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Aktualisieren</TooltipContent>
                      </Tooltip>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSlotDialogOpen(true)}
                        className="gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Slot hinzufügen
                      </Button>
                    </div>
                  </div>
                  {availLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : availabilitySlots.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availabilitySlots.slice(0, 20).map((slot) => (
                        <div
                          key={slot.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${
                            slot.status === 'available'
                              ? 'bg-success-50 border-success-200'
                              : slot.status === 'booked'
                                ? 'bg-info-50 border-info-200'
                                : slot.status === 'blocked'
                                  ? 'bg-error-50 border-error-200'
                                  : 'bg-muted border-border dark:bg-card/10 dark:border-border'
                          }`}
                        >
                          <div className="shrink-0">
                            {slot.status === 'available' ? (
                              <CheckCircle className="h-4 w-4 text-success-500" />
                            ) : slot.status === 'booked' ? (
                              <Calendar className="h-4 w-4 text-info-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-error-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs truncate">{formatDate(slot.date)}</p>
                            <p className="text-xs text-muted-foreground">
                              {slot.startTime} - {slot.endTime}
                              <span className="ml-2 capitalize">({slot.status})</span>
                            </p>
                          </div>
                          {slot.status !== 'booked' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  onClick={() => handleDeleteSlot(slot.id)}
                                  aria-label="Löschen"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-error-400 hover:text-error-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Löschen</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Keine konkreten Verfügbarkeiten eingetragen.
                      <br />
                      <span className="text-xs">
                        Klicke auf &quot;Slot hinzufügen&quot; um eine Verfügbarkeit zu erstellen.
                      </span>
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Add Slot Dialog */}
              <CenteredModal open={slotDialogOpen} onClose={() => setSlotDialogOpen(false)}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Neue Verfügbarkeit</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSlotDialogOpen(false)}
                        aria-label="Schließen"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Schließen</TooltipContent>
                  </Tooltip>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Datum</Label>
                    <Input
                      type="date"
                      value={slotDate}
                      onChange={(e) => setSlotDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Startzeit</Label>
                      <Input
                        type="time"
                        value={slotStartTime}
                        onChange={(e) => setSlotStartTime(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Endzeit</Label>
                      <Input
                        type="time"
                        value={slotEndTime}
                        onChange={(e) => setSlotEndTime(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notizen (optional)</Label>
                    <Input
                      value={slotNotes}
                      onChange={(e) => setSlotNotes(e.target.value)}
                      placeholder="z.B. Nur Anfängertraining"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSlotDialogOpen(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleAddSlot}
                    disabled={slotSaving || !slotDate}
                  >
                    {slotSaving ? 'Speichern...' : 'Hinzufügen'}
                  </Button>
                </div>
              </CenteredModal>

              <Card variant="flat">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-brand-accent" />
                    Bevorzugte Arbeitszeiten
                  </h3>
                  {trainer.preferredTimeSlots.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {trainer.preferredTimeSlots.map((slot, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 bg-background dark:bg-background p-3 rounded-xl border shadow-sm text-sm"
                        >
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">
                            {slot.start} – {slot.end}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Keine bevorzugten Zeiten angegeben
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Trial Trainings Tab ───────────────────────────────────── */}
            <TabsContent value="trials" className="space-y-5 animate-in">
              <Card variant="flat">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-brand-accent" />
                      Probetrainings
                    </h3>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => trainer && loadTrialTrainings(trainer.userId)}
                          disabled={trialsLoading}
                          aria-label="Aktualisieren"
                        >
                          <RefreshCw className={`h-4 w-4 ${trialsLoading ? 'animate-spin' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Aktualisieren</TooltipContent>
                    </Tooltip>
                  </div>
                  {trialsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : trialTrainings.length > 0 ? (
                    <div className="space-y-3">
                      {trialTrainings.map((trial) => (
                        <div
                          key={trial.id}
                          className={`p-4 rounded-xl border text-sm ${
                            trial.status === 'requested'
                              ? 'bg-warning-50 border-warning-200'
                              : trial.status === 'scheduled'
                                ? 'bg-success-50 border-success-200'
                                : 'bg-error-50 border-error-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">
                                  {trial.participant.firstName} {trial.participant.lastName}
                                </span>
                                <Badge
                                  className={`text-xs ${
                                    trial.status === 'requested'
                                      ? 'bg-warning-100 text-warning-700 border-warning-200'
                                      : trial.status === 'scheduled'
                                        ? 'bg-success-100 text-success-700 border-success-200'
                                        : 'bg-error-100 text-error-700 border-error-200'
                                  }`}
                                >
                                  {trial.status === 'requested'
                                    ? 'Angefragt'
                                    : trial.status === 'scheduled'
                                      ? 'Geplant'
                                      : 'Abgelehnt'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {formatDateLong(trial.scheduledDate)} um {trial.scheduledTime} Uhr
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {trial.duration} Min.
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {trial.participant.email}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {trial.participant.phone}
                                </span>
                                {trial.court?.name && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {trial.court.name}
                                  </span>
                                )}
                              </div>
                              {trial.notes && (
                                <p className="text-xs text-muted-foreground bg-background/50 p-2 rounded border border-border/50">
                                  {trial.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Keine Probetrainings zugewiesen</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Detail Footer ─────────────────────────────────────────────── */}
        <div className="p-5 bg-muted dark:bg-black/10 border-t border-border dark:border-white/10 flex flex-col sm:flex-row gap-3 items-center justify-between">
          {isEditing ? (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditForm(trainer);
                }}
                className="flex-1 sm:flex-initial"
              >
                Abbrechen
              </Button>
              <Button onClick={handleSave} variant="primary" className="flex-1 sm:flex-initial">
                <Save className="h-4 w-4 mr-2" />
                Speichern
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              {trainer.status === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAbsenceDialogOpen(true)}
                  className="flex-1 sm:flex-initial"
                >
                  Urlaub eintragen
                </Button>
              )}
              {trainer.status !== 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('active')}
                  className="flex-1 sm:flex-initial"
                >
                  Aktivieren
                </Button>
              )}
              {trainer.status !== 'terminated' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('inactive')}
                  className="flex-1 sm:flex-initial"
                >
                  Deaktivieren
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Absence Dialog ──────────────────────────────────────────────── */}
      <CenteredModal open={absenceDialogOpen} onClose={() => setAbsenceDialogOpen(false)}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Abwesenheit eintragen</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setAbsenceDialogOpen(false)}
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Schließen</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-sm text-muted-foreground">
          Trainer: {trainer.firstName} {trainer.lastName}
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Von *</Label>
              <Input
                type="date"
                value={absenceStartDate}
                onChange={(e) => setAbsenceStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Bis *</Label>
              <Input
                type="date"
                value={absenceEndDate}
                onChange={(e) => setAbsenceEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Grund</Label>
            <Select value={absenceReason} onValueChange={setAbsenceReason}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">Urlaub</SelectItem>
                <SelectItem value="sick">Krankheit</SelectItem>
                <SelectItem value="personal">Persönlich</SelectItem>
                <SelectItem value="other">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => setAbsenceDialogOpen(false)}>
            Abbrechen
          </Button>
          <Button
            className="flex-1"
            onClick={handleAddAbsence}
            disabled={absenceSaving || !absenceStartDate || !absenceEndDate}
          >
            {absenceSaving ? 'Speichern...' : 'Eintragen'}
          </Button>
        </div>
      </CenteredModal>
    </div>
  );
}
