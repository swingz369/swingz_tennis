'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Phone,
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
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function TrainerProfileManagement() {
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState<TrainerProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [editForm, setEditForm] = useState<Partial<TrainerProfile>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    loadTrainers();
  }, []);

  const loadTrainers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/trainer-profiles');
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
      const res = await fetch('/api/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteName || undefined,
          role: 'trainer',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Einladen');
      toast.success(data.message ?? 'Trainer erfolgreich eingeladen');
      setInviteOpen(false);
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
      const response = await fetch(`/api/trainer-profiles/${selectedTrainer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`/api/trainer-profiles/${trainerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const data = await response.json();

      setTrainers((prev) => prev.map((t) => (t.id === trainerId ? data.trainerProfile : t)));

      toast.success(`Status aktualisiert`);
    } catch (error) {
      toast.error('Fehler beim Aktualisieren des Status');
      console.error('Status update error:', error);
    }
  };

  const handleVerifyQualification = async (qualificationId: string) => {
    if (!selectedTrainer) return;

    try {
      const response = await fetch(
        `/api/trainer-profiles/${selectedTrainer.id}/qualifications/${qualificationId}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

  const availabilityDays = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ] as const;

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
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto animate-in">
      {/* ── Glass Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 glass dark:glass-dark rounded-2xl shadow-sm">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-gradient-primary">
            Trainer-Verwaltung
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Übersicht und Management aller Trainerprofile
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="md">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Export</span>
          </Button>
          <Button size="md" variant="gradient" onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Neuer Trainer</span>
          </Button>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 animate-in animate-in-delay-1">
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

      {/* ── Empty State ──────────────────────────────────────────────────────── */}
      {filteredTrainers.length === 0 ? (
        <Card
          variant="flat"
          className="animate-in animate-in-delay-2 p-12 gradient-border glass text-center"
        >
          <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-2xl bg-brandPrimary/10 mb-6 shadow-glow-primary">
            <GraduationCap className="h-10 w-10 text-brandPrimary" />
          </div>
          <h3 className="text-2xl font-bold text-brand-primary">
            {searchQuery || statusFilter !== 'all' ? 'Keine Treffer' : 'Noch keine Trainer'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all'
              ? 'Passe deine Filterkriterien an, um Ergebnisse zu sehen.'
              : 'Füge deinen ersten Trainer hinzu, um loszulegen.'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Button
              size="lg"
              variant="gradient"
              onClick={() => setInviteOpen(true)}
              className="mt-8"
              leftIcon={<Plus className="h-5 w-5" />}
            >
              Trainer hinzufügen
            </Button>
          )}
        </Card>
      ) : (
        /* ── Trainer Card Grid ──────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrainers.map((trainer, i) => {
            const delayClass = `animate-in-delay-${(i % 5) + 1}`;
            return (
              <Card
                key={trainer.id}
                variant="elevated"
                className={`cursor-pointer hover-lift animate-in ${delayClass}`}
                onClick={() => setSelectedTrainer(trainer)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-brandPrimary/20 to-brandPrimary/5 shadow-sm">
                        <User className="h-7 w-7 text-brandPrimary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">
                          {trainer.firstName} {trainer.lastName}
                        </CardTitle>
                        <p className="text-sm text-gray-500 line-clamp-1">{trainer.email}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant={getStatusVariant(trainer.status)}>
                      {getStatusLabel(trainer.status)}
                    </Badge>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                      <Phone className="h-4 w-4 text-brandPrimary/70" />
                      <span>{trainer.phone || 'Keine Nummer'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                      <Award className="h-4 w-4 text-brandAccent/70" />
                      <span>{trainer.qualifications.length} Qualifikationen</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                      <Target className="h-4 w-4 text-brandSecondary/70" />
                      <span>{trainer.specializations.length} Spezialisierungen</span>
                    </div>
                    {trainer.hourlyRate && (
                      <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                        <Euro className="h-4 w-4 text-green-600/70" />
                        <span>€{trainer.hourlyRate}/Stunde</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Trainer Detail Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={!!selectedTrainer}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTrainer(null);
            setIsEditing(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 [&>button]:text-white/70 [&>button]:hover:text-white [&>button]:top-6 [&>button]:right-6">
          {selectedTrainer && (
            <>
              {/* ── Detail Header ────────────────────────────────────────────── */}
              <DialogHeader className="p-6 border-b glass-dark relative overflow-hidden shrink-0">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-brandPrimary/20 blur-[80px] rounded-full pointer-events-none" />
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <DialogTitle className="text-3xl font-bold text-white mb-2">
                      {selectedTrainer.firstName} {selectedTrainer.lastName}
                    </DialogTitle>
                    <p className="text-white/80">{selectedTrainer.email}</p>
                  </div>
                  <Badge variant={getStatusVariant(selectedTrainer.status)} size="lg">
                    {getStatusLabel(selectedTrainer.status)}
                  </Badge>
                </div>
              </DialogHeader>

              {/* ── Detail Body ──────────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-background">
                <Tabs defaultValue="profile" className="space-y-6">
                  <TabsList className="w-full justify-start bg-transparent border-b rounded-none px-0 gap-6">
                    <TabsTrigger
                      value="profile"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0"
                    >
                      Profil
                    </TabsTrigger>
                    <TabsTrigger
                      value="qualifications"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0"
                    >
                      Qualifikationen
                    </TabsTrigger>
                    <TabsTrigger
                      value="experience"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0"
                    >
                      Erfahrung
                    </TabsTrigger>
                    <TabsTrigger
                      value="availability"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0"
                    >
                      Verfügbarkeit
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Profile Tab ──────────────────────────────────────────── */}
                  <TabsContent value="profile" className="space-y-8 animate-in">
                    <Card variant="bordered">
                      <CardContent className="p-6">
                        <h3 className="font-semibold mb-6 flex items-center gap-2 text-lg">
                          <User className="h-5 w-5 text-brandPrimary" />
                          Persönliche Informationen
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label>Vorname</Label>
                            {isEditing ? (
                              <Input
                                value={editForm.firstName || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, firstName: e.target.value })
                                }
                              />
                            ) : (
                              <div className="font-medium mt-1">{selectedTrainer.firstName}</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Nachname</Label>
                            {isEditing ? (
                              <Input
                                value={editForm.lastName || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, lastName: e.target.value })
                                }
                              />
                            ) : (
                              <div className="font-medium mt-1">{selectedTrainer.lastName}</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>E-Mail</Label>
                            {isEditing ? (
                              <Input
                                value={editForm.email || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, email: e.target.value })
                                }
                              />
                            ) : (
                              <div className="font-medium mt-1">{selectedTrainer.email}</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Telefon</Label>
                            {isEditing ? (
                              <Input
                                value={editForm.phone || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, phone: e.target.value })
                                }
                              />
                            ) : (
                              <div className="font-medium mt-1">{selectedTrainer.phone}</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Geburtsdatum</Label>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={editForm.dateOfBirth || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, dateOfBirth: e.target.value })
                                }
                              />
                            ) : (
                              <div className="font-medium mt-1">
                                {format(parseISO(selectedTrainer.dateOfBirth), 'dd. MMMM yyyy', {
                                  locale: de,
                                })}
                              </div>
                            )}
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label>Bio</Label>
                            {isEditing ? (
                              <Textarea
                                value={editForm.bio || ''}
                                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                rows={4}
                                className="resize-none"
                              />
                            ) : (
                              <div className="text-gray-700 dark:text-gray-300 mt-1">
                                {selectedTrainer.bio || 'Keine Bio vorhanden'}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ── Emergency Contact ───────────────────────────────────── */}
                    <Card variant="bordered">
                      <CardContent className="p-6">
                        <h3 className="font-semibold mb-6 flex items-center gap-2 text-lg">
                          <PhoneCall className="h-5 w-5 text-brandAccent" />
                          Notfallkontakt
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <Label>Name</Label>
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
                              <div className="font-medium mt-1">
                                {selectedTrainer.emergencyContact.name}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Telefon</Label>
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
                              <div className="font-medium mt-1">
                                {selectedTrainer.emergencyContact.phone}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Beziehung</Label>
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
                              <div className="font-medium mt-1">
                                {selectedTrainer.emergencyContact.relationship}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ── Languages ───────────────────────────────────────────── */}
                    <Card variant="bordered">
                      <CardContent className="p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg">
                          <Globe className="h-5 w-5 text-brandPrimary" />
                          Sprachen
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedTrainer.languages.map((lang, index) => (
                            <Badge key={index} variant="secondary">
                              {lang}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ── Qualifications Tab ────────────────────────────────────── */}
                  <TabsContent value="qualifications" className="space-y-6 animate-in">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold">Zertifikate & Qualifikationen</h3>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Hinzufügen
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {selectedTrainer.qualifications.map((qual) => (
                        <Card key={qual.id} variant="flat">
                          <CardContent className="p-5 flex flex-col md:flex-row items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-3 mb-3">
                                <h4 className="text-lg font-semibold">{qual.name}</h4>
                                {qual.verified ? (
                                  <Badge variant="success" className="gap-1">
                                    <CheckCircle className="h-3 w-3" /> Verifiziert
                                  </Badge>
                                ) : (
                                  <Badge variant="warning" className="gap-1">
                                    <AlertCircle className="h-3 w-3" /> Ausstehend
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
                                <div>
                                  <span className="font-medium text-foreground">Aussteller:</span>{' '}
                                  {qual.issuer}
                                </div>
                                <div>
                                  <span className="font-medium text-foreground">Ausgestellt:</span>{' '}
                                  {format(parseISO(qual.issuedDate), 'dd. MMMM yyyy', {
                                    locale: de,
                                  })}
                                </div>
                                {qual.expiryDate && (
                                  <div>
                                    <span className="font-medium text-foreground">Gültig bis:</span>{' '}
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

                    {/* ── Specializations (inline) ────────────────────────────── */}
                    <div className="pt-4">
                      <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg">
                        <Target className="h-5 w-5 text-brandAccent" />
                        Spezialisierungen
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {selectedTrainer.specializations.map((spec) => (
                          <Badge
                            key={spec.id}
                            variant={getSpecializationVariant(spec.level)}
                            size="lg"
                          >
                            {spec.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Experience Tab ────────────────────────────────────────── */}
                  <TabsContent value="experience" className="space-y-6 animate-in">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Briefcase className="h-6 w-6 text-brandPrimary" />
                      Berufserfahrung
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card variant="gradient">
                        <CardContent className="p-6 text-center">
                          <p className="text-gray-500 dark:text-gray-400 mb-1">Branchenerfahrung</p>
                          <div className="text-4xl font-bold text-gradient-primary">
                            {selectedTrainer.experience.years}{' '}
                            <span className="text-2xl">Jahre</span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card variant="gradient">
                        <CardContent className="p-6 text-center">
                          <p className="text-gray-500 dark:text-gray-400 mb-1">Vorherige Vereine</p>
                          <div className="text-4xl font-bold text-gradient-accent">
                            {selectedTrainer.experience.previousClubs.length}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-6 pt-4">
                      <Card variant="bordered">
                        <CardContent className="p-6">
                          <h4 className="font-semibold mb-4 text-lg">Ehemalige Stationen</h4>
                          <div className="space-y-3">
                            {selectedTrainer.experience.previousClubs.map((club, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-3 text-gray-700 dark:text-gray-300"
                              >
                                <MapPin className="h-5 w-5 text-gray-400" />
                                <span className="font-medium">{club}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card variant="bordered">
                        <CardContent className="p-6">
                          <h4 className="font-semibold mb-4 text-lg">Größte Erfolge</h4>
                          <div className="space-y-3">
                            {selectedTrainer.experience.achievements.map((achievement, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-3 text-gray-700 dark:text-gray-300"
                              >
                                <Trophy className="h-5 w-5 text-brandAccent" />
                                <span className="font-medium">{achievement}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* ── Availability Tab ──────────────────────────────────────── */}
                  <TabsContent value="availability" className="space-y-8 animate-in">
                    <div>
                      <h3 className="font-semibold mb-6 flex items-center gap-2 text-lg">
                        <Calendar className="h-5 w-5 text-brandPrimary" />
                        Reguläre Wochenverfügbarkeit
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                        {availabilityDays.map((day) => (
                          <div
                            key={day}
                            className={`p-4 rounded-xl text-center transition-all duration-200 ${
                              selectedTrainer.availability[day]
                                ? 'bg-brandPrimary/10 border border-brandPrimary/20 shadow-sm text-brandPrimary'
                                : 'bg-gray-100 dark:bg-white/5 text-gray-400 border border-transparent'
                            }`}
                          >
                            <div className="text-xs font-semibold uppercase tracking-wider mb-2">
                              {day.slice(0, 2)}
                            </div>
                            <div className="flex justify-center">
                              {selectedTrainer.availability[day] ? (
                                <CheckCircle className="h-6 w-6" />
                              ) : (
                                <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-600 border-dashed" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Card variant="flat">
                      <CardContent className="p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg">
                          <Clock className="h-5 w-5 text-brandAccent" />
                          Bevorzugte Arbeitszeiten
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {selectedTrainer.preferredTimeSlots.map((slot, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 bg-white dark:bg-background p-3 rounded-lg border shadow-sm"
                            >
                              <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                              <span className="font-medium">
                                {slot.start} – {slot.end}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              {/* ── Detail Footer ─────────────────────────────────────────────── */}
              <DialogFooter className="p-6 bg-white dark:bg-surface-dark border-t relative z-10 flex-col sm:flex-row gap-3 shrink-0">
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setEditForm(selectedTrainer);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Abbrechen
                    </Button>
                    <Button onClick={handleSave} className="w-full sm:w-auto" variant="primary">
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 flex gap-2">
                      {selectedTrainer.status === 'active' && (
                        <Button
                          variant="outline"
                          onClick={() => handleStatusChange(selectedTrainer.id, 'on_leave')}
                        >
                          Urlaub eintragen
                        </Button>
                      )}
                      {selectedTrainer.status !== 'active' && (
                        <Button
                          variant="outline"
                          onClick={() => handleStatusChange(selectedTrainer.id, 'active')}
                        >
                          Aktivieren
                        </Button>
                      )}
                    </div>
                    <Button
                      onClick={() => handleEdit(selectedTrainer)}
                      variant="primary"
                      className="w-full sm:w-auto"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Profil bearbeiten
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Invite Trainer Dialog ─────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader className="relative overflow-hidden pb-4">
            <div className="absolute top-0 right-0 p-4 -mt-4 -mr-4 bg-gradient-to-bl from-brandAccent/20 to-transparent rounded-bl-full w-32 h-32 pointer-events-none" />
            <DialogTitle className="text-2xl font-bold">Trainer einladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
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
                Name <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="invite-name"
                placeholder="Vor- und Nachname"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="bg-brandPrimary/5 border border-brandPrimary/10 p-3 rounded-lg text-sm text-gray-600 dark:text-gray-400">
              Der Trainer erhält eine Einladungs-E-Mail und wird dem Verein mit der Rolle
              &quot;Trainer&quot; hinzugefügt.
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviteLoading}>
              Abbrechen
            </Button>
            <Button
              onClick={handleInviteTrainer}
              disabled={inviteLoading || !inviteEmail}
              variant="gradient"
            >
              {inviteLoading ? 'Wird gesendet...' : 'Einladung senden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
