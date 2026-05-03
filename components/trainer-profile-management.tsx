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
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Star,
  Award,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Save,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  Shield,
  Clock,
  Globe,
  PhoneCall,
  GraduationCap,
  Trophy,
  Target,
  Heart,
  Briefcase,
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'on_leave' | 'terminated'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [editForm, setEditForm] = useState<Partial<TrainerProfile>>({});

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

  const handleEdit = (trainer: TrainerProfile) => {
    setSelectedTrainer(trainer);
    setEditForm(trainer);
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
      
      setTrainers((prev) =>
        prev.map((t) => (t.id === trainerId ? data.trainerProfile : t))
      );

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

  const getStatusColor = (status: TrainerProfile['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'on_leave':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'terminated':
        return 'bg-red-100 text-red-700 border-red-200';
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

  const getSpecializationLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-blue-100 text-blue-700';
      case 'intermediate':
        return 'bg-green-100 text-green-700';
      case 'advanced':
        return 'bg-orange-100 text-orange-700';
      case 'professional':
        return 'bg-purple-100 text-purple-700';
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

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Trainer-Profile verwalten</h1>
          <p className="text-gray-500">Übersicht und Management aller Trainerprofile</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Neuer Trainer
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Suche nach Name oder E-Mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="all">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Inaktiv</option>
            <option value="on_leave">Urlaub</option>
            <option value="terminated">Beendet</option>
          </select>
        </div>
      </div>

      {/* Trainer List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTrainers.map((trainer) => (
          <Card
            key={trainer.id}
            className="cursor-pointer hover:shadow-md transition-all"
            onClick={() => setSelectedTrainer(trainer)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-brand-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {trainer.firstName} {trainer.lastName}
                    </CardTitle>
                    <p className="text-sm text-gray-600">{trainer.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className={getStatusColor(trainer.status)}>
                  {getStatusLabel(trainer.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{trainer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Award className="h-4 w-4" />
                  <span>{trainer.qualifications.length} Qualifikationen</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Target className="h-4 w-4" />
                  <span>{trainer.specializations.length} Spezialisierungen</span>
                </div>
                {trainer.hourlyRate && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Euro className="h-4 w-4" />
                    <span>€{trainer.hourlyRate}/Stunde</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trainer Details Modal */}
      {selectedTrainer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {selectedTrainer.firstName} {selectedTrainer.lastName}
                  </CardTitle>
                  <p className="text-gray-500">{selectedTrainer.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getStatusColor(selectedTrainer.status)}>
                    {getStatusLabel(selectedTrainer.status)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedTrainer(null);
                      setIsEditing(false);
                    }}
                  >
                    <XCircle className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="profile">
                <TabsList className="mb-6">
                  <TabsTrigger value="profile">Profil</TabsTrigger>
                  <TabsTrigger value="qualifications">Qualifikationen</TabsTrigger>
                  <TabsTrigger value="specializations">Spezialisierungen</TabsTrigger>
                  <TabsTrigger value="experience">Erfahrung</TabsTrigger>
                  <TabsTrigger value="availability">Verfügbarkeit</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6">
                  {/* Personal Information */}
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Persönliche Informationen
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Vorname</Label>
                        {isEditing ? (
                          <Input
                            value={editForm.firstName || ''}
                            onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                          />
                        ) : (
                          <div className="mt-1">{selectedTrainer.firstName}</div>
                        )}
                      </div>
                      <div>
                        <Label>Nachname</Label>
                        {isEditing ? (
                          <Input
                            value={editForm.lastName || ''}
                            onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                          />
                        ) : (
                          <div className="mt-1">{selectedTrainer.lastName}</div>
                        )}
                      </div>
                      <div>
                        <Label>E-Mail</Label>
                        {isEditing ? (
                          <Input
                            value={editForm.email || ''}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          />
                        ) : (
                          <div className="mt-1">{selectedTrainer.email}</div>
                        )}
                      </div>
                      <div>
                        <Label>Telefon</Label>
                        {isEditing ? (
                          <Input
                            value={editForm.phone || ''}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          />
                        ) : (
                          <div className="mt-1">{selectedTrainer.phone}</div>
                        )}
                      </div>
                      <div>
                        <Label>Geburtsdatum</Label>
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editForm.dateOfBirth || ''}
                            onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                          />
                        ) : (
                          <div className="mt-1">
                            {format(parseISO(selectedTrainer.dateOfBirth), 'dd. MMMM yyyy', { locale: de })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <div>
                    <Label>Bio</Label>
                    {isEditing ? (
                      <Textarea
                        value={editForm.bio || ''}
                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                        rows={4}
                        className="mt-1"
                      />
                    ) : (
                      <div className="mt-1 text-gray-700">{selectedTrainer.bio || 'Keine Bio vorhanden'}</div>
                    )}
                  </div>

                  {/* Emergency Contact */}
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <PhoneCall className="h-5 w-5" />
                      Notfallkontakt
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Name</Label>
                        {isEditing ? (
                          <Input
                            value={editForm.emergencyContact?.name || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                emergencyContact: { ...editForm.emergencyContact, name: e.target.value },
                              })
                            }
                          />
                        ) : (
                          <div className="mt-1">{selectedTrainer.emergencyContact.name}</div>
                        )}
                      </div>
                      <div>
                        <Label>Telefon</Label>
                        {isEditing ? (
                          <Input
                            value={editForm.emergencyContact?.phone || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                emergencyContact: { ...editForm.emergencyContact, phone: e.target.value },
                              })
                            }
                          />
                        ) : (
                          <div className="mt-1">{selectedTrainer.emergencyContact.phone}</div>
                        )}
                      </div>
                      <div>
                        <Label>Beziehung</Label>
                        {isEditing ? (
                          <Input
                            value={editForm.emergencyContact?.relationship || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                emergencyContact: { ...editForm.emergencyContact, relationship: e.target.value },
                              })
                            }
                          />
                        ) : (
                          <div className="mt-1">{selectedTrainer.emergencyContact.relationship}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Languages */}
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Sprachen
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedTrainer.languages.map((lang, index) => (
                        <Badge key={index} variant="secondary">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="qualifications" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Qualifikationen
                    </h3>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Hinzufügen
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {selectedTrainer.qualifications.map((qual) => (
                      <div key={qual.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{qual.name}</h4>
                              {qual.verified ? (
                                <Badge variant="default" className="gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Verifiziert
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Nicht verifiziert
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>Aussteller: {qual.issuer}</div>
                              <div>
                                Ausgestellt:{' '}
                                {format(parseISO(qual.issuedDate), 'dd. MMMM yyyy', { locale: de })}
                              </div>
                              {qual.expiryDate && (
                                <div>
                                  Läuft ab:{' '}
                                  {format(parseISO(qual.expiryDate), 'dd. MMMM yyyy', { locale: de })}
                                </div>
                              )}
                              {qual.verifiedAt && (
                                <div>
                                  Verifiziert am:{' '}
                                  {format(parseISO(qual.verifiedAt), 'dd. MMMM yyyy', { locale: de })}
                                </div>
                              )}
                            </div>
                          </div>
                          {!qual.verified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleVerifyQualification(qual.id)}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Verifizieren
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="specializations" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Spezialisierungen
                    </h3>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Hinzufügen
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedTrainer.specializations.map((spec) => (
                      <Badge
                        key={spec.id}
                        variant="secondary"
                        className={getSpecializationLevelColor(spec.level)}
                      >
                        {spec.name}
                      </Badge>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="experience" className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Berufserfahrung
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">{selectedTrainer.experience.years} Jahre</CardTitle>
                          <p className="text-gray-500">Erfahrung</p>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">{selectedTrainer.experience.previousClubs.length}</CardTitle>
                          <p className="text-gray-500">Vereine</p>
                        </CardHeader>
                      </Card>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Vereine</h4>
                    <div className="space-y-2">
                      {selectedTrainer.experience.previousClubs.map((club, index) => (
                        <div key={index} className="flex items-center gap-2 text-gray-700">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{club}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Erfolge</h4>
                    <div className="space-y-2">
                      {selectedTrainer.experience.achievements.map((achievement, index) => (
                        <div key={index} className="flex items-center gap-2 text-gray-700">
                          <Trophy className="h-4 w-4 text-yellow-600" />
                          <span>{achievement}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="availability" className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Wöchentliche Verfügbarkeit
                    </h3>
                    <div className="grid grid-cols-7 gap-2">
                      {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(
                        (day) => (
                          <div
                            key={day}
                            className={`p-3 rounded-lg text-center ${
                              selectedTrainer.availability[day]
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            <div className="text-xs font-medium mb-1">
                              {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                            </div>
                            <div className="text-lg">
                              {selectedTrainer.availability[day] ? '✓' : '✗'}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Bevorzugte Zeitfenster
                    </h3>
                    <div className="space-y-2">
                      {selectedTrainer.preferredTimeSlots.map((slot, index) => (
                        <div key={index} className="flex items-center gap-2 text-gray-700">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span>
                            {slot.start} - {slot.end}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Actions */}
              <div className="flex gap-2 pt-6 border-t mt-6">
                {isEditing ? (
                  <>
                    <Button onClick={handleSave} className="flex-1">
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setEditForm(selectedTrainer);
                      }}
                      className="flex-1"
                    >
                      Abbrechen
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => handleEdit(selectedTrainer)} className="flex-1">
                      <Edit className="h-4 w-4 mr-2" />
                      Bearbeiten
                    </Button>
                    {selectedTrainer.status === 'active' && (
                      <Button
                        variant="outline"
                        onClick={() => handleStatusChange(selectedTrainer.id, 'on_leave')}
                        className="flex-1"
                      >
                        In den Urlaub schicken
                      </Button>
                    )}
                    {selectedTrainer.status !== 'active' && (
                      <Button
                        variant="outline"
                        onClick={() => handleStatusChange(selectedTrainer.id, 'active')}
                        className="flex-1"
                      >
                        Aktivieren
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
