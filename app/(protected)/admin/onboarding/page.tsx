'use client';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Users, Calendar, Trophy, CreditCard, Settings } from 'lucide-react';

export default function OnboardingPage() {
  const steps = [
    {
      title: 'Verein anlegen',
      description:
        'Erstelle deinen Tennisverein unter "Vereine". Trage Name und maximale Mitgliederzahl ein.',
      icon: Trophy,
    },
    {
      title: 'Spielplan (Schedule) erstellen',
      description:
        'Definiere die Saisonzeiten (Saisonbeginn und -ende) für deinen Verein unter "Schedules".',
      icon: Calendar,
    },
    {
      title: 'Courts (Plätze) anlegen',
      description: 'Füge die verfügbaren Tennisplätze hinzu (Name, Belag, Indoor/Ort).',
      icon: Settings,
    },
    {
      title: 'Trainer eintragen',
      description: 'Lege Trainer an und weise sie deinem Verein über "Trainer" zu.',
      icon: Users,
    },
    {
      title: 'Mitglieder einladen',
      description:
        'Lade Mitglieder über die "Members"-Seite ein. Sie erhalten eine Einladung per E-Mail.',
      icon: Users,
    },
    {
      title: 'Buchungen starten',
      description:
        'Nach allem sind Buchungen über die Buchungsseite möglich. Prüfe den Ablauf im Demo-Modus.',
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
        {steps.map((step, index) => (
          <Card key={index} className="border-l-4 border-l-brand-primary">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              <div className="mt-1 rounded-full bg-green-100 p-1.5">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <CardDescription className="mt-1 text-sm">{step.description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
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
