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
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  XCircle,
  Plus,
  Edit,
  Save,
  Filter,
  Search,
  Download,
  Users,
  Shield,
  PhoneCall,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

export interface Member {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address?: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
  };
  memberType: 'member' | 'trial' | 'inactive';
  membershipStatus: 'active' | 'inactive' | 'suspended' | 'terminated';
  membershipStart?: string;
  membershipEnd?: string;
  trainingGroup?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function MemberListManagement() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Member>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive' | 'suspended' | 'terminated'
  >('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'member' | 'trial' | 'inactive'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/members');
      if (!response.ok) {
        throw new Error('Failed to load members');
      }
      const data = await response.json();
      setMembers(data.members || []);
    } catch (error) {
      console.error('Failed to load members:', error);
      toast.error('Fehler beim Laden der Mitglieder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (member: Member) => {
    setSelectedMember(member);
    setEditForm(member);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedMember) return;

    try {
      const response = await fetch(`/api/members/${selectedMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error('Failed to update member');
      }

      const data = await response.json();

      setMembers((prev) => prev.map((m) => (m.id === selectedMember.id ? data.member : m)));

      setSelectedMember(data.member);
      setIsEditing(false);
      toast.success('Mitglied erfolgreich aktualisiert');
    } catch (error) {
      toast.error('Fehler beim Aktualisieren des Mitglieds');
      console.error('Update error:', error);
    }
  };

  const handleStatusChange = async (memberId: string, newStatus: Member['membershipStatus']) => {
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipStatus: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const data = await response.json();

      setMembers((prev) => prev.map((m) => (m.id === memberId ? data.member : m)));

      toast.success(`Status aktualisiert`);
    } catch (error) {
      toast.error('Fehler beim Aktualisieren des Status');
      console.error('Status update error:', error);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Möchten Sie dieses Mitglied wirklich löschen?')) {
      return;
    }

    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete member');
      }

      setMembers(members.filter((m) => m.id !== memberId));
      toast.success('Mitglied erfolgreich gelöscht');
    } catch (error) {
      toast.error('Fehler beim Löschen des Mitglieds');
      console.error('Delete error:', error);
    }
  };

  const getStatusColor = (status: Member['membershipStatus']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'terminated':
        return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const getStatusLabel = (status: Member['membershipStatus']) => {
    switch (status) {
      case 'active':
        return 'Aktiv';
      case 'inactive':
        return 'Inaktiv';
      case 'suspended':
        return 'Gesperrt';
      case 'terminated':
        return 'Beendet';
    }
  };

  const getTypeColor = (type: Member['memberType']) => {
    switch (type) {
      case 'member':
        return 'bg-blue-100 text-blue-700';
      case 'trial':
        return 'bg-purple-100 text-purple-700';
      case 'inactive':
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type: Member['memberType']) => {
    switch (type) {
      case 'member':
        return 'Mitglied';
      case 'trial':
        return 'Probetraining';
      case 'inactive':
        return 'Inaktiv';
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesStatus = statusFilter === 'all' || member.membershipStatus === statusFilter;
    const matchesType = typeFilter === 'all' || member.memberType === typeFilter;
    const matchesSearch =
      searchQuery === '' ||
      `${member.firstName} ${member.lastName} ${member.email}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    return matchesStatus && matchesType && matchesSearch;
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
          <h1 className="text-2xl font-bold text-brand-primary">Mitgliederliste verwalten</h1>
          <p className="text-gray-500">Übersicht und Management aller Mitglieder</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Neues Mitglied
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
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="all">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Inaktiv</option>
            <option value="suspended">Gesperrt</option>
            <option value="terminated">Beendet</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="all">Alle Typen</option>
            <option value="member">Mitglieder</option>
            <option value="trial">Probetrainings</option>
            <option value="inactive">Inaktiv</option>
          </select>
        </div>
      </div>

      {/* Member List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map((member) => (
          <Card
            key={member.id}
            className="cursor-pointer hover:shadow-md transition-all"
            onClick={() => setSelectedMember(member)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-brand-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {member.firstName} {member.lastName}
                    </CardTitle>
                    <p className="text-sm text-gray-600">{member.email}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className={getStatusColor(member.membershipStatus)}>
                    {getStatusLabel(member.membershipStatus)}
                  </Badge>
                  <Badge className={getTypeColor(member.memberType)}>
                    {getTypeLabel(member.memberType)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{member.phone}</span>
                </div>
                {member.trainingGroup && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>{member.trainingGroup}</span>
                  </div>
                )}
                {member.membershipStart && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Seit{' '}
                      {format(parseISO(member.membershipStart), 'dd. MMM yyyy', { locale: de })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Member Details Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {selectedMember.firstName} {selectedMember.lastName}
                  </CardTitle>
                  <p className="text-gray-500">{selectedMember.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={getStatusColor(selectedMember.membershipStatus)}
                  >
                    {getStatusLabel(selectedMember.membershipStatus)}
                  </Badge>
                  <Badge className={getTypeColor(selectedMember.memberType)}>
                    {getTypeLabel(selectedMember.memberType)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedMember(null);
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
                  <TabsTrigger value="membership">Mitgliedschaft</TabsTrigger>
                  <TabsTrigger value="contact">Kontakt</TabsTrigger>
                  <TabsTrigger value="emergency">Notfallkontakt</TabsTrigger>
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
                            onChange={(e) =>
                              setEditForm({ ...editForm, firstName: e.target.value })
                            }
                          />
                        ) : (
                          <div className="mt-1">{selectedMember.firstName}</div>
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
                          <div className="mt-1">{selectedMember.lastName}</div>
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
                          <div className="mt-1">{selectedMember.email}</div>
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
                          <div className="mt-1">{selectedMember.phone}</div>
                        )}
                      </div>
                      <div>
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
                          <div className="mt-1">
                            {format(parseISO(selectedMember.dateOfBirth), 'dd. MMMM yyyy', {
                              locale: de,
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  {selectedMember.address && (
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Adresse
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Straße</Label>
                          {isEditing ? (
                            <Input
                              value={editForm.address?.street || ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  address: {
                                    ...editForm.address,
                                    street: e.target.value,
                                  } as Member['address'],
                                })
                              }
                            />
                          ) : (
                            <div className="mt-1">{selectedMember.address.street}</div>
                          )}
                        </div>
                        <div>
                          <Label>Hausnummer</Label>
                          {isEditing ? (
                            <Input
                              value={editForm.address?.houseNumber || ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  address: {
                                    ...editForm.address,
                                    houseNumber: e.target.value,
                                  } as Member['address'],
                                })
                              }
                            />
                          ) : (
                            <div className="mt-1">{selectedMember.address.houseNumber}</div>
                          )}
                        </div>
                        <div>
                          <Label>Postleitzahl</Label>
                          {isEditing ? (
                            <Input
                              value={editForm.address?.postalCode || ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  address: {
                                    ...editForm.address,
                                    postalCode: e.target.value,
                                  } as Member['address'],
                                })
                              }
                            />
                          ) : (
                            <div className="mt-1">{selectedMember.address.postalCode}</div>
                          )}
                        </div>
                        <div>
                          <Label>Stadt</Label>
                          {isEditing ? (
                            <Input
                              value={editForm.address?.city || ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  address: {
                                    ...editForm.address,
                                    city: e.target.value,
                                  } as Member['address'],
                                })
                              }
                            />
                          ) : (
                            <div className="mt-1">{selectedMember.address.city}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="membership" className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Mitgliedschaft
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Mitgliedschaftstyp</Label>
                        {isEditing ? (
                          <select
                            value={editForm.memberType || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                memberType: e.target.value as Member['memberType'],
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                          >
                            <option value="member">Mitglied</option>
                            <option value="trial">Probetraining</option>
                            <option value="inactive">Inaktiv</option>
                          </select>
                        ) : (
                          <div className="mt-1">{getTypeLabel(selectedMember.memberType)}</div>
                        )}
                      </div>
                      <div>
                        <Label>Status</Label>
                        {isEditing ? (
                          <select
                            value={editForm.membershipStatus || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                membershipStatus: e.target.value as Member['membershipStatus'],
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                          >
                            <option value="active">Aktiv</option>
                            <option value="inactive">Inaktiv</option>
                            <option value="suspended">Gesperrt</option>
                            <option value="terminated">Beendet</option>
                          </select>
                        ) : (
                          <div className="mt-1">
                            {getStatusLabel(selectedMember.membershipStatus)}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label>Mitgliedschaftsstart</Label>
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editForm.membershipStart || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, membershipStart: e.target.value })
                            }
                          />
                        ) : (
                          <div className="mt-1">
                            {selectedMember.membershipStart
                              ? format(parseISO(selectedMember.membershipStart), 'dd. MMM yyyy', {
                                  locale: de,
                                })
                              : 'Nicht festgelegt'}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label>Mitgliedschaftsende</Label>
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editForm.membershipEnd || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, membershipEnd: e.target.value })
                            }
                          />
                        ) : (
                          <div className="mt-1">
                            {selectedMember.membershipEnd
                              ? format(parseISO(selectedMember.membershipEnd), 'dd. MMM yyyy', {
                                  locale: de,
                                })
                              : 'Nicht festgelegt'}
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <Label>Trainingsgruppe</Label>
                        {isEditing ? (
                          <Input
                            value={editForm.trainingGroup || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, trainingGroup: e.target.value })
                            }
                          />
                        ) : (
                          <div className="mt-1">
                            {selectedMember.trainingGroup || 'Nicht zugewiesen'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="contact" className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Kontaktinformationen
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-600">E-Mail</div>
                          <div className="font-medium">{selectedMember.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-600">Telefon</div>
                          <div className="font-medium">{selectedMember.phone}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="emergency" className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <PhoneCall className="h-5 w-5" />
                      Notfallkontakt
                    </h3>
                    {selectedMember.emergencyContact ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-600">Name</div>
                            <div className="font-medium">
                              {selectedMember.emergencyContact.name}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-600">Telefon</div>
                            <div className="font-medium">
                              {selectedMember.emergencyContact.phone}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-600">Beziehung</div>
                            <div className="font-medium">
                              {selectedMember.emergencyContact.relationship}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-500">Kein Notfallkontakt hinterlegt</div>
                    )}
                  </div>
                </TabsContent>

                {/* Notes */}
                <div className="pt-6 border-t">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notizen
                  </h3>
                  {isEditing ? (
                    <Textarea
                      value={editForm.notes || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={4}
                      placeholder="Interne Notizen..."
                    />
                  ) : (
                    <div className="text-gray-700">
                      {selectedMember.notes || 'Keine Notizen vorhanden'}
                    </div>
                  )}
                </div>

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
                          setEditForm(selectedMember);
                        }}
                        className="flex-1"
                      >
                        Abbrechen
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => handleEdit(selectedMember)} className="flex-1">
                        <Edit className="h-4 w-4 mr-2" />
                        Bearbeiten
                      </Button>
                      {selectedMember.membershipStatus === 'active' && (
                        <Button
                          variant="outline"
                          onClick={() => handleStatusChange(selectedMember.id, 'suspended')}
                          className="flex-1"
                        >
                          Sperren
                        </Button>
                      )}
                      {selectedMember.membershipStatus !== 'active' && (
                        <Button
                          variant="outline"
                          onClick={() => handleStatusChange(selectedMember.id, 'active')}
                          className="flex-1"
                        >
                          Aktivieren
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteMember(selectedMember.id)}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Löschen
                      </Button>
                    </>
                  )}
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
