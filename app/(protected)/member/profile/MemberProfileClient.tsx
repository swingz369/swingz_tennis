'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Calendar,
  Phone,
  MapPin,
  Shield,
  FileText,
  Save,
  Edit,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

interface Member {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  include_in_planning: boolean;
  joined_at: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  date_of_birth: string | null;
  bio: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
}

interface Props {
  member: Member;
}

export function MemberProfileClient({ member }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: member.phone || '',
    address: member.address || '',
    city: member.city || '',
    postal_code: member.postal_code || '',
    date_of_birth: member.date_of_birth || '',
    bio: member.bio || '',
    emergency_contact: member.emergency_contact || '',
    emergency_phone: member.emergency_phone || '',
  });

  useEffect(() => {
    setEditForm({
      phone: member.phone || '',
      address: member.address || '',
      city: member.city || '',
      postal_code: member.postal_code || '',
      date_of_birth: member.date_of_birth || '',
      bio: member.bio || '',
      emergency_contact: member.emergency_contact || '',
      emergency_phone: member.emergency_phone || '',
    });
  }, [member]);

  const handleSave = async () => {
    try {
      const res = await apiFetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: editForm.phone || null,
          address: editForm.address || null,
          city: editForm.city || null,
          postalCode: editForm.postal_code || null,
          dateOfBirth: editForm.date_of_birth || null,
          bio: editForm.bio || null,
          emergencyContact: editForm.emergency_contact || null,
          emergencyPhone: editForm.emergency_phone || null,
        }),
      });

      if (!res.ok) throw new Error('Fehler beim Speichern');

      setIsEditing(false);
      toast.success('Profil aktualisiert');
    } catch {
      toast.error('Fehler beim Speichern');
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Mein Profil</h1>
          <p className="text-sm text-gray-500">Verwalte deine persönlichen Daten</p>
        </div>
        <Button
          variant={isEditing ? 'default' : 'outline'}
          size="sm"
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          className="gap-2"
        >
          {isEditing ? (
            <>
              <Save className="h-4 w-4" /> Speichern
            </>
          ) : (
            <>
              <Edit className="h-4 w-4" /> Bearbeiten
            </>
          )}
        </Button>
      </div>

      {isEditing && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Bearbeitungsmodus aktiv
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs"
            onClick={() => setIsEditing(false)}
          >
            Abbrechen
          </Button>
        </div>
      )}

      <div className="grid gap-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                <User className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <CardTitle>{member.full_name}</CardTitle>
                <p className="text-sm text-gray-500">{member.email}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-gray-400" />
              {member.email}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-400" />
              Mitglied seit: {formatDate(member.joined_at)}
            </div>
            {member.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                {member.phone}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Persönliche Informationen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500">Telefon</Label>
                {isEditing ? (
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+49 123 456 7890"
                  />
                ) : (
                  <div className="font-medium">{member.phone || '—'}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-500">Geburtsdatum</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editForm.date_of_birth}
                    onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                  />
                ) : (
                  <div className="font-medium">
                    {member.date_of_birth ? formatDate(member.date_of_birth) : '—'}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Adresse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-500">Straße & Hausnummer</Label>
                {isEditing ? (
                  <Input
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Musterstraße 123"
                  />
                ) : (
                  <div className="font-medium">{member.address || '—'}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-500">PLZ</Label>
                {isEditing ? (
                  <Input
                    value={editForm.postal_code}
                    onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                    placeholder="12345"
                  />
                ) : (
                  <div className="font-medium">{member.postal_code || '—'}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-500">Stadt</Label>
                {isEditing ? (
                  <Input
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    placeholder="Musterstadt"
                  />
                ) : (
                  <div className="font-medium">{member.city || '—'}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" /> Notfallkontakt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500">Name</Label>
                {isEditing ? (
                  <Input
                    value={editForm.emergency_contact}
                    onChange={(e) =>
                      setEditForm({ ...editForm, emergency_contact: e.target.value })
                    }
                    placeholder="Max Mustermann"
                  />
                ) : (
                  <div className="font-medium">{member.emergency_contact || '—'}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-500">Telefon</Label>
                {isEditing ? (
                  <Input
                    value={editForm.emergency_phone}
                    onChange={(e) => setEditForm({ ...editForm, emergency_phone: e.target.value })}
                    placeholder="+49 123 456 7890"
                  />
                ) : (
                  <div className="font-medium">{member.emergency_phone || '—'}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Über mich
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                placeholder="Erzähle etwas über dich..."
                rows={3}
              />
            ) : (
              <div className="text-sm text-gray-600">{member.bio || 'Noch keine Bio'}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
