'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Users, Calendar, Trophy, CreditCard, Settings } from 'lucide-react';

export default function OnboardingPage() {
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('onboarding-completed');
    if (stored) {
      try {
        setCompletedSteps(JSON.parse(stored));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const markComplete = (stepId: string) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      newSet.add(stepId);
      localStorage.setItem('onboarding-completed', JSON.stringify([...newSet]));
      return [...newSet];
    });
  };

  const steps = [
    {
      id: 'clubs',
      title: 'Verein anlegen',
      description:
        'Erstelle deinen Tennisverein unter "Vereine". Trage Name und maximale Mitgliederzahl ein.',
      href: '/admin/clubs',
      icon: Trophy,
    },
    {
      id: 'schedules',
      title: 'Spielplan (Schedule) erstellen',
      description:
        'Definiere die Saisonzeiten (Saisonbeginn und -ende) für deinen Verein unter "Schedules".',
      href: '/admin/schedules',
      icon: Calendar,
    },
    {
      id: 'courts',
      title: 'Plätze anlegen',
      description:
        'Füge die verfügbaren Tennisplätze hinzu (Name, Belag, Indoor/Ort) unter "Platzverwaltung".',
      href: '/admin/courts/manage',
      icon: Settings,
    },
    {
      id: 'trainers',
      title: 'Trainer eintragen',
      description: 'Lege Trainer an und weise sie deinem Verein über "Trainer" zu.',
      href: '/admin/trainers',
      icon: Users,
    },
    {
      id: 'members',
      title: 'Mitglieder einladen',
      description:
        'Lade Mitglieder über die "Members"-Seite ein. Sie erhalten eine Einladung per E-Mail.',
      href: '/admin/members',
      icon: Users,
    },
    {
      id: 'bookings',
      title: 'Buchungen starten',
      description:
        'Nach allem sind Buchungen über die Buchungsseite möglich. Prüfe den Ablauf im Demo-Modus.',
      href: '/bookings',
      icon: CreditCard,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-primary">Erste Schritte</h1>
        <p className="text-muted-foreground mt-2">
          Willkommen bei SwingZ! Folge dieser Kurzanleitung, um deinen Verein einzurichten.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step) => {
          const isComplete = completedSteps.includes(step.id);
          return (
            <Card key={step.id} className="border-l-4 border-l-brand-primary">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div className="mt-1">
                  {isComplete ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                  <CardDescription className="mt-1 text-sm">{step.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button asChild onClick={() => markComplete(step.id)}>
                  <a href={step.href}>{isComplete ? 'Abgeschlossen' : 'Jetzt einrichten'}</a>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Hilfe & Support</CardTitle>
          <CardDescription>
            Bei Fragen kontaktiere uns unter <span className="font-medium">support@swingz.app</span>
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
