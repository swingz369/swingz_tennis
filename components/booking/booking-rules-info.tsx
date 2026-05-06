/**
 * Booking Rules Info Component
 * Displays booking rules and limits to users
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useBookingValidation, getBookingRulesSummary } from '@/hooks/use-booking-validation';
import type { BookingRule } from '@/lib/types/booking-rules';

interface BookingRulesInfoProps {
  clubId: string;
  userRole: string;
  className?: string;
}

/**
 * Shows the user their booking rules and current limits
 */
export function BookingRulesInfo({ clubId, userRole, className }: BookingRulesInfoProps) {
  const { getBookingRules } = useBookingValidation();
  const [rules, setRules] = useState<BookingRule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRules() {
      setLoading(true);
      const rulesData = await getBookingRules(clubId, userRole);
      setRules(rulesData);
      setLoading(false);
    }

    loadRules();
  }, [clubId, userRole, getBookingRules]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Buchungsregeln
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Lädt...</p>
        </CardContent>
      </Card>
    );
  }

  if (!rules) {
    return (
      <Alert className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Keine Buchungsregeln gefunden. Bitte kontaktieren Sie den Administrator.
        </AlertDescription>
      </Alert>
    );
  }

  const summary = getBookingRulesSummary(rules);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Buchungsregeln
        </CardTitle>
        <CardDescription>
          Ihre Buchungsbedingungen als {getRoleDisplayName(userRole)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {summary.map((item, index) => (
            <div key={index} className="flex items-start gap-2 text-sm">
              <CheckCircle className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Booking Validation Feedback Component
 * Shows real-time validation feedback as user selects time slots
 */
interface BookingValidationFeedbackProps {
  validation: {
    is_valid: boolean;
    error_code?: string;
    error_message?: string;
  } | null;
  isValidating: boolean;
}

export function BookingValidationFeedback({
  validation,
  isValidating,
}: BookingValidationFeedbackProps) {
  if (isValidating) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>Prüfe Verfügbarkeit...</AlertDescription>
      </Alert>
    );
  }

  if (!validation) {
    return null;
  }

  if (validation.is_valid) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          ✓ Dieser Zeitslot ist verfügbar und kann gebucht werden.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <XCircle className="h-4 w-4" />
      <AlertDescription>
        {validation.error_message || 'Diese Buchung ist nicht möglich.'}
      </AlertDescription>
    </Alert>
  );
}

function getRoleDisplayName(role: string): string {
  const roleNames: Record<string, string> = {
    member: 'Mitglied',
    trainer: 'Trainer',
    admin: 'Administrator',
    superadmin: 'Super-Administrator',
    guest: 'Gast',
  };

  return roleNames[role] || role;
}
