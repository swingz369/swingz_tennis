'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { toast } from 'sonner';

interface PushNotificationToggleProps {
  variant?: 'button' | 'switch';
  className?: string;
}

/**
 * Toggle component for push notification subscription.
 * Shows current state and allows subscribe/unsubscribe.
 */
export function PushNotificationToggle({
  variant = 'button',
  className,
}: PushNotificationToggleProps) {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isLoading) return;

    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success('Push-Benachrichtigungen deaktiviert');
      } else {
        toast.error('Deaktivierung fehlgeschlagen');
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast.success('Push-Benachrichtigungen aktiviert!');
      } else {
        toast.error('Aktivierung fehlgeschlagen — prüfe deine Browser-Einstellungen');
      }
    }
  };

  if (variant === 'switch') {
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`group flex items-center justify-between rounded-xl border border-border p-4 transition-all hover:border-brand-primary/30 hover:shadow-sm ${className ?? ''}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2 ${isSubscribed ? 'bg-brand-primary/10 text-brand-primary' : 'bg-muted text-muted-foreground'}`}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isSubscribed ? (
              <Bell className="h-5 w-5" />
            ) : (
              <BellOff className="h-5 w-5" />
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Push-Benachrichtigungen</p>
            <p className="text-xs text-muted-foreground">
              {isSubscribed
                ? 'Aktiviert — du wirst benachrichtigt'
                : 'Deaktiviert — keine Push-Nachrichten'}
            </p>
          </div>
        </div>
        <div
          role="switch"
          aria-checked={isSubscribed}
          aria-label="Push-Benachrichtigungen"
          className={`relative h-6 w-11 rounded-full transition-colors ${
            isSubscribed ? 'bg-brand-primary' : 'bg-muted'
          }`}
        >
          <div
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              isSubscribed ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </div>
      </button>
    );
  }

  return (
    <Button
      variant={isSubscribed ? 'outline' : 'default'}
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
      className={`gap-1.5 ${className ?? ''}`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {isLoading ? 'Wird gespeichert…' : isSubscribed ? 'Push deaktivieren' : 'Push aktivieren'}
    </Button>
  );
}
