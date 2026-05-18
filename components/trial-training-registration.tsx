'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, User, Mail, Send, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useUserClub } from '@/hooks/use-user-data';
import type { Session } from '@/hooks/use-sessions';
import { useSessions } from '@/hooks/use-sessions';

export default function TrialTrainingRegistration() {
  const { data: clubData } = useUserClub();
  const clubId = clubData?.clubId ?? null;
  const [clubInfo, setClubInfo] = useState<{
    address: string;
    phone: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/club/contact', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setClubInfo(data); })
      .catch(() => {});
  }, []);

  const { data: sessions = [], isLoading } = useSessions(clubId);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredDate: '',
    preferredTime: '',
    experience: '',
    goals: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const availableSessions = sessions.filter((s: Session) => !s.bookedByUser);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Send trial training email
      try {
        await fetch('/api/emails/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'trial',
            recipientName: formData.fullName,
            recipientEmail: formData.email,
            clubName: 'SwingZ Tennis Club',
            startDate: formData.preferredDate
              ? new Date(formData.preferredDate)
              : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            clubAddress: clubInfo?.address ?? '',
            clubPhone: clubInfo?.phone ?? '',
            clubEmail: clubInfo?.email ?? '',
          }),
        });
      } catch (emailError) {
        console.error('Failed to send trial training email:', emailError);
      }

      toast.success(
        'Probetraining erfolgreich gebucht! Wir haben dir eine Bestätigungs-E-Mail gesendet.'
      );
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        preferredDate: '',
        preferredTime: '',
        experience: '',
        goals: '',
        notes: '',
      });
    } catch (error) {
      toast.error('Fehler bei der Buchung. Bitte versuche es erneut.');
      console.error('Trial training booking error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSession(sessionId);
    const session = sessions.find((s: Session) => s.id === sessionId);
    if (session && session.week) {
      setFormData((prev) => ({
        ...prev,
        preferredDate: session.week,
        preferredTime: `${session.startTime} - ${session.endTime}`,
      }));
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
        <h1 className="text-2xl font-bold text-brand-primary">Probetraining anmelden</h1>
        <p className="text-gray-500">Melde dich für ein kostenloses Probetraining an</p>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-1 text-sm text-blue-900">
              <p className="font-medium">Was erwartet dich beim Probetraining?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Kostenlose 60-minütige Trainingseinheit</li>
                <li>Professionelle Trainerführung</li>
                <li>Kennenlernen unserer Anlagen und Trainer</li>
                <li>Individuelle Beratung zu passenden Trainingsgruppen</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Verfügbare Termine
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availableSessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Keine verfügbaren Termine</p>
                <p className="text-sm mt-2">
                  Schau später wieder vorbei oder kontaktiere uns direkt.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableSessions.slice(0, 5).map((session: Session) => {
                  const isSelected = selectedSession === session.id;
                  if (!session.week) return null;
                  const sessionDate = new Date(session.week);

                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSessionSelect(session.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-brand-primary/10 border-brand-primary/30'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold">
                            {sessionDate.toLocaleDateString('de-DE', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                            })}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>
                                {session.startTime} - {session.endTime}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{session.trainerName || 'Trainer'}</span>
                            </div>
                          </div>
                        </div>
                        {isSelected && <CheckCircle className="h-5 w-5 text-brand-primary" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Anmeldeformular
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Vollständiger Name *</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Max Mustermann"
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredDate">Bevorzugtes Datum</Label>
                  <Input
                    id="preferredDate"
                    name="preferredDate"
                    type="date"
                    value={formData.preferredDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferredTime">Bevorzugte Uhrzeit</Label>
                  <Input
                    id="preferredTime"
                    name="preferredTime"
                    value={formData.preferredTime}
                    onChange={handleChange}
                    placeholder="z.B. 10:00 - 11:00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience">Tennis-Erfahrung</Label>
                <select
                  id="experience"
                  name="experience"
                  value={formData.experience}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="">Bitte auswählen...</option>
                  <option value="beginner">Anfänger (0-1 Jahre)</option>
                  <option value="intermediate">Fortgeschritten (1-3 Jahre)</option>
                  <option value="advanced">Erfahren (3+ Jahre)</option>
                  <option value="competitive">Wettkampferfahrung</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goals">Trainingsziele</Label>
                <Textarea
                  id="goals"
                  name="goals"
                  value={formData.goals}
                  onChange={handleChange}
                  placeholder="Was möchtest du durch das Training erreichen?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Weitere Anmerkungen</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Hast du spezielle Wünsche oder Fragen?"
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Wird gesendet...' : 'Anmeldung absenden'}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                Mit der Anmeldung stimmst du unseren{' '}
                <a href="#" className="text-brand-primary hover:underline">
                  Datenschutzbestimmungen
                </a>{' '}
                zu.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* What happens next */}
      <Card>
        <CardHeader>
          <CardTitle>Was passiert nach deiner Anmeldung?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="h-6 w-6 text-brand-primary" />
              </div>
              <h3 className="font-semibold mb-2">Bestätigung</h3>
              <p className="text-sm text-gray-600">
                Du erhältst eine E-Mail mit den Details deines Probetrainings
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-brand-primary" />
              </div>
              <h3 className="font-semibold mb-2">Termin</h3>
              <p className="text-sm text-gray-600">
                Wir bestätigen deinen Wunschtermin oder schlagen Alternativen vor
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-6 w-6 text-brand-primary" />
              </div>
              <h3 className="font-semibold mb-2">Training</h3>
              <p className="text-sm text-gray-600">
                Komm zu deinem Probetraining und erlebe unser Club-Programm
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
