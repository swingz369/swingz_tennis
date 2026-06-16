// Google Analytics 4 measurement ID from environment
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;

// DataLayer interface for GA4 events
interface DataLayerEvent {
  event: string;
  [key: string]: unknown;
}

interface UserPropertiesEvent {
  user_properties: Record<string, unknown>;
}

// Extend Window interface to include dataLayer
declare global {
  interface Window {
    dataLayer?: (DataLayerEvent | UserPropertiesEvent)[];
  }
}

/**
 * Push an event to the dataLayer for analytics.
 * If GA ID is configured, events are sent to Google Analytics.
 * In development or without GA, events are logged to console.
 */
export function trackEvent(eventName: string, properties?: Record<string, unknown>): void {
  const event: DataLayerEvent = { event: eventName, ...properties };

  if (GA_MEASUREMENT_ID && typeof window !== 'undefined') {
    // Push to dataLayer – GA4 listener will forward to GA
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);
  } else {
    // Dev mode: silent — analytics events are non-critical in dev
  }
}

/**
 * Track a page view. Called automatically by the AnalyticsProvider.
 */
export function trackPageView(path: string): void {
  trackEvent('page_view', { path });
}

/**
 * Track user properties (e.g., role, clubId). Sets user-level data.
 */
export function setUserProperties(properties: Record<string, unknown>): void {
  if (GA_MEASUREMENT_ID && typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ user_properties: properties });
  }
}

// Convenience wrappers for common events
export const analytics = {
  trackEvent,
  signUp: (method?: string, variant?: string) => trackEvent('sign_up', { method, variant }),
  login: (method?: string, success: boolean = true) => trackEvent('login', { method, success }),
  logout: () => trackEvent('logout'),
  bookingCreated: (sessionId: string, trainerId?: string) =>
    trackEvent('booking_created', { session_id: sessionId, trainer_id: trainerId }),
  bookingCancelled: (sessionId: string) =>
    trackEvent('booking_cancelled', { session_id: sessionId }),
  waitlistJoined: (sessionId: string) => trackEvent('waitlist_joined', { session_id: sessionId }),
  scheduleOptimized: (clubId: string) => trackEvent('schedule_optimized', { club_id: clubId }),
  featureUsed: (feature: string, variant?: string) =>
    trackEvent('feature_used', { feature, variant }),
  upgradeClicked: (plan?: string) => trackEvent('upgrade_clicked', { plan }),
  revenue: (amount: number, currency = 'EUR') => trackEvent('revenue', { amount, currency }),
};
