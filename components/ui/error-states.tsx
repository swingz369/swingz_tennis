import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';

interface QueryErrorProps {
  error: Error;
  onRetry?: () => void;
  onBack?: () => void;
  title?: string;
  message?: string;
}

export function QueryError({
  error,
  onRetry,
  onBack,
  title = 'Fehler beim Laden',
  message = 'Die Daten konnten nicht geladen werden. Bitte versuche es erneut.',
}: QueryErrorProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          {onRetry && (
            <Button onClick={onRetry} variant="default" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Erneut versuchen
            </Button>
          )}
          {onBack && (
            <Button onClick={onBack} variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
          )}
          <Button
            onClick={() => (window.location.href = '/dashboard')}
            variant="outline"
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Fehlerdetails (Dev)
            </summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
              {error.toString()}
            </pre>
          </details>
        )}
      </Card>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="w-full max-w-md p-6 text-center">
        {icon && (
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-gray-100">{icon}</div>
          </div>
        )}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{description}</p>
        {action && (
          <Button onClick={action.onClick} variant="default">
            {action.label}
          </Button>
        )}
      </Card>
    </div>
  );
}

interface NotFoundProps {
  title?: string;
  description?: string;
  onBack?: () => void;
}

export function NotFound({
  title = 'Nicht gefunden',
  description = 'Die angeforderte Seite konnte nicht gefunden werden.',
  onBack,
}: NotFoundProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="text-6xl font-bold text-gray-300">404</div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{description}</p>
        <div className="flex gap-3 justify-center">
          {onBack && (
            <Button onClick={onBack} variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
          )}
          <Button
            onClick={() => (window.location.href = '/dashboard')}
            variant="default"
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface AccessDeniedProps {
  title?: string;
  description?: string;
}

export function AccessDenied({
  title = 'Zugriff verweigert',
  description = 'Du hast keine Berechtigung, auf diese Seite zuzugreifen.',
}: AccessDeniedProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-yellow-100">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{description}</p>
        <Button
          onClick={() => (window.location.href = '/dashboard')}
          variant="default"
          className="gap-2"
        >
          <Home className="h-4 w-4" />
          Zurück zum Dashboard
        </Button>
      </Card>
    </div>
  );
}
