'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { User, MapPin, Calendar, Send, Info, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ApplicationFormData {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;

  // Address
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;

  // Tennis Information
  experience: string;
  playingLevel: string;
  preferredDays: string[];
  goals: string;
  previousClubs: string;

  // Additional Information
  motivation: string;
  availability: string;
  specialRequirements: string;

  // Agreements
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

const INITIAL_FORM_DATA: ApplicationFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
  experience: '',
  playingLevel: '',
  preferredDays: [],
  goals: '',
  previousClubs: '',
  motivation: '',
  availability: '',
  specialRequirements: '',
  acceptTerms: false,
  acceptPrivacy: false,
};

export default function OnlineApplicationForm() {
  const [formData, setFormData] = useState<ApplicationFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handlePreferredDayToggle = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      preferredDays: prev.preferredDays.includes(day)
        ? prev.preferredDays.filter((d) => d !== day)
        : [...prev.preferredDays, day],
    }));
  };

  const validateForm = (): boolean => {
    const requiredFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'dateOfBirth',
      'street',
      'houseNumber',
      'postalCode',
      'city',
      'experience',
      'playingLevel',
      'goals',
      'motivation',
      'availability',
      'acceptTerms',
      'acceptPrivacy',
    ];

    for (const field of requiredFields) {
      if (!formData[field as keyof ApplicationFormData]) {
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Bitte fülle alle Pflichtfelder aus');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Submission failed');
      }

      toast.success('Bewerbung erfolgreich eingereicht! Wir werden uns in Kürze bei dir melden.');
      setFormData(INITIAL_FORM_DATA);
    } catch (error) {
      toast.error('Fehler bei der Bewerbung. Bitte versuche es erneut.');
      console.error('Application error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary/10 to-blue-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary/10 rounded-full mb-4">
            <FileText className="h-8 w-8 text-brand-primary" />
          </div>
          <h1 className="text-3xl font-bold text-brand-primary mb-2">Online-Bewerbung</h1>
          <p className="text-gray-600">Bewirb dich für eine Mitgliedschaft im SwingZ Tennis Club</p>
        </div>

        {/* Info Card */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-2 text-sm text-blue-900">
                <p className="font-medium">Vor deiner Bewerbung</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Stelle sicher, dass du alle Informationen korrekt angibst</li>
                  <li>Die Bearbeitungszeit beträgt in der Regel 2-5 Werktage</li>
                  <li>Du erhältst eine E-Mail mit dem Status deiner Bewerbung</li>
                  <li>Bei Fragen kontaktiere uns unter info@swingz.app</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Application Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Bewerbungsformular
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Persönliche Informationen
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Vorname *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="Max"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nachname *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Mustermann"
                      required
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
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefonnummer *</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+49 123 456 7890"
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="dateOfBirth">Geburtsdatum *</Label>
                    <Input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Adresse
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="street">Straße *</Label>
                    <Input
                      id="street"
                      name="street"
                      value={formData.street}
                      onChange={handleChange}
                      placeholder="Musterstraße"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="houseNumber">Hausnummer *</Label>
                    <Input
                      id="houseNumber"
                      name="houseNumber"
                      value={formData.houseNumber}
                      onChange={handleChange}
                      placeholder="123"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postleitzahl *</Label>
                    <Input
                      id="postalCode"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleChange}
                      placeholder="12345"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">Stadt *</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Musterstadt"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Tennis Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Tennis-Erfahrung
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="experience">Tennis-Erfahrung *</Label>
                    <Select
                      value={formData.experience}
                      onValueChange={(v) => setFormData((prev) => ({ ...prev, experience: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Bitte auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Anfänger (0-1 Jahre)</SelectItem>
                        <SelectItem value="intermediate">Fortgeschritten (1-3 Jahre)</SelectItem>
                        <SelectItem value="advanced">Erfahren (3+ Jahre)</SelectItem>
                        <SelectItem value="competitive">Wettkampferfahrung</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="playingLevel">Spielstärke *</Label>
                    <Select
                      value={formData.playingLevel}
                      onValueChange={(v) => setFormData((prev) => ({ ...prev, playingLevel: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Bitte auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ntr">NTR 1-3 (Anfänger)</SelectItem>
                        <SelectItem value="ntr4">NTR 4-5 (Fortgeschritten)</SelectItem>
                        <SelectItem value="ntr6">NTR 6-7 (Erfahren)</SelectItem>
                        <SelectItem value="ntr8">NTR 8+ (Turnierspieler)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Bevorzugte Trainingstage</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Montag',
                        'Dienstag',
                        'Mittwoch',
                        'Donnerstag',
                        'Freitag',
                        'Samstag',
                        'Sonntag',
                      ].map((day) => (
                        <Button
                          key={day}
                          type="button"
                          variant={formData.preferredDays.includes(day) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handlePreferredDayToggle(day)}
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="goals">Trainingsziele *</Label>
                    <Textarea
                      id="goals"
                      name="goals"
                      value={formData.goals}
                      onChange={handleChange}
                      placeholder="Was möchtest du durch das Training erreichen?"
                      rows={3}
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="previousClubs">Vorherige Tennisclubs</Label>
                    <Textarea
                      id="previousClubs"
                      name="previousClubs"
                      value={formData.previousClubs}
                      onChange={handleChange}
                      placeholder="Bei welchen Clubs warst du bereits Mitglied?"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Zusätzliche Informationen</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="motivation">Motivation für die Mitgliedschaft *</Label>
                    <Textarea
                      id="motivation"
                      name="motivation"
                      value={formData.motivation}
                      onChange={handleChange}
                      placeholder="Warum möchtest du Mitglied im SwingZ Tennis Club werden?"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="availability">Verfügbarkeit *</Label>
                    <Textarea
                      id="availability"
                      name="availability"
                      value={formData.availability}
                      onChange={handleChange}
                      placeholder="An welchen Tagen und Zeiten bist du für Training verfügbar?"
                      rows={3}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="specialRequirements">
                      Besondere Anforderungen oder Wünsche
                    </Label>
                    <Textarea
                      id="specialRequirements"
                      name="specialRequirements"
                      value={formData.specialRequirements}
                      onChange={handleChange}
                      placeholder="Hast du besondere Anforderungen oder Wünsche?"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Agreements */}
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="acceptTerms"
                      checked={formData.acceptTerms}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('acceptTerms', checked as boolean)
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="acceptTerms" className="cursor-pointer">
                        Ich akzeptiere die Allgemeinen Geschäftsbedingungen *
                      </Label>
                      <p className="text-xs text-gray-600">
                        Bitte lies unsere AGB sorgfältig durch
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="acceptPrivacy"
                      checked={formData.acceptPrivacy}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('acceptPrivacy', checked as boolean)
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="acceptPrivacy" className="cursor-pointer">
                        Ich akzeptiere die Datenschutzrichtlinie *
                      </Label>
                      <p className="text-xs text-gray-600">
                        Informationen zur Verarbeitung deiner Daten
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button type="submit" size="lg" disabled={isSubmitting} className="gap-2">
                  <Send className="h-4 w-4" />
                  {isSubmitting ? 'Wird gesendet...' : 'Bewerbung absenden'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="mt-6 bg-gray-50 border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-gray-600 mt-0.5" />
              <div className="space-y-2 text-sm text-gray-700">
                <p className="font-medium">Nächste Schritte</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Nach Absendung erhältst du eine Bestätigungs-E-Mail</li>
                  <li>Wir prüfen deine Bewerbung innerhalb von 2-5 Werktagen</li>
                  <li>Bei positiver Entscheidung erhältst du weitere Informationen</li>
                  <li>Du kannst jederzeit den Status deiner Bewerbung abfragen</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Login Link */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Bereits Mitglied?{' '}
            <a href="/login" className="text-brand-primary hover:underline font-medium">
              Hier anmelden
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
