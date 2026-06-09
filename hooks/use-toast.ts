/**
 * Toast Hook System
 *
 * Provides consistent toast notifications across the application using Sonner
 */

import { toast as sonnerToast, type ExternalToast } from 'sonner';

/**
 * Toast options for customization
 */
export interface ToastOptions extends ExternalToast {
  duration?: number;
  position?:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'bottom-center';
}

/**
 * Default toast configuration
 */
const defaultOptions: ToastOptions = {
  duration: 4000,
  position: 'top-right',
};

/**
 * Main toast hook
 */
export function useToast() {
  /**
   * Success toast - Green checkmark
   */
  const success = (message: string, options?: ToastOptions) => {
    return sonnerToast.success(message, {
      ...defaultOptions,
      ...options,
    });
  };

  /**
   * Error toast - Red X
   */
  const error = (message: string, options?: ToastOptions) => {
    return sonnerToast.error(message, {
      ...defaultOptions,
      duration: 6000, // Errors stay longer
      ...options,
    });
  };

  /**
   * Warning toast - Yellow exclamation
   */
  const warning = (message: string, options?: ToastOptions) => {
    return sonnerToast.warning(message, {
      ...defaultOptions,
      ...options,
    });
  };

  /**
   * Info toast - Blue info icon
   */
  const info = (message: string, options?: ToastOptions) => {
    return sonnerToast.info(message, {
      ...defaultOptions,
      ...options,
    });
  };

  /**
   * Loading toast - Spinner
   * Returns a toast ID that can be used to dismiss or update the toast
   */
  const loading = (message: string, options?: ToastOptions) => {
    return sonnerToast.loading(message, {
      ...defaultOptions,
      duration: Infinity, // Loading toasts don't auto-dismiss
      ...options,
    });
  };

  /**
   * Promise toast - Automatically shows loading, success, or error based on promise resolution
   */
  const promise = <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    }
  ) => {
    return sonnerToast.promise(promise, messages);
  };

  /**
   * Dismiss a specific toast by ID
   */
  const dismiss = (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  };

  /**
   * Dismiss all toasts
   */
  const dismissAll = () => {
    sonnerToast.dismiss();
  };

  return {
    success,
    error,
    warning,
    info,
    loading,
    promise,
    dismiss,
    dismissAll,
  };
}

/**
 * Convenience hook for success toasts
 */
export function useSuccessToast() {
  const { success } = useToast();
  return success;
}

/**
 * Convenience hook for error toasts
 */
export function useErrorToast() {
  const { error } = useToast();
  return error;
}

/**
 * Common toast messages for consistent UX
 */
export const TOAST_MESSAGES = {
  // Generic
  SUCCESS: 'Erfolgreich gespeichert',
  ERROR: 'Ein Fehler ist aufgetreten',
  LOADING: 'Lädt...',

  // Auth
  LOGIN_SUCCESS: 'Erfolgreich angemeldet',
  LOGIN_ERROR: 'Anmeldung fehlgeschlagen',
  LOGOUT_SUCCESS: 'Erfolgreich abgemeldet',

  // Members
  MEMBER_CREATED: 'Mitglied erfolgreich erstellt',
  MEMBER_UPDATED: 'Mitglied erfolgreich aktualisiert',
  MEMBER_DELETED: 'Mitglied erfolgreich gelöscht',
  MEMBER_INVITED: 'Einladung erfolgreich versendet',

  // Sessions
  SESSION_CREATED: 'Session erfolgreich erstellt',
  SESSION_UPDATED: 'Session erfolgreich aktualisiert',
  SESSION_DELETED: 'Session erfolgreich gelöscht',

  // Bookings
  BOOKING_CREATED: 'Buchung erfolgreich erstellt',
  BOOKING_CANCELLED: 'Buchung erfolgreich storniert',
  BOOKING_FULL: 'Diese Session ist bereits voll',
  BOOKING_DOUBLE: 'Du hast diese Session bereits gebucht',

  // Payments
  PAYMENT_SUCCESS: 'Zahlung erfolgreich',
  PAYMENT_ERROR: 'Zahlung fehlgeschlagen',

  // Invoices
  INVOICE_CREATED: 'Rechnung erfolgreich erstellt',
  INVOICE_SENT: 'Rechnung erfolgreich versendet',
  INVOICE_PAID: 'Rechnung als bezahlt markiert',

  // Settings
  SETTINGS_UPDATED: 'Einstellungen erfolgreich gespeichert',
  PASSWORD_UPDATED: 'Passwort erfolgreich geändert',

  // File Upload
  FILE_UPLOAD_SUCCESS: 'Datei erfolgreich hochgeladen',
  FILE_UPLOAD_ERROR: 'Datei-Upload fehlgeschlagen',
  FILE_TOO_LARGE: 'Datei ist zu groß',

  // Validation
  VALIDATION_ERROR: 'Bitte überprüfe deine Eingaben',
  REQUIRED_FIELDS: 'Bitte fülle alle Pflichtfelder aus',

  // Network
  NETWORK_ERROR: 'Netzwerkfehler. Bitte versuche es erneut.',
  TIMEOUT_ERROR: 'Die Anfrage hat zu lange gedauert',

  // Permissions
  PERMISSION_DENIED: 'Du hast keine Berechtigung für diese Aktion',

  // Copy to clipboard
  COPIED: 'In Zwischenablage kopiert',
} as const;

/**
 * Helper function to extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }

  return TOAST_MESSAGES.ERROR;
}
