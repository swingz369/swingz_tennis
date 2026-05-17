'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  User,
  MapPin,
  Calendar,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Info,
  Shield,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface RegistrationFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  experience: string;
  playingLevel: string;
  preferredDays: string[];
  goals: string;
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

const DAYS_OF_WEEK = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const STEPS = [
  { id: 1, title: 'Persönlich', subtitle: 'Name & Kontakt', icon: User },
  { id: 2, title: 'Adresse', subtitle: 'Anschrift', icon: MapPin },
  { id: 3, title: 'Tennis', subtitle: 'Erfahrung & Ziele', icon: Calendar },
  { id: 4, title: 'Bestätigen', subtitle: 'Zustimmung', icon: CheckCircle },
];

/* ── Styled Select ── */
function StyledSelect({
  id,
  name,
  value,
  onChange,
  required,
  options,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full h-12 px-4 pr-10 rounded-xl border border-gray-200 bg-white text-gray-900 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all text-sm"
      >
        <option value="">Bitte auswählen...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

/* Need ChevronDown for select */
import { ChevronDown } from 'lucide-react';

export default function PublicRegistration() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = (currentStep / STEPS.length) * 100;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
          formData.experience !== '' && formData.playingLevel !== '' && formData.goals.trim() !== ''
        );
      case 4:
        return formData.acceptTerms && formData.acceptPrivacy && formData.acceptDataProcessing;
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
      const res = await fetch('/api/public/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth,
          street: formData.street,
          houseNumber: formData.houseNumber,
          postalCode: formData.postalCode,
          city: formData.city,
          experience: formData.experience,
          playingLevel: formData.playingLevel,
          preferredDays: formData.preferredDays,
          goals: formData.goals,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Registrierung fehlgeschlagen');
      }

      toast.success('Anmeldung erfolgreich! Wir prüfen deine Daten und melden uns in Kürze.');
      setFormData(INITIAL_FORM_DATA);
      setCurrentStep(1);
    } catch (error: any) {
      toast.error(error.message || 'Fehler bei der Anmeldung. Bitte versuche es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4 animate-fade-in">
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
                  className="h-12 rounded-xl"
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
                  className="h-12 rounded-xl"
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
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon *</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+49 123 456 7890"
                  required
                  className="h-12 rounded-xl"
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
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4 animate-fade-in">
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
                  className="h-12 rounded-xl"
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
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">PLZ *</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  placeholder="12345"
                  required
                  className="h-12 rounded-xl"
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
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5 animate-fade-in">
            <div className="space-y-2">
              <Label htmlFor="experience">Tennis-Erfahrung *</Label>
              <StyledSelect
                id="experience"
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                required
                options={[
                  { value: 'beginner', label: 'Anfänger (0-1 Jahre)' },
                  { value: 'intermediate', label: 'Fortgeschritten (1-3 Jahre)' },
                  { value: 'advanced', label: 'Erfahren (3+ Jahre)' },
                  { value: 'competitive', label: 'Wettkampferfahrung' },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="playingLevel">Spielstärke *</Label>
              <StyledSelect
                id="playingLevel"
                name="playingLevel"
                value={formData.playingLevel}
                onChange={handleChange}
                required
                options={[
                  { value: 'ntr', label: 'NTR 1-3 (Anfänger)' },
                  { value: 'ntr4', label: 'NTR 4-5 (Fortgeschritten)' },
                  { value: 'ntr6', label: 'NTR 6-7 (Erfahren)' },
                  { value: 'ntr8', label: 'NTR 8+ (Turnierspieler)' },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Bevorzugte Trainingstage</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => {
                  const isActive = formData.preferredDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handlePreferredDayToggle(day)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                        isActive
                          ? 'bg-gradient-to-r from-brand-primary to-brand-light text-white shadow-md'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-light/40 hover:text-brand-primary'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
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
                className="rounded-xl"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5 animate-fade-in">
            <div className="space-y-4">
              {[
                {
                  id: 'acceptTerms',
                  label: 'AGB akzeptieren',
                  desc: 'Bitte lies unsere AGB sorgfältig durch',
                  checked: formData.acceptTerms,
                },
                {
                  id: 'acceptPrivacy',
                  label: 'Datenschutzrichtlinie akzeptieren',
                  desc: 'Informationen zur Verarbeitung deiner Daten',
                  checked: formData.acceptPrivacy,
                },
                {
                  id: 'acceptDataProcessing',
                  label: 'Datenverarbeitung zustimmen',
                  desc: 'Erforderlich für die Mitgliedsverwaltung',
                  checked: formData.acceptDataProcessing,
                },
              ].map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <Checkbox
                    id={item.id}
                    checked={item.checked}
                    onCheckedChange={(checked) => handleCheckboxChange(item.id, checked as boolean)}
                  />
                  <div>
                    <Label htmlFor={item.id} className="cursor-pointer font-medium text-gray-900">
                      {item.label} *
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Card className="bg-blue-50/50 border-blue-100 rounded-2xl">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2 text-sm text-blue-800">
                    <p className="font-semibold">Was passiert nach deiner Anmeldung?</p>
                    <ul className="space-y-1.5 text-blue-700">
                      {[
                        'Wir prüfen deine Anmeldung innerhalb von 2 Werktagen',
                        'Du erhältst eine E-Mail mit weiteren Informationen',
                        'Nach Genehmigung kannst du sofort mit dem Training beginnen',
                        'Deine Daten werden sicher und DSGVO-konform gespeichert',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
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
    <div className="min-h-screen bg-gradient-to-br from-brand-primary/5 via-white to-blue-50/50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/8 text-brand-primary text-sm font-semibold mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Mitglied werden
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            Deine Tennis-Reise beginnt hier
          </h1>
          <p className="text-gray-500">Nur 4 Schritte — in 3 Minuten erledigt</p>
        </div>

        {/* Step Indicators */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isCompleted = idx < currentStep - 1;
              const isCurrent = idx === currentStep - 1;
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                        isCompleted
                          ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                          : isCurrent
                            ? 'bg-gradient-to-br from-brand-primary to-brand-light text-white shadow-lg shadow-brand-primary/20 scale-110'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-semibold text-center leading-tight hidden sm:block ${isCurrent ? 'text-brand-primary' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 -mt-5 transition-colors duration-500 ${idx < currentStep - 1 ? 'bg-green-500' : 'bg-gray-200'}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-1.5 rounded-full" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-medium text-gray-500">
              Schritt {currentStep} von {STEPS.length}
            </span>
            <span className="text-xs text-gray-400">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Form Card */}
        <Card className="border-0 shadow-premium rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-brand-primary/3 to-transparent pb-5">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-light text-white shadow-md">
                {(() => {
                  const StepIcon = STEPS[currentStep - 1].icon;
                  return <StepIcon className="h-5 w-5" />;
                })()}
              </div>
              <div>
                <span className="text-gray-900">{STEPS[currentStep - 1].title}</span>
                <p className="text-xs text-gray-500 font-normal mt-0.5">
                  {STEPS[currentStep - 1].subtitle}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit}>
              {renderStepContent()}

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  className="rounded-xl"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Zurück
                </Button>

                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="rounded-xl bg-gradient-to-r from-brand-primary to-brand-light text-white shadow-md hover:shadow-lg"
                  >
                    Weiter
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-brand-primary to-brand-light text-white shadow-md hover:shadow-lg"
                  >
                    {isSubmitting ? 'Wird gesendet...' : 'Anmeldung absenden'}
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer Info */}
        <Card className="mt-5 bg-gray-50/50 border-gray-100 rounded-2xl">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-1 text-sm text-gray-600">
                <p className="font-semibold text-gray-700">Datenschutz & Sicherheit</p>
                <p>
                  Deine Daten werden sicher und DSGVO-konform gespeichert. Du kannst deine
                  Einwilligung jederzeit widerrufen.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Bereits Mitglied?{' '}
            <a
              href="/login"
              className="text-brand-primary hover:text-brand-light font-semibold transition-colors hover:underline"
            >
              Hier anmelden
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
