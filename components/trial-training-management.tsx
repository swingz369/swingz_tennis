'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from '@/lib/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Search,
  Download,
  Eye,
  Mail,
  Phone,
  MapPin,
  Star,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface TrialTraining {
  id: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
  };
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  trainer: {
    id: string;
    name: string;
  };
  court: {
    id: string;
    name: string;
  };
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'converted';
  notes?: string;
  feedback?: {
    rating: number;
    comments: string;
    wouldRecommend: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export default function TrialTrainingManagement() {
  const [trainings, setTrainings] = useState<TrialTraining[]>([]);
  const [selectedTab, setSelectedTab] = useState<
    'all' | 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'converted'
  >('all');
  const [selectedTraining, setSelectedTraining] = useState<TrialTraining | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'converted'
  >('all');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrialTrainings();
  }, []);

  const loadTrialTrainings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/trial-trainings');
      if (!response.ok) {
        throw new Error('Failed to load trial trainings');
      }
      const data = await response.json();
      setTrainings(data.trainings || []);
    } catch (error) {
      console.error('Failed to load trial trainings:', error);
      toast.error('Fehler beim Laden der Probetrainings');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTrainings = trainings.filter((training) => {
    const matchesTab = selectedTab === 'all' || training.status === selectedTab;
    const matchesStatus = statusFilter === 'all' || training.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      `${training.participant.firstName} ${training.participant.lastName} ${training.participant.email}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    return matchesTab && matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: TrialTraining['status']) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'no_show':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'converted':
        return 'bg-purple-100 text-purple-700 border-purple-200';
    }
  };

  const getStatusLabel = (status: TrialTraining['status']) => {
    switch (status) {
      case 'scheduled':
        return 'Geplant';
      case 'completed':
        return 'Abgeschlossen';
      case 'cancelled':
        return 'Abgesagt';
      case 'no_show':
        return 'Nicht erschienen';
      case 'converted':
        return 'Konvertiert';
    }
  };

  const handleStatusChange = async (trainingId: string, newStatus: TrialTraining['status']) => {
    try {
      const response = await fetch(`/api/trial-trainings/${trainingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const data = await response.json();

      setTrainings((prev) =>
        prev.map((training) => (training.id === trainingId ? data.trialTraining : training))
      );

      toast.success(`Status aktualisiert: ${getStatusLabel(newStatus)}`);
    } catch (error) {
      toast.error('Fehler beim Aktualisieren des Status');
      console.error('Status update error:', error);
    }
  };

  const handleSaveNotes = async (trainingId: string) => {
    try {
      const response = await fetch(`/api/trial-trainings/${trainingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      const data = await response.json();

      setTrainings((prev) =>
        prev.map((training) => (training.id === trainingId ? data.trialTraining : training))
      );

      toast.success('Notizen gespeichert');
    } catch (error) {
      toast.error('Fehler beim Speichern der Notizen');
      console.error('Notes save error:', error);
    }
  };

  const handleSendReminder = async (trainingId: string) => {
    try {
      const response = await fetch(`/api/trial-trainings/${trainingId}/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialTrainingId: trainingId }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reminder');
      }

      toast.success('Erinnerung gesendet');
    } catch (error) {
      toast.error('Fehler beim Senden der Erinnerung');
      console.error('Reminder send error:', error);
    }
  };

  const handleConvertToMember = async (trainingId: string) => {
    try {
      const memberId = prompt('Mitglieds-ID eingeben:');
      if (!memberId) {
        toast.error('Mitglieds-ID ist erforderlich');
        return;
      }

      const response = await fetch(`/api/trial-trainings/${trainingId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          memberType: 'member',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to convert to member');
      }

      const data = await response.json();

      setTrainings((prev) =>
        prev.map((training) => (training.id === trainingId ? data.trialTraining : training))
      );

      toast.success('Probetraining erfolgreich zu Mitglied konvertiert');
    } catch (error) {
      toast.error('Fehler bei der Konvertierung');
      console.error('Conversion error:', error);
    }
  };

  const scheduledCount = trainings.filter((t) => t.status === 'scheduled').length;
  const completedCount = trainings.filter((t) => t.status === 'completed').length;
  const convertedCount = trainings.filter((t) => t.status === 'converted').length;
  const noShowCount = trainings.filter((t) => t.status === 'no_show').length;

  const conversionRate =
    completedCount > 0 ? Math.round((convertedCount / completedCount) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Probetraining verwalten</h1>
          <p className="text-gray-500">Übersicht und Management aller Probetrainings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
              <p className="text-gray-500">Laden...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatCard
              icon={Calendar}
              value={scheduledCount}
              label="Geplant"
              sublabel="Ausstehende Trainings"
              iconClassName="bg-blue-100"
              valueClassName="text-blue-600"
            />

            <StatCard
              icon={CheckCircle}
              value={completedCount}
              label="Abgeschlossen"
              sublabel="Erfolgreich absolviert"
              iconClassName="bg-green-100"
              valueClassName="text-green-600"
            />

            <StatCard
              icon={Star}
              value={convertedCount}
              label="Konvertiert"
              sublabel="Zu Mitgliedern geworden"
              iconClassName="bg-purple-100"
              valueClassName="text-purple-600"
            />

            <StatCard
              icon={XCircle}
              value={noShowCount}
              label="Nicht erschienen"
              sublabel="Ohne Absage"
              iconClassName="bg-orange-100"
              valueClassName="text-orange-600"
            />

            <StatCard
              icon={TrendingUp}
              value={`${conversionRate}%`}
              label="Konversionsrate"
              sublabel="Von Abgeschlossen zu Konvertiert"
              iconClassName="bg-green-100"
              valueClassName="text-green-600"
            />
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
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="scheduled">Geplant</SelectItem>
                  <SelectItem value="completed">Abgeschlossen</SelectItem>
                  <SelectItem value="cancelled">Abgesagt</SelectItem>
                  <SelectItem value="no_show">Nicht erschienen</SelectItem>
                  <SelectItem value="converted">Konvertiert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={selectedTab}
            onValueChange={(value) => setSelectedTab(value as typeof selectedTab)}
          >
            <TabsList>
              <TabsTrigger value="all">Alle ({trainings.length})</TabsTrigger>
              <TabsTrigger value="scheduled">Geplant ({scheduledCount})</TabsTrigger>
              <TabsTrigger value="completed">Abgeschlossen ({completedCount})</TabsTrigger>
              <TabsTrigger value="converted">Konvertiert ({convertedCount})</TabsTrigger>
              <TabsTrigger value="no_show">Nicht erschienen ({noShowCount})</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-6">
              {filteredTrainings.length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500">Keine Probetrainings gefunden</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredTrainings.map((training) => (
                    <Card
                      key={training.id}
                      className={
                        'transition-all hover:shadow-md ' +
                        (training.status === 'scheduled' ? 'border-l-4 border-l-blue-500' : '')
                      }
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className={getStatusColor(training.status)}>
                                {getStatusLabel(training.status)}
                              </Badge>
                              {training.status === 'scheduled' && (
                                <Badge variant="default" className="gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Bald
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-brand-primary/10 rounded-lg">
                                <User className="h-5 w-5 text-brand-primary" />
                              </div>
                              <div>
                                <div className="font-semibold">
                                  {training.participant.firstName} {training.participant.lastName}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {training.participant.email}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span>
                                  {format(parseISO(training.scheduledDate), 'dd. MMMM yyyy', {
                                    locale: de,
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-gray-400" />
                                <span>
                                  {training.scheduledTime} ({training.duration} Min)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                <span>{training.court.name}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-gray-400" />
                                <span>Trainer: {training.trainer.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span>{training.participant.phone}</span>
                              </div>
                            </div>

                            {training.feedback && (
                              <div className="mt-3 pt-3 border-t">
                                <div className="flex items-center gap-1 mb-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-4 w-4 ${
                                        i < training.feedback!.rating
                                          ? 'text-yellow-400 fill-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <p className="text-sm text-gray-600">
                                  {training.feedback.comments}
                                </p>
                              </div>
                            )}

                            <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-gray-500">
                              <div className="flex items-center gap-4">
                                <span>
                                  Erstellt:{' '}
                                  {format(parseISO(training.createdAt), 'dd.MM.yyyy HH:mm', {
                                    locale: de,
                                  })}
                                </span>
                                <span>
                                  Aktualisiert:{' '}
                                  {format(parseISO(training.updatedAt), 'dd.MM.yyyy HH:mm', {
                                    locale: de,
                                  })}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedTraining(training)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Details
                              </Button>
                            </div>
                          </div>

                          {/* Actions */}
                          {training.status === 'scheduled' && (
                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleStatusChange(training.id, 'completed')}
                                className="gap-1"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Abschließen
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendReminder(training.id)}
                                className="gap-1"
                              >
                                <Mail className="h-4 w-4" />
                                Erinnern
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(training.id, 'cancelled')}
                                className="gap-1"
                              >
                                <XCircle className="h-4 w-4" />
                                Absagen
                              </Button>
                            </div>
                          )}

                          {training.status === 'completed' && (
                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleConvertToMember(training.id)}
                                className="gap-1"
                              >
                                <Star className="h-4 w-4" />
                                Konvertieren
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(training.id, 'no_show')}
                                className="gap-1"
                              >
                                <XCircle className="h-4 w-4" />
                                Nicht erschienen
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Details Modal */}
          {selectedTraining && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Probetraining Details</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedTraining(null)}>
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getStatusColor(selectedTraining.status)}>
                      {getStatusLabel(selectedTraining.status)}
                    </Badge>
                  </div>

                  {/* Participant Information */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Teilnehmerinformationen
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Name:</span>
                        <div className="font-medium">
                          {selectedTraining.participant.firstName}{' '}
                          {selectedTraining.participant.lastName}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">E-Mail:</span>
                        <div className="font-medium">{selectedTraining.participant.email}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Telefon:</span>
                        <div className="font-medium">{selectedTraining.participant.phone}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Geburtsdatum:</span>
                        <div className="font-medium">
                          {format(
                            parseISO(selectedTraining.participant.dateOfBirth),
                            'dd. MMMM yyyy',
                            { locale: de }
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Training Information */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Trainingstermin
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Datum:</span>
                        <span className="ml-2 font-medium">
                          {format(parseISO(selectedTraining.scheduledDate), 'EEEE, dd. MMMM yyyy', {
                            locale: de,
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Uhrzeit:</span>
                        <span className="ml-2 font-medium">
                          {selectedTraining.scheduledTime} ({selectedTraining.duration} Minuten)
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Trainer:</span>
                        <span className="ml-2 font-medium">{selectedTraining.trainer.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Platz:</span>
                        <span className="ml-2 font-medium">{selectedTraining.court.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Feedback */}
                  {selectedTraining.feedback && (
                    <div>
                      <h3 className="font-semibold mb-3">Feedback</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < selectedTraining.feedback!.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-sm">{selectedTraining.feedback.comments}</p>
                        {selectedTraining.feedback.wouldRecommend && (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Würde empfehlen
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <h3 className="font-semibold mb-3">Notizen</h3>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Interne Notizen für dieses Probetraining..."
                      rows={3}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSaveNotes(selectedTraining.id)}
                      className="mt-2"
                    >
                      Notizen speichern
                    </Button>
                  </div>

                  {/* Actions */}
                  {selectedTraining.status === 'scheduled' && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        onClick={() => handleStatusChange(selectedTraining.id, 'completed')}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Abschließen
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleSendReminder(selectedTraining.id)}
                        className="flex-1"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Erinnern
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleStatusChange(selectedTraining.id, 'cancelled')}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Absagen
                      </Button>
                    </div>
                  )}

                  {selectedTraining.status === 'completed' && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        onClick={() => handleConvertToMember(selectedTraining.id)}
                        className="flex-1"
                      >
                        <Star className="h-4 w-4 mr-2" />
                        Konvertieren
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleStatusChange(selectedTraining.id, 'no_show')}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Nicht erschienen
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
