'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Shield,
  AlertTriangle,
  Filter,
  Search,
  Download,
  Eye,
  MapPin,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export interface RegistrationRequest {
  id: string;
  type: 'registration' | 'application' | 'trial';
  status: 'pending' | 'approved' | 'rejected' | 'on_hold';
  applicant: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
  };
  address: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
  };
  tennisInfo: {
    experience: string;
    playingLevel: string;
    preferredDays: string[];
    goals: string;
  };
  additionalInfo?: {
    motivation?: string;
    availability?: string;
    specialRequirements?: string;
    previousClubs?: string;
  };
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  notes?: string;
}

export default function AdminApprovalWorkflow() {
  const [registrations, setRegistrations] = useState<RegistrationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>(
    'all'
  );
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'registration' | 'application' | 'trial'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch registrations from API
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchRegistrations() {
      try {
        const res = await fetch('/api/admin/approvals', {
          signal: abortController.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setRegistrations(data.registrations || []);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch registrations:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchRegistrations();
    return () => abortController.abort();
  }, []);

  const filteredRegistrations = registrations.filter((reg) => {
    const matchesTab = selectedTab === 'all' || reg.status === selectedTab;
    const matchesType = filterType === 'all' || reg.type === filterType;
    const matchesSearch =
      searchQuery === '' ||
      `${reg.applicant.firstName} ${reg.applicant.lastName} ${reg.applicant.email}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    return matchesTab && matchesType && matchesSearch;
  });

  const getStatusColor = (status: RegistrationRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'on_hold':
        return 'bg-orange-100 text-orange-700 border-orange-200';
    }
  };

  const getStatusLabel = (status: RegistrationRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'Ausstehend';
      case 'approved':
        return 'Genehmigt';
      case 'rejected':
        return 'Abgelehnt';
      case 'on_hold':
        return 'Zurückgestellt';
    }
  };

  const getTypeLabel = (type: RegistrationRequest['type']) => {
    switch (type) {
      case 'registration':
        return 'Registrierung';
      case 'application':
        return 'Bewerbung';
      case 'trial':
        return 'Probetraining';
    }
  };

  const getTypeColor = (type: RegistrationRequest['type']) => {
    switch (type) {
      case 'registration':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'application':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'trial':
        return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, action: 'approve' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Approval failed');
      }

      const request = registrations.find((r) => r.id === requestId);
      if (!request) {
        toast.error('Antrag nicht gefunden');
        return;
      }

      // Send approval email (fire and forget)
      fetch('/api/emails/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'approval',
          recipientName: `${request.applicant.firstName} ${request.applicant.lastName}`,
          recipientEmail: request.applicant.email,
          clubName: 'SwingZ Tennis Club',
          memberType: request.type === 'trial' ? 'trial' : 'member',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          assignedGroup: request.tennisInfo.preferredDays[0] || 'Gruppe A',
          clubAddress: 'Tennisstraße 123, 12345 Tennisstadt',
          clubPhone: '+49 123 456 7890',
          clubEmail: 'info@swingz.app',
        }),
      }).catch(() => {});

      setRegistrations((prev) =>
        prev.map((reg) =>
          reg.id === requestId
            ? {
                ...reg,
                status: 'approved',
                reviewedAt: new Date().toISOString(),
                reviewedBy: 'Admin User',
              }
            : reg
        )
      );

      toast.success('Antrag genehmigt und E-Mail versendet');
      setSelectedRequest(null);
      setRejectionReason('');
      setNotes('');
    } catch (error) {
      toast.error('Fehler bei der Genehmigung');
      console.error('Approval error:', error);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Bitte gib einen Ablehnungsgrund an');
      return;
    }

    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          action: 'reject',
          rejectionReason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Rejection failed');
      }

      const request = registrations.find((r) => r.id === requestId);
      if (!request) {
        toast.error('Antrag nicht gefunden');
        return;
      }

      // Send rejection email (fire and forget)
      fetch('/api/emails/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'rejection',
          recipientName: `${request.applicant.firstName} ${request.applicant.lastName}`,
          recipientEmail: request.applicant.email,
          clubName: 'SwingZ Tennis Club',
          reason: rejectionReason,
          clubAddress: 'Tennisstraße 123, 12345 Tennisstadt',
          clubPhone: '+49 123 456 7890',
          clubEmail: 'info@swingz.app',
        }),
      }).catch(() => {});

      setRegistrations((prev) =>
        prev.map((reg) =>
          reg.id === requestId
            ? {
                ...reg,
                status: 'rejected',
                rejectionReason,
                reviewedAt: new Date().toISOString(),
                reviewedBy: 'Admin User',
              }
            : reg
        )
      );

      toast.success('Antrag abgelehnt und E-Mail versendet');
      setSelectedRequest(null);
      setRejectionReason('');
      setNotes('');
    } catch (error) {
      toast.error('Fehler bei der Ablehnung');
      console.error('Rejection error:', error);
    }
  };

  const handlePutOnHold = async (requestId: string) => {
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, action: 'hold' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Hold failed');
      }

      setRegistrations((prev) =>
        prev.map((reg) =>
          reg.id === requestId
            ? {
                ...reg,
                status: 'on_hold',
                reviewedAt: new Date().toISOString(),
                reviewedBy: 'Admin User',
              }
            : reg
        )
      );

      toast.success('Antrag zurückgestellt');
    } catch (error) {
      toast.error('Fehler beim Zurückstellen');
      console.error('Hold error:', error);
    }
  };

  const handleViewDetails = (request: RegistrationRequest) => {
    setSelectedRequest(request);
    setNotes(request.notes || '');
  };

  const handleSaveNotes = async (requestId: string) => {
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, action: 'update_notes', notes }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }

      setRegistrations((prev) =>
        prev.map((reg) => (reg.id === requestId ? { ...reg, notes } : reg))
      );

      toast.success('Notizen gespeichert');
    } catch (error) {
      toast.error('Fehler beim Speichern der Notizen');
      console.error('Notes save error:', error);
    }
  };

  const getExperienceLabel = (experience: string) => {
    const labels: Record<string, string> = {
      beginner: 'Anfänger',
      intermediate: 'Fortgeschritten',
      advanced: 'Erfahren',
      competitive: 'Wettkämpfer',
    };
    return labels[experience] || experience;
  };

  const getPlayingLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      ntr: 'NTR 1-3',
      ntr4: 'NTR 4-5',
      ntr6: 'NTR 6-7',
      ntr8: 'NTR 8+',
    };
    return labels[level] || level;
  };

  const pendingCount = registrations.filter((r) => r.status === 'pending').length;
  const approvedCount = registrations.filter((r) => r.status === 'approved').length;
  const rejectedCount = registrations.filter((r) => r.status === 'rejected').length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Admin-Genehmigungsworkflow</h1>
          <p className="text-gray-500">Verwalte Registrierungen und Bewerbungen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          value={pendingCount}
          label="Ausstehend"
          sublabel="Warten auf Entscheidung"
          iconClassName="bg-yellow-100"
          valueClassName="text-yellow-600"
        />

        <StatCard
          icon={CheckCircle}
          value={approvedCount}
          label="Genehmigt"
          sublabel="Erfolgreich genehmigt"
          iconClassName="bg-green-100"
          valueClassName="text-green-600"
        />

        <StatCard
          icon={XCircle}
          value={rejectedCount}
          label="Abgelehnt"
          sublabel="Abgelehnte Anträge"
          iconClassName="bg-red-100"
          valueClassName="text-red-600"
        />

        <StatCard
          icon={FileText}
          value={registrations.length}
          label="Gesamt"
          sublabel="Alle Anträge"
          iconClassName="bg-gray-100"
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
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="all">Alle Typen</option>
            <option value="registration">Registrierungen</option>
            <option value="application">Bewerbungen</option>
            <option value="trial">Probetrainings</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={selectedTab}
        onValueChange={(value) =>
          setSelectedTab(value as 'approved' | 'pending' | 'rejected' | 'all')
        }
      >
        <TabsList>
          <TabsTrigger value="all">Alle ({registrations.length})</TabsTrigger>
          <TabsTrigger value="pending">Ausstehend ({pendingCount})</TabsTrigger>
          <TabsTrigger value="approved">Genehmigt ({approvedCount})</TabsTrigger>
          <TabsTrigger value="rejected">Abgelehnt ({rejectedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              </CardContent>
            </Card>
          ) : filteredRegistrations.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">Keine Anträge gefunden</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredRegistrations.map((request) => (
                <Card
                  key={request.id}
                  className={`transition-all hover:shadow-md ${
                    request.status === 'pending' ? 'border-l-4 border-l-yellow-500' : ''
                  }`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className={getTypeColor(request.type)}>
                            {getTypeLabel(request.type)}
                          </Badge>
                          <Badge variant="outline" className={getStatusColor(request.status)}>
                            {getStatusLabel(request.status)}
                          </Badge>
                          {request.status === 'pending' && (
                            <Badge variant="default" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Neu
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-brand-primary/10 rounded-lg">
                            <User className="h-5 w-5 text-brand-primary" />
                          </div>
                          <div>
                            <div className="font-semibold">
                              {request.applicant.firstName} {request.applicant.lastName}
                            </div>
                            <div className="text-sm text-gray-600">{request.applicant.email}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span>{request.applicant.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>
                              {format(parseISO(request.applicant.dateOfBirth), 'dd.MM.yyyy', {
                                locale: de,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-gray-400" />
                            <span>{getExperienceLabel(request.tennisInfo.experience)}</span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Ziele:</span> {request.tennisInfo.goals}
                          </div>
                          {request.additionalInfo?.motivation && (
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Motivation:</span>{' '}
                              {request.additionalInfo.motivation}
                            </div>
                          )}
                        </div>

                        <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-4">
                            <span>
                              Eingereicht:{' '}
                              {format(parseISO(request.submittedAt), 'dd.MM.yyyy HH:mm', {
                                locale: de,
                              })}
                            </span>
                            {request.reviewedAt && (
                              <span>
                                Bearbeitet:{' '}
                                {format(parseISO(request.reviewedAt), 'dd.MM.yyyy HH:mm', {
                                  locale: de,
                                })}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(request)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                        </div>
                      </div>

                      {/* Actions */}
                      {request.status === 'pending' && (
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request.id)}
                            className="gap-1"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Genehmigen
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePutOnHold(request.id)}
                            className="gap-1"
                          >
                            <Clock className="h-4 w-4" />
                            Zurückstellen
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setSelectedRequest(request)}
                            className="gap-1"
                          >
                            <XCircle className="h-4 w-4" />
                            Ablehnen
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
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Antrag Details</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setSelectedRequest(null)}>
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getTypeColor(selectedRequest.type)}>
                  {getTypeLabel(selectedRequest.type)}
                </Badge>
                <Badge variant="outline" className={getStatusColor(selectedRequest.status)}>
                  {getStatusLabel(selectedRequest.status)}
                </Badge>
              </div>

              {/* Personal Information */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Persönliche Informationen
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <div className="font-medium">
                      {selectedRequest.applicant.firstName} {selectedRequest.applicant.lastName}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">E-Mail:</span>
                    <div className="font-medium">{selectedRequest.applicant.email}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Telefon:</span>
                    <div className="font-medium">{selectedRequest.applicant.phone}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Geburtsdatum:</span>
                    <div className="font-medium">
                      {format(parseISO(selectedRequest.applicant.dateOfBirth), 'dd. MMMM yyyy', {
                        locale: de,
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Adresse
                </h3>
                <div className="text-sm">
                  {selectedRequest.address.street} {selectedRequest.address.houseNumber}
                  <br />
                  {selectedRequest.address.postalCode} {selectedRequest.address.city}
                </div>
              </div>

              {/* Tennis Information */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Tennis-Erfahrung
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Erfahrung:</span>
                    <span className="ml-2 font-medium">
                      {getExperienceLabel(selectedRequest.tennisInfo.experience)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Spielstärke:</span>
                    <span className="ml-2 font-medium">
                      {getPlayingLevelLabel(selectedRequest.tennisInfo.playingLevel)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Bevorzugte Tage:</span>
                    <div className="ml-2 flex flex-wrap gap-1">
                      {selectedRequest.tennisInfo.preferredDays.map((day) => (
                        <Badge key={day} variant="secondary" className="text-xs">
                          {day}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Ziele:</span>
                    <div className="ml-2">{selectedRequest.tennisInfo.goals}</div>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              {selectedRequest.additionalInfo && (
                <div>
                  <h3 className="font-semibold mb-3">Zusätzliche Informationen</h3>
                  <div className="space-y-2 text-sm">
                    {selectedRequest.additionalInfo.motivation && (
                      <div>
                        <span className="text-gray-600">Motivation:</span>
                        <div className="ml-2">{selectedRequest.additionalInfo.motivation}</div>
                      </div>
                    )}
                    {selectedRequest.additionalInfo.availability && (
                      <div>
                        <span className="text-gray-600">Verfügbarkeit:</span>
                        <div className="ml-2">{selectedRequest.additionalInfo.availability}</div>
                      </div>
                    )}
                    {selectedRequest.additionalInfo.previousClubs && (
                      <div>
                        <span className="text-gray-600">Vorherige Clubs:</span>
                        <div className="ml-2">{selectedRequest.additionalInfo.previousClubs}</div>
                      </div>
                    )}
                    {selectedRequest.additionalInfo.specialRequirements && (
                      <div>
                        <span className="text-gray-600">Besondere Anforderungen:</span>
                        <div className="ml-2">
                          {selectedRequest.additionalInfo.specialRequirements}
                        </div>
                      </div>
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
                  placeholder="Interne Notizen für diesen Antrag..."
                  rows={3}
                />
                <Button
                  size="sm"
                  onClick={() => handleSaveNotes(selectedRequest.id)}
                  className="mt-2"
                >
                  Notizen speichern
                </Button>
              </div>

              {/* Rejection */}
              {selectedRequest.status === 'pending' && (
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-3 text-red-600">Ablehnen</h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="rejectionReason">Grund der Ablehnung *</Label>
                      <select
                        id="rejectionReason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      >
                        <option value="">Bitte auswählen...</option>
                        <option value="capacity">Keine Kapazität</option>
                        <option value="requirements">Anforderungen nicht erfüllt</option>
                        <option value="incomplete">Unvollständige Bewerbung</option>
                        <option value="other">Sonstiges</option>
                      </select>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(selectedRequest.id)}
                      disabled={!rejectionReason}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Antrag ablehnen
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedRequest.status === 'pending' && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => handleApprove(selectedRequest.id)} className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Genehmigen
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handlePutOnHold(selectedRequest.id)}
                    className="flex-1"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Zurückstellen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
