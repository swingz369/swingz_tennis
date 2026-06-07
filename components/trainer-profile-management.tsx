'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from '@/lib/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

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
  Award,
  CheckCircle,
  AlertCircle,
  Edit,
  Save,
  Plus,
  Download,
  Search,
  Shield,
  Clock,
  Globe,
  PhoneCall,
  GraduationCap,
  Trophy,
  Target,
  Briefcase,
  Euro,
  ArrowLeft,
  X,
  RefreshCw,
  XCircle,
  Trash2,
} from 'lucide-react';
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

interface WeeklyAvailabilitySlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
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

export default function TrainerProfileManagement({ clubId }: { clubId: string }) {
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState<TrainerProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [editForm, setEditForm] = useState<Partial<TrainerProfile>>({});
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
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

  useEffect(() => {
    loadTrainers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch all availability slots when a trainer is selected (single API call)
  useEffect(() => {
    if (!selectedTrainer) {
      setAvailabilitySlots([]);
      setWeeklySlots([]);
      return;
    }
    loadAllSlots(selectedTrainer.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrainer?.userId]);

  const loadAllSlots = async (trainerId: string) => {
    setAvailLoading(true);
    setWeeklyLoading(true);
    try {
      const res = await apiFetch(`/api/trainer-availability?trainer_id=${trainerId}`);
      if (res.ok) {
        const data = await res.json();
        const all = data.availabilities || [];
        // Date-specific slots: have a date but no day_of_week
        setAvailabilitySlots(
          all.filter((a: any) => !a.day_of_week && a.day_of_week !== 0 && a.date)
        );
        // Weekly recurring slots: have day_of_week set
        setWeeklySlots(
          all.filter((a: any) => a.day_of_week !== undefined && a.day_of_week !== null)
        );
      }
    } catch (err) {
      console.error('Failed to load availability:', err);
    } finally {
      setAvailLoading(false);
      setWeeklyLoading(false);
    }
  };

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
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleEdit = (trainer: TrainerProfile) => {
    setEditForm({ ...trainer });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedTrainer) return;

    try {
      const response = await apiFetch(`/api/trainer-profiles/${selectedTrainer.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error('Failed to update trainer');
      }

      const data = await response.json();

      setTrainers((prev) =>
        prev.map((t) => (t.id === selectedTrainer.id ? data.trainerProfile : t))
      );

      setSelectedTrainer(data.trainerProfile);
      setIsEditing(false);
      toast.success('Trainerprofil erfolgreich aktualisiert');
    } catch (error) {
      toast.error('Fehler beim Aktualisieren des Trainerprofils');
      console.error('Update error:', error);
    }
  };

  const handleStatusChange = async (trainerId: string, newStatus: TrainerProfile['status']) => {
    try {
      const response = await apiFetch(`/api/trainer-profiles/${trainerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const data = await response.json();

      setTrainers((prev) => prev.map((t) => (t.id === trainerId ? data.trainerProfile : t)));

      if (selectedTrainer?.id === trainerId) {
        setSelectedTrainer(data.trainerProfile);
      }

      toast.success(`Status aktualisiert`);
    } catch (error) {
      toast.error('Fehler beim Aktualisieren des Status');
      console.error('Status update error:', error);
    }
  };

  const handleVerifyQualification = async (qualificationId: string) => {
    if (!selectedTrainer) return;

    try {
      const response = await apiFetch(
        `/api/trainer-profiles/${selectedTrainer.id}/qualifications/${qualificationId}/verify`,
        {
          method: 'POST',
          body: JSON.stringify({ verifiedBy: 'Admin' }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to verify qualification');
      }

      const data = await response.json();

      setSelectedTrainer(data.trainerProfile);
      setTrainers((prev) =>
        prev.map((t) => (t.id === selectedTrainer.id ? data.trainerProfile : t))
      );

      toast.success('Qualifikation erfolgreich verifiziert');
    } catch (error) {
      toast.error('Fehler bei der Verifizierung');
      console.error('Verification error:', error);
    }
  };

  const handleCloseDetail = () => {
    setSelectedTrainer(null);
    setIsEditing(false);
  };

  // Add a weekly availability slot
  const handleAddWeeklySlot = async () => {
    if (!selectedTrainer) return;
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
          trainer_id: selectedTrainer.userId,
          day_of_week: weeklyDay,
          start_time: weeklyStart,
          end_time: weeklyEnd,
          is_available: true,
          notes: weeklyNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Speichern');
      }
      toast.success('Wöchentliche Verfügbarkeit hinzugefügt');
      setWeeklyDialogOpen(false);
      setWeeklyStart('08:00');
      setWeeklyEnd('17:00');
      setWeeklyNotes('');
      loadAllSlots(selectedTrainer.userId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setWeeklySaving(false);
    }
  };

  // Delete a weekly availability slot
  const handleDeleteWeeklySlot = async (slotId: string) => {
    if (!selectedTrainer) return;
    try {
      const res = await apiFetch(`/api/trainer-availability?id=${slotId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Fehler beim Löschen');
      toast.success('Verfügbarkeit gelöscht');
      loadAllSlots(selectedTrainer.userId);
    } catch {
      toast.error('Fehler beim Löschen der Verfügbarkeit');
    }
  };

  // Add a concrete availability slot
  const handleAddSlot = async () => {
    if (!selectedTrainer || !slotDate || !slotStartTime || !slotEndTime) {
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
          trainer_id: selectedTrainer.userId,
          date: slotDate,
          start_time: slotStartTime,
          end_time: slotEndTime,
          status: 'available',
          notes: slotNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Speichern');
      }
      toast.success('Verfügbarkeit hinzugefügt');
      setSlotDialogOpen(false);
      setSlotDate('');
      setSlotStartTime('08:00');
      setSlotEndTime('17:00');
      setSlotNotes('');
      loadAllSlots(selectedTrainer.userId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSlotSaving(false);
    }
  };

  // Submit a trainer absence via /api/trainer-absences
  const handleAddAbsence = async () => {
    if (!selectedTrainer) return;
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
      const res = await apiFetch('/api/trainer-absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: selectedTrainer.userId,
          club_id: clubId,
          start_date: absenceStartDate,
          end_date: absenceEndDate,
          reason: absenceReason,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Speichern');
      }
      toast.success('Abwesenheit erfolgreich eingetragen');
      setAbsenceDialogOpen(false);
      setAbsenceStartDate('');
      setAbsenceEndDate('');
      setAbsenceReason('vacation');
      // Update trainer status to on_leave and refresh the list
      setTrainers((prev) =>
        prev.map((t) => (t.id === selectedTrainer.id ? { ...t, status: 'on_leave' as const } : t))
      );
      setSelectedTrainer((prev) => (prev ? { ...prev, status: 'on_leave' as const } : null));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setAbsenceSaving(false);
    }
  };

  // Delete a concrete availability slot
  const handleDeleteSlot = async (slotId: string) => {
    if (!selectedTrainer) return;
    try {
      const res = await apiFetch(`/api/trainer-availability?id=${slotId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Fehler beim Löschen');
      toast.success('Verfügbarkeit gelöscht');
      loadAllSlots(selectedTrainer.userId);
    } catch {
      toast.error('Fehler beim Löschen der Verfügbarkeit');
    }
  };

  // Design-system conform variant mappers
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

  const filteredTrainers = trainers.filter((trainer) => {
    const matchesStatus = statusFilter === 'all' || trainer.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      `${trainer.firstName} ${trainer.lastName} ${trainer.email}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

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
      <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-xl" />
          </div>
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-11 w-64 rounded-xl" />
          <Skeleton className="h-11 w-44 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} variant="elevated" padding="md">
              <div className="flex items-start gap-4">
                <Skeleton className="h-14 w-14 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-44" />
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left Panel: Trainer List ────────────────────────────────────────── */}
        <div
          className={`w-full lg:w-[440px] xl:w-[520px] shrink-0 space-y-6 ${
            selectedTrainer ? 'hidden lg:block' : ''
          }`}
        >
          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">
                Trainer-Verwaltung
              </h1>
              <p className="text-muted-foreground dark:text-muted-foreground mt-1 text-sm">
                Übersicht und Management aller Trainerprofile
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="md">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Export</span>
              </Button>
              <Button
                size="md"
                variant="gradient"
                onClick={() => {
                  setShowInviteForm(true);
                  setSelectedTrainer(null);
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Neuer Trainer</span>
              </Button>
            </div>
          </div>

          {/* ── Filters ──────────────────────────────────────────────────────── */}
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

          {/* ── Empty State ──────────────────────────────────────────────────── */}
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
                  onClick={() => {
                    setShowInviteForm(true);
                    setSelectedTrainer(null);
                  }}
                  className="mt-8"
                  leftIcon={<Plus className="h-5 w-5" />}
                >
                  Trainer hinzufügen
                </Button>
              )}
            </Card>
          ) : (
            /* ── Trainer Card Grid ──────────────────────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredTrainers.map((trainer, i) => {
                const isSelected = selectedTrainer?.id === trainer.id;
                const delayClass = `animate-in-delay-${(i % 5) + 1}`;
                return (
                  <Card
                    key={trainer.id}
                    variant={isSelected ? 'gradient' : 'elevated'}
                    className={`cursor-pointer hover-lift animate-in ${delayClass} transition-all duration-200 ${
                      isSelected ? 'ring-2 ring-brandPrimary/50 shadow-md' : ''
                    }`}
                    onClick={() => setSelectedTrainer(trainer)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-brandPrimary/20 to-brandPrimary/5 shadow-sm shrink-0">
                            <User className="h-6 w-6 text-brandPrimary" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base truncate">
                              {trainer.firstName} {trainer.lastName}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground truncate">
                              {trainer.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant={getStatusVariant(trainer.status)} size="sm">
                          {getStatusLabel(trainer.status)}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-xs text-muted-foreground dark:text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Award className="h-3.5 w-3.5 shrink-0" />
                          <span>{trainer.qualifications.length} Qualifikationen</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="h-3.5 w-3.5 shrink-0" />
                          <span>{trainer.specializations.length} Spezialisierungen</span>
                        </div>
                        {trainer.hourlyRate && (
                          <div className="flex items-center gap-2">
                            <Euro className="h-3.5 w-3.5 shrink-0" />
                            <span>€{trainer.hourlyRate}/h</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Count ────────────────────────────────────────────────────────── */}
          {trainers.length > 0 && !selectedTrainer && (
            <p className="text-sm text-muted-foreground text-center">
              {filteredTrainers.length} von {trainers.length} Trainern
            </p>
          )}
        </div>

        {/* ── Right Panel: Trainer Detail ────────────────────────────────────── */}
        <div className={`flex-1 min-w-0 ${!selectedTrainer ? 'hidden lg:block' : ''}`}>
          {selectedTrainer ? (
            <div className="bg-background dark:bg-surface-dark rounded-2xl border border-border dark:border-white/10 shadow-sm overflow-hidden animate-in">
              {/* ── Detail Header ────────────────────────────────────────────── */}
              <div className="p-5 border-b border-border dark:border-white/10 bg-gradient-to-r from-brandPrimary/5 to-transparent">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 lg:hidden"
                      onClick={handleCloseDetail}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 hidden lg:inline-flex text-muted-foreground hover:text-muted-foreground"
                      onClick={handleCloseDetail}
                      title="Schließen"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-foreground dark:text-white truncate">
                        {selectedTrainer.firstName} {selectedTrainer.lastName}
                      </h2>
                      <p className="text-sm text-muted-foreground dark:text-muted-foreground truncate">
                        {selectedTrainer.email}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={getStatusVariant(selectedTrainer.status)}
                    size="lg"
                    className="shrink-0"
                  >
                    {getStatusLabel(selectedTrainer.status)}
                  </Badge>
                </div>
              </div>

              {/* ── Detail Body ──────────────────────────────────────────────── */}
              <div className="p-5">
                <Tabs defaultValue="profile" className="space-y-5">
                  <TabsList className="w-full justify-start bg-transparent border-b rounded-none px-0 gap-6 overflow-x-auto">
                    <TabsTrigger
                      value="profile"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
                    >
                      Profil
                    </TabsTrigger>
                    <TabsTrigger
                      value="qualifications"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
                    >
                      Qualifikationen
                    </TabsTrigger>
                    <TabsTrigger
                      value="experience"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
                    >
                      Erfahrung
                    </TabsTrigger>
                    <TabsTrigger
                      value="availability"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
                    >
                      Verfügbarkeit
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Profile Tab ──────────────────────────────────────────── */}
                  <TabsContent value="profile" className="space-y-6 animate-in">
                    <Card variant="bordered">
                      <CardContent className="p-5">
                        <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                          <User className="h-4 w-4 text-brandPrimary" />
                          Persönliche Informationen
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Vorname</Label>
                            {isEditing ? (
                              <Input
                                value={editForm.firstName || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, firstName: e.target.value })
                                }
                              />
                            ) : (
                              <div className="font-medium">{selectedTrainer.firstName}</div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Nachname</Label>
                            {isEditing ? (
                              <Input
                                value={editForm.lastName || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, lastName: e.target.value })
                                }
                              />
                            ) : (
                              <div className="font-medium">{selectedTrainer.lastName}</div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">E-Mail</Label>
                            {isEditing ? (
                              <Input
                                value={editForm.email || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, email: e.target.value })
                                }
                              />
                            ) : (
                              <div className="font-medium">{selectedTrainer.email}</div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Telefon</Label>
                            {isEditing ? (
                              <Input
                                value={editForm.phone || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, phone: e.target.value })
                                }
                              />
                            ) : (
                              <div className="font-medium">{selectedTrainer.phone}</div>
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
                              <div className="font-medium">
                                {format(parseISO(selectedTrainer.dateOfBirth), 'dd. MMMM yyyy', {
                                  locale: de,
                                })}
                              </div>
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
                                {selectedTrainer.bio || 'Keine Bio vorhanden'}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ── Emergency Contact ──────────────────────────────────── */}
                    <Card variant="bordered">
                      <CardContent className="p-5">
                        <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                          <PhoneCall className="h-4 w-4 text-brandAccent" />
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
                              <div className="font-medium">
                                {selectedTrainer.emergencyContact.name}
                              </div>
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
                              <div className="font-medium">
                                {selectedTrainer.emergencyContact.phone}
                              </div>
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
                              <div className="font-medium">
                                {selectedTrainer.emergencyContact.relationship}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ── Languages ──────────────────────────────────────────── */}
                    <Card variant="bordered">
                      <CardContent className="p-5">
                        <h3 className="font-semibold mb-4 flex items-center gap-2 text-base">
                          <Globe className="h-4 w-4 text-brandPrimary" />
                          Sprachen
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedTrainer.languages.length > 0 ? (
                            selectedTrainer.languages.map((lang, index) => (
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
                    {selectedTrainer.qualifications.length > 0 ? (
                      <div className="space-y-3">
                        {selectedTrainer.qualifications.map((qual) => (
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
                                    <span className="font-medium text-foreground">
                                      Ausgestellt:
                                    </span>{' '}
                                    {format(parseISO(qual.issuedDate), 'dd. MMMM yyyy', {
                                      locale: de,
                                    })}
                                  </div>
                                  {qual.expiryDate && (
                                    <div>
                                      <span className="font-medium text-foreground">
                                        Gültig bis:
                                      </span>{' '}
                                      {format(parseISO(qual.expiryDate), 'dd. MMMM yyyy', {
                                        locale: de,
                                      })}
                                    </div>
                                  )}
                                  {qual.verifiedAt && (
                                    <div>
                                      <span className="font-medium text-foreground">
                                        Verifiziert am:
                                      </span>{' '}
                                      {format(parseISO(qual.verifiedAt), 'dd. MMMM yyyy', {
                                        locale: de,
                                      })}
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

                    {/* ── Specializations (inline) ───────────────────────────── */}
                    <div className="pt-2">
                      <h3 className="font-semibold mb-3 flex items-center gap-2 text-base">
                        <Target className="h-4 w-4 text-brandAccent" />
                        Spezialisierungen
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedTrainer.specializations.length > 0 ? (
                          selectedTrainer.specializations.map((spec) => (
                            <Badge
                              key={spec.id}
                              variant={getSpecializationVariant(spec.level)}
                              size="lg"
                            >
                              {spec.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Keine Spezialisierungen
                          </span>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Experience Tab ───────────────────────────────────────── */}
                  <TabsContent value="experience" className="space-y-5 animate-in">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-brandPrimary" />
                      Berufserfahrung
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card variant="gradient">
                        <CardContent className="p-5 text-center">
                          <p className="text-muted-foreground dark:text-muted-foreground text-sm mb-1">
                            Branchenerfahrung
                          </p>
                          <div className="text-3xl font-bold text-gradient-primary">
                            {selectedTrainer.experience.years}{' '}
                            <span className="text-xl">Jahre</span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card variant="gradient">
                        <CardContent className="p-5 text-center">
                          <p className="text-muted-foreground dark:text-muted-foreground text-sm mb-1">
                            Vorherige Vereine
                          </p>
                          <div className="text-3xl font-bold text-gradient-accent">
                            {selectedTrainer.experience.previousClubs.length}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-4">
                      <Card variant="bordered">
                        <CardContent className="p-5">
                          <h4 className="font-semibold mb-3">Ehemalige Stationen</h4>
                          {selectedTrainer.experience.previousClubs.length > 0 ? (
                            <div className="space-y-2">
                              {selectedTrainer.experience.previousClubs.map((club, index) => (
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
                            <p className="text-sm text-muted-foreground">
                              Keine vorherigen Stationen
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      <Card variant="bordered">
                        <CardContent className="p-5">
                          <h4 className="font-semibold mb-3">Größte Erfolge</h4>
                          {selectedTrainer.experience.achievements.length > 0 ? (
                            <div className="space-y-2">
                              {selectedTrainer.experience.achievements.map((achievement, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-3 text-foreground dark:text-foreground text-sm"
                                >
                                  <Trophy className="h-4 w-4 text-brandAccent shrink-0" />
                                  <span>{achievement}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Keine Erfolge eingetragen
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* ── Availability Tab ─────────────────────────────────────── */}
                  <TabsContent value="availability" className="space-y-6 animate-in">
                    {/* Reguläre Wochenverfügbarkeit — now with hourly time slots */}
                    <Card variant="flat">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold flex items-center gap-2 text-base">
                            <Calendar className="h-4 w-4 text-brandPrimary" />
                            Reguläre Wochenverfügbarkeit
                          </h3>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => loadAllSlots(selectedTrainer.userId)}
                              disabled={weeklyLoading}
                            >
                              <RefreshCw
                                className={`h-4 w-4 ${weeklyLoading ? 'animate-spin' : ''}`}
                              />
                            </Button>
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
                              <Skeleton key={i} className="h-16 w-full rounded-lg" />
                            ))}
                          </div>
                        ) : weeklySlots.length > 0 ? (
                          <div className="space-y-3">
                            {weekDays.map((day) => {
                              const daySlots = getWeeklySlotsForDay(day.value);
                              if (daySlots.length === 0) return null;
                              return (
                                <div key={day.value} className="border rounded-lg p-3">
                                  <h4 className="font-semibold text-sm text-brand-primary mb-2">
                                    {day.label}
                                  </h4>
                                  <div className="space-y-2">
                                    {daySlots.map((slot) => (
                                      <div
                                        key={slot.id}
                                        className="flex items-center justify-between bg-green-50 border border-green-200 dark:bg-green-900/10 dark:border-green-800 rounded p-3"
                                      >
                                        <div className="flex items-center gap-2">
                                          <Clock className="h-4 w-4 text-green-600" />
                                          <span className="font-medium text-sm">
                                            {slot.start_time} – {slot.end_time}
                                          </span>
                                          <Badge variant="success" size="sm">
                                            Verfügbar
                                          </Badge>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => slot.id && handleDeleteWeeklySlot(slot.id)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                                        </Button>
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
                    {weeklyDialogOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                        <div className="bg-background dark:bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold">Neue wöchentliche Verfügbarkeit</h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setWeeklyDialogOpen(false)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
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
                            <Button
                              className="flex-1"
                              onClick={handleAddWeeklySlot}
                              disabled={weeklySaving}
                            >
                              {weeklySaving ? 'Speichern...' : 'Hinzufügen'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Konkrete Verfügbarkeitsslots — now with add + delete */}
                    <Card variant="flat">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold flex items-center gap-2 text-base">
                            <Clock className="h-4 w-4 text-brandAccent" />
                            Konkrete Verfügbarkeiten
                          </h3>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => loadAllSlots(selectedTrainer.userId)}
                              disabled={availLoading}
                            >
                              <RefreshCw
                                className={`h-4 w-4 ${availLoading ? 'animate-spin' : ''}`}
                              />
                            </Button>
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
                              <Skeleton key={i} className="h-12 w-full rounded-lg" />
                            ))}
                          </div>
                        ) : availabilitySlots.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {availabilitySlots.slice(0, 20).map((slot) => (
                              <div
                                key={slot.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                                  slot.status === 'available'
                                    ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
                                    : slot.status === 'booked'
                                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'
                                      : slot.status === 'blocked'
                                        ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                                        : 'bg-muted border-border dark:bg-card/10 dark:border-border'
                                }`}
                              >
                                <div className="shrink-0">
                                  {slot.status === 'available' ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : slot.status === 'booked' ? (
                                    <Calendar className="h-4 w-4 text-blue-500" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-xs truncate">
                                    {format(parseISO(slot.date), 'dd. MMM yyyy', { locale: de })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {slot.startTime} - {slot.endTime}
                                    <span className="ml-2 capitalize">({slot.status})</span>
                                  </p>
                                </div>
                                {slot.status !== 'booked' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() => handleDeleteSlot(slot.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            Keine konkreten Verfügbarkeiten eingetragen.
                            <br />
                            <span className="text-xs">
                              Klicke auf &quot;Slot hinzufügen&quot; um eine Verfügbarkeit zu
                              erstellen.
                            </span>
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Add Slot Dialog (overlay) */}
                    {slotDialogOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                        <div className="bg-background dark:bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold">Neue Verfügbarkeit</h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setSlotDialogOpen(false)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
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
                        </div>
                      </div>
                    )}

                    {/* Bevorzugte Arbeitszeiten */}
                    <Card variant="flat">
                      <CardContent className="p-5">
                        <h3 className="font-semibold mb-3 flex items-center gap-2 text-base">
                          <Clock className="h-4 w-4 text-brandAccent" />
                          Bevorzugte Arbeitszeiten
                        </h3>
                        {selectedTrainer.preferredTimeSlots.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedTrainer.preferredTimeSlots.map((slot, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-3 bg-background dark:bg-background p-3 rounded-lg border shadow-sm text-sm"
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
                        setEditForm(selectedTrainer);
                      }}
                      className="flex-1 sm:flex-initial"
                    >
                      Abbrechen
                    </Button>
                    <Button
                      onClick={handleSave}
                      variant="primary"
                      className="flex-1 sm:flex-initial"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 w-full sm:w-auto">
                      {selectedTrainer.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAbsenceDialogOpen(true)}
                          className="flex-1 sm:flex-initial"
                        >
                          Urlaub eintragen
                        </Button>
                      )}
                      {selectedTrainer.status !== 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(selectedTrainer.id, 'active')}
                          className="flex-1 sm:flex-initial"
                        >
                          Aktivieren
                        </Button>
                      )}
                      {selectedTrainer.status !== 'terminated' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(selectedTrainer.id, 'inactive')}
                          className="flex-1 sm:flex-initial"
                        >
                          Deaktivieren
                        </Button>
                      )}
                    </div>
                    <Button
                      onClick={() => handleEdit(selectedTrainer)}
                      variant="primary"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Profil bearbeiten
                    </Button>
                  </>
                )}
              </div>

              {/* ── Absence Dialog (date-range Urlaub) ──────────────────────── */}
              {absenceDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-background dark:bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold">Abwesenheit eintragen</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setAbsenceDialogOpen(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Trainer: {selectedTrainer.firstName} {selectedTrainer.lastName}
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
                            <SelectItem value="training">Weiterbildung</SelectItem>
                            <SelectItem value="personal">Persönlich</SelectItem>
                            <SelectItem value="other">Sonstiges</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setAbsenceDialogOpen(false)}
                      >
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
                  </div>
                </div>
              )}
            </div>
          ) : showInviteForm ? (
            /* ── Inline Invite Form ──────────────────────────────────────────── */
            <div className="bg-background dark:bg-surface-dark rounded-2xl border border-border dark:border-white/10 shadow-sm overflow-hidden animate-in">
              <div className="p-5 border-b border-border dark:border-white/10 bg-gradient-to-r from-brandPrimary/5 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setShowInviteForm(false)}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-foreground dark:text-white">
                        Trainer einladen
                      </h2>
                      <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                        Lade einen neuen Trainer zu deinem Verein ein
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
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
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowInviteForm(false);
                      setInviteEmail('');
                      setInviteName('');
                    }}
                    disabled={inviteLoading}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleInviteTrainer}
                    disabled={inviteLoading || !inviteEmail}
                    variant="gradient"
                  >
                    {inviteLoading ? 'Wird gesendet...' : 'Einladung senden'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Desktop Empty State ────────────────────────────────────────── */
            <div className="hidden lg:flex flex-col items-center justify-center h-full min-h-[500px] text-center p-12">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brandPrimary/5 mb-6">
                <User className="h-10 w-10 text-brandPrimary/40" />
              </div>
              <h3 className="text-xl font-semibold text-muted-foreground dark:text-muted-foreground">
                Trainer auswählen
              </h3>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-2 max-w-xs">
                Wähle einen Trainer aus der Liste aus, um sein Profil anzuzeigen und zu bearbeiten.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
