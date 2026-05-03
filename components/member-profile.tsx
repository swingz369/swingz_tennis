'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { User, Mail, Phone, MapPin, Save, Camera, Shield, Bell, CreditCard, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useUserMember } from '@/hooks/use-user-data';

export default function MemberProfile() {
  const { data: memberData, isLoading } = useUserMember();

   const [formData, setFormData] = useState({
     fullName: memberData?.fullName || '',
     email: memberData?.email || '',
     phone: memberData?.phone || '',
     address: memberData?.address || '',
     city: memberData?.city || '',
     postalCode: memberData?.postalCode || '',
     bio: memberData?.bio || '',
     emergencyContact: memberData?.emergencyContact || '',
     emergencyPhone: memberData?.emergencyPhone || '',
   });

   const [isSaving, setIsSaving] = useState(false);

   // Placeholder for SEPA mandate info - TODO: implement actual data fetching
   const hasActiveMandate = false;
   const mandateInfo = null;

   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success('Profil erfolgreich aktualisiert');
    } catch (error) {
      toast.error('Fehler beim Speichern des Profils');
      console.error('Profile save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Mein Profil</h1>
        <p className="text-gray-500">Verwalte deine persönlichen Informationen</p>
      </div>

      {/* Profile Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Profilübersicht</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="h-12 w-12 text-gray-400" />
              </div>
              <Button
                size="icon"
                className="absolute bottom-0 right-0 rounded-full"
                variant="outline"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{formData.fullName || 'Mitglied'}</h3>
              <p className="text-gray-600">{formData.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm bg-brand-primary/10 text-brand-primary px-2 py-1 rounded">
                  Aktives Mitglied
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Persönliche Informationen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Vollständiger Name *</Label>
              <Input
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Max Mustermann"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-Mail *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="max@example.com"
                disabled
              />
              <p className="text-xs text-gray-500">E-Mail kann nicht geändert werden</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefonnummer</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+49 123 456 7890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postalCode">Postleitzahl</Label>
              <Input
                id="postalCode"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                placeholder="12345"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Straße und Hausnummer</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Musterstraße 123"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="city">Stadt</Label>
              <Input
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Musterstadt"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Notfallkontakt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Name des Notfallkontakts</Label>
              <Input
                id="emergencyContact"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleChange}
                placeholder="Erika Mustermann"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyPhone">Telefonnummer des Notfallkontakts</Label>
              <Input
                id="emergencyPhone"
                name="emergencyPhone"
                type="tel"
                value={formData.emergencyPhone}
                onChange={handleChange}
                placeholder="+49 123 456 7890"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      <Card>
        <CardHeader>
          <CardTitle>Über mich</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="bio">Kurzbeschreibung</Label>
            <Textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              placeholder="Erzähle uns etwas über dich und deine Tennisziele..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Benachrichtigungseinstellungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">E-Mail-Benachrichtigungen</div>
                <div className="text-sm text-gray-600">
                  Erhalte E-Mails über Buchungen und Änderungen
                </div>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Erinnerungen an Trainingssessions</div>
                <div className="text-sm text-gray-600">
                  Erhalte Erinnerungen 24 Stunden vor deinen Sessions
                </div>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Newsletter</div>
                <div className="text-sm text-gray-600">
                  Erhalte Neuigkeiten und Updates vom Tennisclub
                </div>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Speichern...' : 'Änderungen speichern'}
        </Button>
      </div>
    </div>
  );
}