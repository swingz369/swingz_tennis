'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { User, Mail, Phone, MapPin, Calendar, CheckCircle, ArrowRight, ArrowLeft, Info, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface RegistrationFormData {
  // Step 1: Personal Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;

  // Step 2: Address
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;

  // Step 3: Tennis Info
  experience: string;
  playingLevel: string;
  preferredDays: string[];
  goals: string;

  // Step 4: Agreement
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptDataProcessing: boolean;
}

const INITIAL_FORM_DATA: RegistrationFormData = {
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
  acceptTerms: false,
  acceptPrivacy: false,
  acceptDataProcessing: false,
};

const STEPS = [
  { id: 1, title: 'Persönliche Daten', icon: User },
  { id: 2, title: 'Adresse', icon: MapPin },
  { id: 3, title: 'Tennis-Erfahrung', icon: Calendar },
  { id: 4, title: 'Zustimmung', icon: CheckCircle },
];

export default function PublicRegistration() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = (currentStep / STEPS.length) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return (
          formData.firstName.trim() !== '' &&
          formData.lastName.trim() !== '' &&
          formData.email.trim() !== '' &&
          formData.phone.trim() !== '' &&
          formData.dateOfBirth !== ''
        );
      case 2:
        return (
          formData.street.trim() !== '' &&
          formData.houseNumber.trim() !== '' &&
          formData.postalCode.trim() !== '' &&
          formData.city.trim() !== ''
        );
      case 3:
        return (
          formData.experience !== '' &&
          formData.playingLevel !== '' &&
          formData.goals.trim() !== ''
        );
      case 4:
        return (
          formData.acceptTerms &&
          formData.acceptPrivacy &&
          formData.acceptDataProcessing
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      toast.error('Bitte fülle alle Pflichtfelder aus');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Send welcome email
      try {
        await fetch('/api/emails/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'welcome',
            recipientName: `${formData.firstName} ${formData.lastName}`,
            recipientEmail: formData.email,
            clubName: 'SwingZ Tennis Club',
            memberType: 'member',
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            assignedGroup: formData.preferredDays[0] || 'Gruppe A',
            temporaryPassword: 'TempPass123!',
            welcomeGuideUrl: 'https://swingz.app/welcome',
            clubAddress: 'Tennisstraße 123, 12345 Tennisstadt',
            clubPhone: '+49 123 456 7890',
            clubEmail: 'info@swingz.app',
          }),
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }

      toast.success('Anmeldung erfolgreich! Wir haben dir eine Bestätigungs-E-Mail gesendet.');
      setFormData(INITIAL_FORM_DATA);
      setCurrentStep(1);
    } catch (error) {
      toast.error('Fehler bei der Anmeldung. Bitte versuche es erneut.');
      console.error('Registration error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
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
        );

      case 2:
        return (
          <div className="space-y-4">
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
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="experience">Tennis-Erfahrung *</Label>
              <select
                id="experience"
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                required
              >
                <option value="">Bitte auswählen...</option>
                <option value="beginner">Anfänger (0-1 Jahre)</option>
                <option value="intermediate">Fortgeschritten (1-3 Jahre)</option>
                <option value="advanced">Erfahren (3+ Jahre)</option>
                <option value="competitive">Wettkampferfahrung</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="playingLevel">Spielstärke *</Label>
              <select
                id="playingLevel"
                name="playingLevel"
                value={formData.playingLevel}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                required
              >
                <option value="">Bitte auswählen...</option>
                <option value="ntr">NTR 1-3 (Anfänger)</option>
                <option value="ntr4">NTR 4-5 (Fortgeschritten)</option>
                <option value="ntr6">NTR 6-7 (Erfahren)</option>
                <option value="ntr8">NTR 8+ (Turnierspieler)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Bevorzugte Trainingstage</Label>
              <div className="flex flex-wrap gap-2">
                {['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'].map((day) => (
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

            <div className="space-y-2">
              <Label htmlFor="goals">Trainingsziele *</Label>
              <Textarea
                id="goals"
                name="goals"
                value={formData.goals}
                onChange={handleChange}
                placeholder="Was möchtest du durch das Training erreichen?"
                rows={4}
                required
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="acceptTerms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => handleCheckboxChange('acceptTerms', checked as boolean)}
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
                  onCheckedChange={(checked) => handleCheckboxChange('acceptPrivacy', checked as boolean)}
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

              <div className="flex items-start gap-3">
                <Checkbox
                  id="acceptDataProcessing"
                  checked={formData.acceptDataProcessing}
                  onCheckedChange={(checked) => handleCheckboxChange('acceptDataProcessing', checked as boolean)}
                />
                <div className="space-y-1">
                  <Label htmlFor="acceptDataProcessing" className="cursor-pointer">
                    Ich willige ein, dass meine Daten für die Mitgliedschaftsverarbeitung verwendet werden *
                  </Label>
                  <p className="text-xs text-gray-600">
                    Erforderlich für die Mitgliedsverwaltung
                  </p>
                </div>
              </div>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="space-y-2 text-sm text-blue-900">
                    <p className="font-medium">Was passiert nach deiner Anmeldung?</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>Wir prüfen deine Anmeldung innerhalb von 2 Werktagen</li>
                      <li>Du erhältst eine E-Mail mit weiteren Informationen</li>
                      <li>Nach Genehmigung kannst du mit dem Training beginnen</li>
                      <li>Deine Daten werden sicher und gemäß DSGVO gespeichert</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary/10 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-primary mb-2">
            Mitglied werden
          </h1>
          <p className="text-gray-600">
            Melde dich an und werde Teil unserer Tennis-Community
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Schritt {currentStep} von {STEPS.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progress)}% abgeschlossen
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Steps Indicator */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStep - 1;
            const isCurrent = index === currentStep - 1;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${isCompleted ? 'bg-green-500 text-white' : ''}
                    ${isCurrent ? 'bg-brand-primary text-white' : ''}
                    ${!isCompleted && !isCurrent ? 'bg-gray-200 text-gray-600' : ''}
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 ${
                      index < currentStep - 1 ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {STEPS[currentStep - 1].title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              {renderStep()}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Zurück
                </Button>

                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                  >
                    Weiter
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Wird gesendet...' : 'Anmeldung absenden'}
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="mt-6 bg-gray-50 border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-gray-600 mt-0.5" />
              <div className="space-y-1 text-sm text-gray-700">
                <p className="font-medium">Datenschutz & Sicherheit</p>
                <p>
                  Deine Daten werden sicher gespeichert und gemäß den geltenden Datenschutzgesetzen behandelt.
                  Du kannst deine Einwilligung jederzeit widerrufen.
                </p>
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