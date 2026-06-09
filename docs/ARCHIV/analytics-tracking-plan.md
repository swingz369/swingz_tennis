# Analytics Tracking Plan – SwingZ

## Overview

This document defines the analytics events and metrics tracked across the SwingZ application. The goal is to provide actionable insights for product, marketing, and engineering teams.

**Analytics Stack:**

- Primary: Google Analytics 4 (GA4)
- Custom endpoint: `/api/analytics/track` (future, for server-side events)
- Library: `lib/analytics.ts` provides `trackEvent`, `trackPageView`, and convenience wrappers.

**Configuration:**
Set environment variable `NEXT_PUBLIC_GA_ID` to enable GA4 tracking. In development or without GA ID, events are logged to the console.

## Core Events

### Page Views

- **Event:** `page_view`
- **Trigger:** Automatic on route change via `AnalyticsProvider`
- **Parameters:**
  - `page_location` URL
  - `page_path` pathname
  - `page_title` title (from metadata)

### User Authentication

| Event     | When                     | Parameters                                   |
| --------- | ------------------------ | -------------------------------------------- |
| `login`   | After successful login   | `method` ('email', 'demo'), `success` (bool) |
| `sign_up` | On registration (future) | `method` ('email', 'google', etc.)           |
| `logout`  | User logs out            | –                                            |

### Engagement

| Event                      | When                              | Parameters                                                                  |
| -------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `feature_used`             | User clicks a key product feature | `feature` (e.g., 'schedule_optimize', 'booking_calendar', 'member_profile') |
| `schedule_optimized`       | User clicks KI optimieren         | `club_id`                                                                   |
| `schedule_optimize_failed` | Optimization error                | `error`, `club_id`                                                          |
| `booking_created`          | New booking created               | `session_id`, `trainer_id`                                                  |
| `booking_cancelled`        | Booking cancelled                 | `session_id`                                                                |
| `waitlist_joined`          | Joined waitlist for full class    | `session_id`                                                                |

### Conversion Funnel

| Event             | When                       | Parameters                                                |
| ----------------- | -------------------------- | --------------------------------------------------------- |
| `trial_started`   | User begins demo mode      | `source` ('landing_header', 'landing_hero', 'login_page') |
| `upgrade_clicked` | Clicks upgrade/pricing CTA | `plan` ('basic', 'pro', 'enterprise')                     |
| `revenue`         | Payment successful         | `amount`, `currency`                                      |

### Content Interaction

| Event            | When                    | Parameters                                                |
| ---------------- | ----------------------- | --------------------------------------------------------- |
| `cta_clicked`    | Any CTA button click    | `location` (e.g., 'landing_hero', 'header'), `cta_text`   |
| `nav_clicked`    | Sidebar navigation item | `link` (route)                                            |
| `export_clicked` | Data export (CSV/PDF)   | `format` ('csv', 'pdf'), `entity` ('members', 'bookings') |

## User Properties

Set per-user dimensions for segmentation:

- `role`: User role(s) (comma-separated): 'superadmin', 'admin', 'trainer', 'member'
- `club_id`: Primary club ID (if applicable)
- `plan`: Subscription plan (future): 'trial', 'basic', 'pro', 'enterprise'
- `login_method`: Last login method

Set via `setUserProperties()` after login.

## Implementation Guide

### Track a custom event

```ts
import { analytics } from '@/lib/analytics';

// Simple event
analytics.featureUsed('my_feature');

// With parameters
analytics.bookingCreated(sessionId, trainerId);
```

### Track page view

Automatic via `AnalyticsProvider`. For manual page views (e.g., after router.push), call:

```ts
import { trackPageView } from '@/lib/analytics';
trackPageView('/my-path');
```

### Set user properties

```ts
import { setUserProperties } from '@/lib/analytics';
setUserProperties({ role: 'admin', club_id: 'club_123' });
```

## Event Naming Conventions

- Use snake_case for event names.
- Be specific: `feature_used` + feature name parameter, not separate events for each feature.
- Actions are verbs in past tense for completed actions (`booking_created`), present for interactions (`feature_used`).
- Avoid including page context in event name; use parameters instead.

## Privacy & GDPR

- No personal data (PII) is sent to analytics (no email, name, exact address).
- IP anonymization enabled in GA4 by default.
- Users can opt-out via cookie consent banner (to be implemented).
- Analytics disabled in demo mode by default (only logs to console).

## Validation

Verify events are firing:

1. Open browser DevTools → Console to see `[Analytics]` logs in dev mode.
2. In production with GA ID set, use GA Debugger Chrome extension or `gtag('get', ...)`.
3. GA4 real-time reports show incoming events.

## Future Enhancements

- Server-side event tracking for high-value conversions (purchases).
- Custom dashboards with aggregated analytics from database.
- A/B testing integration (see A/B test infra plan).

---

_Last updated: Week 1 implementation (autonomous)_
