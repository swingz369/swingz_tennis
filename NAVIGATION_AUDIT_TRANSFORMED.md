# SwingZ – Navigation & Functionality Audit Transformation

## Strategic Roadmap & Actionable Initiatives

**Document Version:** 2.0  
**Original Audit Date:** 2026-05-05  
**Transformation Date:** 2026-05-05  
**Owner:** Product & Engineering Leadership  
**Status:** Strategic Planning Document

---

## EXECUTIVE SUMMARY

This document transforms the comprehensive navigation and functionality audit of the SwingZ platform into a definitive, phased roadmap. The audit identified **25+ critical gaps** across user roles (superadmin, admin, trainer, member), with **5 security vulnerabilities** and **12 missing entity management interfaces**.

**Strategic Objectives:**

- Achieve **100% functional parity** between declared backend capabilities and frontend accessibility
- Implement **role-based navigation clarity** eliminating duplicate and confusing menu items
- Establish **secure, club-scoped data access** across all administrative functions
- Create **intuitive, consistent user experiences** across member, trainer, and admin workflows
- Build **scalable entity management** for courts, trainers, pricing, and scheduling

**Investment Overview:**

- **Minimum Viable Fixes (Prio 1):** 6-8 person-days, addresses security & critical functionality gaps
- **Complete Transformation (Prio 1-3):** 15-20 person-days, full feature parity & UX polish
- **Strategic Initiatives (Prio 2-3):** 9-12 person-days, structural improvements & advanced features

---

## 1. STRATEGIC THEMES & COHESIVE INITIATIVES

### Theme 1: Admin Empowerment & Platform Governance

**Problem Statement:** Administrators cannot effectively manage core entities (courts, trainers, court types) despite having API endpoints; navigation causes confusion with duplicated "Plätze" entries; critical security vulnerability allows cross-club data manipulation.

**User Pain Points:**

- Admin cannot create/edit/delete tennis courts → manual DB operations required
- Trainer profiles exist but are inaccessible → management bottleneck
- Court types dropdown empty → court creation broken
- Duplicate "Plätze" menu items → cognitive load, navigation errors
- Security vulnerability → potential data breach across clubs

**Success Metrics:**

- Court CRUD operations available and used by 100% of admins within 2 weeks of release
- Zero security incidents related to club-scoping violations
- Navigation clarity score (user testing) > 4.5/5.0
- Admin task completion time for court management reduced from >15min to <2min

**Technical Dependencies:**

- Existing court service (`lib/booking/court.service.ts`) requires `updateCourt()` and `deleteCourt()` methods
- Court types table exists but needs API exposure
- Session PATCH endpoint required for scheduler drag & drop
- Auth context (`lib/api-auth.ts`) already supports club-scoping

**Potential Risks:**

- **High:** Incomplete API implementations could block UI development
- **Medium:** Court recalendaring after CRUD operations might break existing bookings
- **Low:** UI complexity with multiple court-related pages

**Cross-functional Impacts:**

- **Product:** Enables self-service club configuration, reduces support tickets
- **Support:** Fewer "how do I add a court?" inquiries
- **Sales:** Multi-club admins can properly onboard new venues
- **Legal:** Security fix prevents compliance violations

---

### Theme 2: Unified Scheduling & Calendar Experience

**Problem Statement:** Three different calendar interfaces exist (`/bookings`, `/courts`, `/scheduler`) with inconsistent views (month vs week) and fragmented functionality; drag & drop visually implemented but non-functional; no clear separation between member booking and admin management views.

**User Pain Points:**

- Members see month view, admins see week view → disorientation when switching roles
- Drag & drop sessions doesn't persist → user frustration, mistrust in system
- Trial training page isolated → poor discovery
- Attendance tracking passive → no engagement

**Success Metrics:**

- Scheduler drag & drop success rate > 95%
- Calendar view consistency audit score: 5/5
- User task success rate (booking session) > 98%
- Session modification via drag & drop adopted by >80% of trainers within 1 month

**Technical Dependencies:**

- Sessions PATCH endpoint implementation
- Court CRUD completion (courts must exist before scheduling)
- Role-based access control validation for session updates

**Potential Risks:**

- **High:** Drag & drop API failure could corrupt session data if not properly validated
- **Medium:** Calendar performance with large datasets (1000+ sessions)
- **Low:** User confusion during transition to new unified interface

**Cross-functional Impacts:**

- **UX:** Reduced training time for new users
- **Operations:** Streamlined session management for staff
- **Data Quality:** More accurate scheduling data

---

### Theme 3: Transparent & Configurable Business Logic

**Problem Statement:** Pricing is hardcoded at €15; onboarding is passive; analytics limited to single club; missing entity management for groups/seasons creates data integrity issues.

**User Pain Points:**

- Clubs cannot set their own pricing → revenue mismatch
- Onboarding provides no guidance → poor activation rates
- Superadmins with multiple clubs see incomplete analytics → poor decision-making
- Groups as free-text arrays → inconsistent reporting

**Success Metrics:**

- 100% of clubs configure pricing within 7 days of onboarding
- Onboarding completion rate increases from estimated 40% to 85%
- Analytics adoption by superadmins increases 3x
- Data consistency score (group names normalized) improves from ~65% to 95%

**Technical Dependencies:**

- Clubs table schema modification (add `default_hourly_rate`)
- Settings page UI updates
- Billing calculation logic refactoring
- Seasons/Group schema design and data migration planning

**Potential Risks:**

- **Medium:** Pricing configuration errors could affect billing accuracy
- **Low:** Data migration for groups/seasons could be complex if data already exists
- **Low:** Backward compatibility for existing clubs without pricing set

**Cross-functional Impacts:**

- **Finance:** Accurate revenue tracking per club
- **Growth:** Better onboarding → faster time-to-value → higher retention
- **Analytics:** Multi-club insights enable portfolio optimization

---

### Theme 4: Role-Based Navigation Optimization

**Problem Statement:** Navigation items missing (profile, notifications), inconsistent labeling, unclear separation between member and admin views of similar functionality.

**User Pain Points:**

- Profile page exists but inaccessible → users cannot update information
- Notifications page exists but not linked → missed communication
- "Plätze" ambiguous (member view vs admin view)
- Trial training routing unclear

**Success Metrics:**

- Profile page visit frequency increases 5x (measured by analytics)
- Notification engagement rate > 70%
- Navigation usability test score > 4.8/5
- "How do I update my profile?" support tickets reduced to zero

**Technical Dependencies:**

- Profile component already exists (`/profile`)
- Notifications infrastructure must be built or integrated
- Sidebar component (`components/layout/sidebar.tsx`) refactoring

**Potential Risks:**

- **Low:** Notification system scope creep (real-time vs polling)
- **Low:** Profile page permissions misconfiguration

**Cross-functional Impacts:**

- **Engagement:** Better profile completion → richer user data
- **Communication:** Notifications → timely updates → reduced missed sessions

---

## 2. DETAILED INITIATIVE BREAKDOWNS

### Initiative 1: Court Management System Completion (Prio 1)

#### Initiative ID: ADM-001

**Title:** Complete Court CRUD Operations & Admin Interface  
**Owner:** Engineering Team (Frontend: 1, Backend: 0.5)  
**Effort:** 2.5 person-days  
**Timeline:** Sprint 1, Days 1-2  
**Priority:** Critical (P0)

**Explicit Context:**  
Courts are fundamental booking units. Current state: API supports GET list and POST create (with security flaw), but no update or delete. Admin interface only shows calendar view; courts cannot be managed. Court Types table exists but UI shows empty dropdown.

**Underlying User Pain Points:**

1. Admin must manually edit database to correct court names or deactivate courts
2. Court creation fails due to missing type selection
3. No way to archive old courts (soft delete)
4. Duplicate courts possible due to no uniqueness validation

**Measurable Success Metrics:**

- Admin can create court in < 30 seconds
- Court list displays all clubs' courts (filtered by role)
- Edit/Delete operations complete with toast confirmation
- Court type dropdown populates with seeded data
- 100% of court CRUD operations logged for audit trail

**Technical Dependencies:**

1. `court.service.ts` must implement `updateCourt(id, updates)` and `deleteCourt(id)` (soft: `is_active = false`)
2. API routes:
   - `GET /api/courts/[id]` – single court fetch with club validation
   - `PATCH /api/courts/[id]` – partial update (name, type, surface, lighting, status)
   - `DELETE /api/courts/[id]` – soft delete
3. Frontend: DataTable component with modal forms (reuse existing patterns from `/admin/members`)
4. Court type dropdown: fetch from `GET /api/court-types` (see Initiative ADM-002)

**Implementation Steps:**

```
Phase 1: Backend (0.5 days)
├─ Extend court.service.ts with update/delete methods
├─ Create route handlers with club-scoping validation
└─ Add database constraints: courts.name unique per club (optional but recommended)

Phase 2: Frontend (1.5 days)
├─ Build /admin/courts/manage/page.tsx
│  ├─ Server component: fetch courts for auth.clubId (or selectedClubId)
│  ├─ Client component: CourtTable with actions column
│  ├─ CreateModal: form with validation (name required, type dropdown)
│  └─ EditModal: pre-filled form, PATCH on submit
├─ Integrate with existing admin layout
└─ Add success/error toast notifications

Phase 3: Security Hardening (0.5 days)
├─ Club-scoping in all court API routes (already partially in place)
└─ Audit logging for create/update/delete operations
```

**Potential Risks & Mitigations:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Existing bookings reference deleted courts | Medium | High | Use soft delete (is_active=false); keep court records for historical integrity |
| Court type data not seeded | Low | Medium | Include seed data in migration or installation script |
| API rate limiting not implemented | Low | Medium | Add rate limiting if traffic high (unlikely for admin) |

**Cross-functional Impacts:**

- **Support:** Court management issues drop by ~80%
- **Sales:** Clubs can fully configure themselves without manual intervention
- **Product:** Enables future features: court-specific pricing, scheduling constraints

**Acceptance Criteria:**

- [ ] GET `/api/courts` returns array with club-scoped courts
- [ ] GET `/api/courts/[id]` validates club membership
- [ ] PATCH `/api/courts/[id]` updates allowed fields only, rejects clubId changes
- [ ] DELETE `/api/courts/[id]` sets `is_active = false` (soft delete)
- [ ] Admin UI at `/admin/courts/manage` displays courts in sortable table
- [ ] Create/Edit modals validate required fields
- [ ] Court type dropdown populated from API
- [ ] All operations trigger toast notifications
- [ ] Sidebar "Plätze" renamed to "Platzverwaltung" and points to new page

---

### Initiative 2: Trainer Management Integration (Prio 1)

#### Initiative ID: ADM-002

**Title:** Expose Trainer Profile Management in Admin Navigation  
**Owner:** Engineering Team (Frontend: 0.5, Backend: 0.5)  
**Effort:** 1 person-day  
**Timeline:** Sprint 1, Day 2  
**Priority:** Critical (P0)

**Explicit Context:**  
Trainer profile management component exists (`components/trainer-profile-management.tsx`) but has no route. Trainers are core to the platform; admins need to view and edit trainer qualifications, availability, and rates. API endpoints exist but may not be club-scoped properly.

**Underlying User Pain Points:**

- Admin cannot onboard trainers (no UI)
- Trainer qualifications/availability hidden → inefficient scheduling
- Potential security issue: API might return all platform trainers instead of club-specific

**Measurable Success Metrics:**

- All trainers visible in admin view within 2 clicks
- Club-scoping enforced: admin sees only own club's trainers
- 100% of trainer profiles complete (qualifications verified) within 30 days of launch
- Trainer profile update latency < 2 seconds

**Technical Dependencies:**

1. API review:
   - `GET /api/trainer-profiles` – must filter by `club_id` (currently might fetch all)
   - `PATCH /api/trainer-profiles/:id` – must enforce club membership
2. Route: `app/(protected)/admin/trainers/page.tsx` – wrapper for existing component
3. Sidebar: insert "Trainer" link after "Mitglieder"
4. Component audit: verify all fields covered by API (qualifications, specializations, availability, etc.)

**Implementation Steps:**

```
Phase 1: Backend Validation (0.25 days)
├─ Review trainer-profiles API implementation
├─ Add club_id filter to GET all trainers endpoint
└─ Ensure PATCH validates trainer belongs to admin's club

Phase 2: Frontend Integration (0.5 days)
├─ Create route page rendering TrainerProfileManagement
├─ Add sidebar navigation item
└─ Test with multi-club admin scenarios

Phase 3: Authorization Review (0.25 days)
├─ Verify trainers can view their own profile (if intended)
└─ Ensure superadmin can manage trainers across all clubs
```

**Potential Risks & Mitigations:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API doesn't support club filtering | Medium | High | Extend API to accept clubId parameter; add join with user_club_memberships |
| Component expects different data shape | Low | Medium | Create adapter layer or adjust component props |
| Trainer sees admin-only fields | Low | Medium | Frontend hide fields based on role; backend already restricts |

**Cross-functional Impacts:**

- **Operations:** Streamlined trainer onboarding and management
- **Quality:** Better trainer data → improved scheduling accuracy
- **Growth:** Trainers can self-serve profile updates (future enhancement)

**Acceptance Criteria:**

- [ ] `/admin/trainers` loads TrainerProfileManagement component
- [ ] Only admins (role >= 3) can access route
- [ ] Trainer list filtered by admin's club(s)
- [ ] Edit form persists changes via API
- [ ] Sidebar navigation updated
- [ ] Superadmin can access all trainers across platform

---

### Initiative 3: Court Types Management (Prio 1/2)

#### Initiative ID: ADM-003

**Title:** Expose Court Types CRUD Interface  
**Owner:** Engineering Team (Backend: 0.5, Frontend: 0.5)  
**Effort:** 1 person-day  
**Timeline:** Sprint 1, Day 3  
**Priority:** High (P1)

**Explicit Context:**  
Court types (surface type: clay, grass, hard, carpet) are seed data but not manageable via UI. Court creation dropdown shows empty because no API endpoint. This blocks Initiative ADM-001 (Court CRUD) from having essential reference data.

**Underlying User Pain Points:**

- Admin cannot add custom court types (e.g., "Indoor synthetic")
- Court creation form broken without type selection
- Platform inflexible for different sports (could be adapted from tennis to badminton, etc.)

**Measurable Success Metrics:**

- Court types API available and used by court management UI
- Admin can create/edit/delete court types in < 20 seconds
- Initial seed data: Clay, Grass, Hard, Carpet, Indoor
- 100% of courts reference valid court_type_id

**Technical Dependencies:**

1. Database: `court_types` table exists (`id, name, surface, is_active`) – verify schema
2. API: Create `/api/court-types` with CRUD operations, admin-only
3. UI: Simple CRUD page or integrate as tab in court management
4. Seed: Initial data migration if table empty

**Implementation Steps:**

```
Phase 1: API (0.5 days)
├─ Create route: GET /api/court-types (admin only)
├─ Create route: POST /api/court-types (create)
├─ Create route: PATCH /api/court-types/:id (update)
├─ Create route: DELETE /api/court-types/:id (soft delete)
└─ Add validation: cannot delete if courts reference type (or cascade)

Phase 2: UI (0.5 days)
├─ Page /admin/court-types: table with create/edit/delete
├─ Form fields: name (text), surface (enum dropdown), is_active (checkbox)
└─ Integrate into court creation form as dropdown

Phase 3: Seed Data (0.25 days)
└─ Ensure at least 5 standard types seeded
```

**Potential Risks & Mitigations:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Courts already reference non-existent types | Medium | Medium | Fix data: map courts to "unknown" type or create missing types |
| Deleting type breaks existing courts | High | High | Prevent delete if referenced; or cascade to "unknown" |

**Cross-functional Impacts:**

- **Product:** Enables multi-sport adaptation
- **Data:** Improves reporting by surface type
- **UX:** Court creation becomes possible

**Acceptance Criteria:**

- [ ] API endpoints fully functional with admin auth
- [ ] UI page displays all court types with actions
- [ ] Court creation form includes populated dropdown
- [ ] Cannot delete court type referenced by active courts
- [ ] Initial seed data present

---

### Initiative 4: Scheduler Drag & Drop Persistence (Prio 1)

#### Initiative ID: SCH-001

**Title:** Implement Session Rescheduling via Drag & Drop  
**Owner:** Engineering Team (Frontend: 0.5, Backend: 0.5)  
**Effort:** 1 person-day  
**Timeline:** Sprint 1, Day 3  
**Priority:** Critical (P0)

**Explicit Context:**  
Scheduler has drag & drop UI but no persistence. Sessions cannot actually be moved. TODO marked in code (`admin-court-calendar.tsx:225`). This breaks user trust – users think they've rescheduled but nothing happens.

**Underlying User Pain Points:**

- Trainers waste time rescheduling sessions manually
- Admins cannot adjust schedules efficiently
- System appears broken or unreliable

**Measurable Success Metrics:**

- Drag & drop completes in < 2 seconds with optimistic UI update
- Session updated in database immediately
- Authorization enforced: trainers only their own sessions
- 0 data loss incidents from drag & drop operations
- Error rate < 1% (network failures)

**Technical Dependencies:**

1. Sessions API: `PATCH /api/sessions/[id]` must exist (verify)
2. Updateable fields: `day_of_week`, `start_time`, `court_id`
3. Authorization layer: trainer-own vs admin-all
4. Frontend: handleDragEnd event handlers in both scheduler (trainer) and admin-court-calendar (admin)

**Implementation Steps:**

```
Phase 1: API Implementation (0.5 days)
├─ Create/verify route: app/api/sessions/[id]/route.ts (PATCH)
├─ Validate inputs: dayOfWeek (0-6), startTime (HH:mm), courtId (optional)
├─ Authorization:
│  ├─Admin: can update any session
│  └─Trainer: can update only if session.trainerId === auth.user.id
└─ Return updated session or 204 No Content

Phase 2: Frontend Integration (0.5 days)
├─ scheduler/page.tsx: complete handleDragEnd
├─ admin-court-calendar.tsx: complete handleDragEnd
├─ Optimistic update: revalidate schedule data after success
└─ Error handling: toast failure message, revert if needed
```

**Potential Risks & Mitigations:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Concurrent modifications cause lost updates | Medium | Medium | Implement optimistic locking with `updated_at` timestamp |
| Trainer moves another trainer's session | Low | High | Frontend filter: only own sessions draggable; backend auth mandatory |
| Timezone confusion in day_of_week | Medium | Medium | Standardize to UTC or club timezone; validate |

**Cross-functional Impacts:**

- **Operations:** Schedules can be adjusted in real-time
- **User Satisfaction:** Immediate feedback on changes
- **Data Integrity:** Single source of truth for schedule

**Acceptance Criteria:**

- [ ] PATCH endpoint accepts dayOfWeek, startTime, courtId
- [ ] Authorization prevents trainer from updating others' sessions
- [ ] Drag & drop updates session in < 2s
- [ ] UI shows loading state during API call
- [ ] Success toast confirms change; failure restores original position
- [ ] Both `/scheduler` and `/admin/courts` support drag & drop

---

### Initiative 5: Security Hardening – Club Scoping (Prio 1)

#### Initiative ID: SEC-001

**Title:** Enforce Club Scoping on Courts POST Endpoint  
**Owner:** Engineering Team (Backend: 0.25)  
**Effort:** 0.25 person-days  
**Timeline:** Sprint 1, Day 1  
**Priority:** Critical (P0)

**Explicit Context:**  
Current `POST /api/courts` accepts `clubId` from request body without validation. A malicious admin can create courts for any club by manipulating the body, violating multi-tenancy isolation.

**Underlying User Pain Points:**

- Platform trust erosion if data leakage occurs
- Potential legal liability for cross-tenant data access
- Violates principle of least privilege

**Measurable Success Metrics:**

- 100% of admin-created courts belong to admin's club (audit verified)
- No superadmin-only paths bypass this check
- Security scan passes (static analysis rule added)
- Penetration test: attempted cross-club creation fails with 403

**Technical Dependencies:**

- Auth context already provides `auth.clubId` and `auth.role`
- Existing pattern: other admin APIs (members, billing) already use club scoping

**Implementation Steps:**

```
├─ File: app/api/courts/route.ts (POST handler)
├─ After parsing body, before creating court:
│  if (auth.role !== 'superadmin') {
│    if (body.clubId !== auth.clubId) {
│      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
│    }
│  }
│  // Optionally: body.clubId = auth.clubId for non-superadmin (ignore body)
└─ Apply same check to PATCH/DELETE when implemented
```

**Potential Risks & Mitigations:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Overly restrictive: superadmin needs to set clubId | Low | Medium | Allow superadmin to specify clubId; others fixed to auth.clubId |
| Existing data created with incorrect clubId | Medium | Medium | Write migration to identify and fix orphaned courts |

**Cross-functional Impacts:**

- **Security:** Eliminates critical vulnerability
- **Compliance:** GDPR/ISO 27001 multi-tenancy requirement satisfied
- **Trust:** Enterprise customers require strict data isolation

**Acceptance Criteria:**

- [ ] POST rejects non-superadmin with mismatched clubId (403)
- [ ] PATCH/DELETE enforce same rule
- [ ] Superadmin retains cross-club management capability
- [ ] Unit tests cover both scenarios

---

### Initiative 6: Pricing Configuration (Prio 2)

#### Initiative ID: BIZ-001

**Title:** Make Hourly Rate Configurable per Club  
**Owner:** Engineering Team (Backend: 0.5, Frontend: 0.5)  
**Effort:** 1 person-day  
**Timeline:** Sprint 2, Day 1  
**Priority:** High (P2)

**Explicit Context:**  
Member billing hardcodes €15 per session (`member-billing.tsx:89`). Clubs cannot adjust pricing for their market, promotions, or court tiers. This is a business model blocker.

**Underlying User Pain Points:**

- Clubs in expensive cities cannot charge higher rates
- Clubs in competitive markets cannot offer discounts
- Revenue tracking inaccurate if actual rates differ
- Admin must manually calculate invoices if they override price

**Measurable Success Metrics:**

- 100% of active clubs configure default_hourly_rate within 14 days
- Billing calculations use configured rate with 0% error rate
- Historical sessions default to club's rate at booking time (backwards compatibility)
- Ability to set rates per court (future extension)

**Technical Dependencies:**

1. Database: `ALTER TABLE clubs ADD COLUMN default_hourly_rate NUMERIC(10,2) DEFAULT 15.00;`
2. API: `PATCH /api/clubs/:id` must accept and store this field (admin/superadmin)
3. Settings page `/admin/settings`: club settings form includes rate input
4. Billing calculation: `member-billing.tsx` fetches club rate instead of hardcoded

**Implementation Steps:**

```
Phase 1: Database Migration (0.25 days)
├─ Create migration: add column with default
├─ Backfill: existing clubs get 15.00
└─ Update clubs API schema to include field

Phase 2: Backend (0.25 days)
├─ Ensure PATCH /api/clubs/:id validates numeric range (0-999.99)
└─ Return updated club object

Phase 3: Frontend (0.5 days)
├─ Settings page: add input field for hourly rate
├─ Validation: positive number, 2 decimal places
├─ Billing component: replace hardcoded *15 with dynamic rate
└─ Display rate in UI for transparency
```

**Potential Risks & Mitigations:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Rate changes affect past invoices | Medium | High | Store rate snapshot in bookings/invoices at time of creation |
| Clubs set unrealistic rates (€0 or €1000) | Low | Medium | Add min/max validation (€5-€200) |
| Reports break with null values | Medium | Medium | Default 15.00; handle null gracefully |

**Cross-functional Impacts:**

- **Finance:** Accurate revenue recognition per club
- **Growth:** Flexible pricing for promotions
- **Customer Success:** Clubs can align with local market rates

**Acceptance Criteria:**

- [ ] Clubs table has `default_hourly_rate` column
- [ ] Admin can edit rate in settings
- [ ] Member billing displays rate used
- [ ] Invoice calculations reflect configured rate
- [ ] Existing bookings retain original rate (if needed for historical accuracy)

---

### Initiative 7: Navigation Consolidation & Clarity (Prio 1/3)

#### Initiative ID: UX-001

**Title:** Eliminate Navigation Ambiguity & Improve Discoverability  
**Owner:** Engineering Team (Frontend: 1), Product Team (0.25)  
**Effort:** 1 person-day  
**Timeline:** Sprint 1 (Prio 1 items) + Sprint 3 polish  
**Priority:** Medium-High (P1 for duplication fix, P3 for additional links)

**Explicit Context:**  
Sidebar contains duplicate "Plätze" entries (member calendar + admin calendar). Essential pages (profile, notifications) exist but are not linked. Onboarding is passive. User confusion high.

**Underlying User Pain Points:**

- Users click wrong "Plätze" link expecting different view
- Profile update requires guessing URL or external assistance
- Notifications missed because no visible indicator
- Onboarding provides no actionable next steps → poor activation

**Measurable Success Metrics:**

- Navigation click testing: 100% correct identification of desired link
- Profile page traffic increases 5x
- Notification open rate > 70%
- Onboarding completion rate increases to >80%

**Technical Dependencies:**

- Sidebar component refactor (`components/layout/sidebar.tsx`)
- Decide on notifications UX (dropdown in header vs menu item)
- Onboarding page conversion to interactive format

**Implementation Steps:**

```
Phase 1: Duplicate Removal (0.25 days – Sprint 1)
├─ Main menu "Plätze" → "Platz-Kalender" (points to /courts)
├─ Admin menu "Plätze" → "Platzverwaltung" (points to /admin/courts/manage)
└─ Verify no duplicate nav items remain

Phase 2: Essential Links (0.25 days – Sprint 3)
├─ Add "Mein Profil" to main menu (bottom or under settings group)
├─ Add notifications badge to header with dropdown (preferred) OR menu item
└─ Link trial training appropriately

Phase 3: Onboarding Activation (0.5 days – Sprint 3)
├─ Convert static cards to buttons linking to respective setup pages
├─ Track progress in localStorage or DB (user_onboarding_progress)
└─ Show checkmarks for completed steps
```

**Potential Risks & Mitigations:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users accustomed to old labels | Low | Low | Show toast notification of changes; keep in place for 2 weeks |
| Notifications dropdown complex to implement | Medium | Medium | Start with simple page link; enhance later |
| Onboarding state persistence lost on device change | Low | Low | Use server-side storage if user authenticated |

**Cross-functional Impacts:**

- **UX:** Reduced confusion, higher engagement
- **Adoption:** Onboarding completion drives feature usage
- **Support:** Fewer "where is...?" tickets

**Acceptance Criteria:**

- [ ] No duplicate menu items
- [ ] Profile link visible in sidebar
- [ ] Notifications accessible (dropdown or menu)
- [ ] Onboarding page has actionable buttons
- [ ] Navigation label clarity validated via user testing

---

### Initiative 8: Scheduler Authorization Refinement (Prio 3)

#### Initiative ID: AUTH-001

**Title:** Restrict Trainer Session Modifications to Own Sessions  
**Owner:** Engineering Team (Backend: 0.25, Frontend: 0.25)  
**Effort:** 0.5 person-days  
**Timeline:** Sprint 3, Day 1  
**Priority:** Medium (P3)

**Explicit Context:**  
Current scheduler allows any trainer to drag any session (in their club). This violates least privilege; trainers should only manage their own sessions. Admins retain full access.

**Underlying User Pain Points:**

- Trainers accidentally move other trainers' sessions → conflicts
- No accountability for session changes
- Potential malicious or accidental disruption

**Measurable Success Metrics:**

- Trainers can drag only their own sessions (UI indicates non-draggable others)
- Backend API enforces authorization regardless of frontend
- 0 incidents of unauthorized session modifications
- Trainer satisfaction with scheduler fairness > 4.5/5

**Technical Dependencies:**

- Sessions PATCH endpoint (Initiative SCH-001) already enforces this
- Frontend filter: sessions list in scheduler should only include trainer's sessions as draggable

**Implementation Steps:**

```
├─ Backend: Already enforced in PATCH endpoint
├─ Frontend: scheduler/page.tsx
│  ├─ When loading schedule, mark sessions as draggable: session.trainerId === user.id
│  ├─ Visual indication: non-draggable sessions appear faded or with lock icon
│  └─ DragEnd handler: guard clause if !session.draggable
└─ Admin view remains unchanged (all sessions draggable)
```

**Potential Risks & Mitigations:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Co-trainer sessions should be editable | Medium | Medium | Introduce "co-trainer" role or permission flag if needed |
| Frontend-only filter bypassed via API | Low | High | Backend authorization is authoritative (already in place) |

**Cross-functional Impacts:**

- **Security:** Principle of least privilege enforced
- **UX:** Clear ownership expectations
- **Training:** Reduced need to correct scheduling errors

**Acceptance Criteria:**

- [ ] Trainer cannot drag session owned by another trainer (frontend prevents)
- [ ] API would reject attempt even if frontend bypassed
- [ ] Admin can still drag all sessions
- [ ] Visual distinction between own and others' sessions

---

## 3. PHASED IMPLEMENTATION ROADMAP

### Phase 1: Critical Fixes & Core Functionality (Sprint 1 – Days 1-3)

**Duration:** 3 working days  
**Team:** 1 Backend, 1 Frontend  
**Budget:** ~3 person-days

| Day     | Initiative                      | Tasks                                     | Deliverable                          |
| ------- | ------------------------------- | ----------------------------------------- | ------------------------------------ |
| Day 1   | SEC-001 (Security)              | Fix court POST club-scoping vulnerability | Secure courts API                    |
| Day 1-2 | ADM-001 (Court CRUD – Backend)  | Court service methods + API routes        | GET/PATCH/DELETE /api/courts/[id]    |
| Day 2   | ADM-002 (Trainer Mgmt)          | Route creation + API validation           | `/admin/trainers` page live          |
| Day 2   | ADM-001 (Court CRUD – Frontend) | Manage page build                         | `/admin/courts/manage` UI            |
| Day 3   | UX-001 (Nav cleanup)            | Sidebar rename duplicate items            | "Platz-Kalender" & "Platzverwaltung" |
| Day 3   | SCH-001 (Scheduler DnD)         | API + frontend integration                | Drag & drop persists                 |

**Phase 1 Success Criteria:**

- All Prio 1 items complete
- No known security vulnerabilities
- Admin can fully manage courts and trainers
- Scheduler functional for trainers and admins

---

### Phase 2: Structural Enhancements (Sprint 2 – Days 4-7)

**Duration:** 4 working days  
**Team:** 1 Backend, 1 Frontend  
**Budget:** ~5 person-days

| Day     | Initiative            | Tasks                               | Deliverable                     |
| ------- | --------------------- | ----------------------------------- | ------------------------------- |
| Day 4   | ADM-003 (Court Types) | CRUD API + UI                       | Court types management          |
| Day 4-5 | BIZ-001 (Pricing)     | DB migration + settings UI          | Configurable hourly rate        |
| Day 5-6 | BIZ-002 (Analytics)   | Multi-club analytics for superadmin | Club selector on analytics page |
| Day 6-7 | BIZ-003 (Onboarding)  | Convert to interactive wizard       | Buttons + progress tracking     |

**Phase 2 Success Criteria:**

- Admin can configure business logic (pricing, court types)
- Superadmin analytics cover all clubs
- Onboarding completion rate measurable improvement

---

### Phase 3: Polish & Optimization (Sprint 3 – Days 8-10)

**Duration:** 3 working days  
**Team:** 1 Frontend, 0.5 Backend (part-time)  
**Budget:** ~2.5 person-days

| Day     | Initiative                    | Tasks                            | Deliverable                 |
| ------- | ----------------------------- | -------------------------------- | --------------------------- |
| Day 8   | UX-001 (Nav additions)        | Profile link + notifications     | Discoverability improved    |
| Day 8-9 | UX-002 (Calendar consistency) | Unified navigation between views | Month/Week toggle           |
| Day 9   | AUTH-001 (Scheduler auth)     | Trainer session restrictions     | Only own sessions draggable |
| Day 10  | TEST-001 (E2E Coverage)       | Tests for all new flows          | Regression suite            |

**Phase 3 Success Criteria:**

- Navigation fully navigable without assistance
- All views accessible with consistent UX
- Role-based permissions enforced in UI and API

---

### Strategic Buffer & Risk Contingency

**Buffer:** 2 additional days allocated across sprints for:

- API integration issues
- Schema migration complications
- UX refinement based on internal testing

---

## 4. SUCCESS METRICS & KPIs

### Quantitative Metrics

| Metric                                 | Baseline    | Target         | Measurement                    | Owner       |
| -------------------------------------- | ----------- | -------------- | ------------------------------ | ----------- |
| Security incidents (cross-club access) | 1 critical  | 0              | Security audit logs            | Engineering |
| Court CRUD task completion time        | >15 min     | <2 min         | User testing                   | Product     |
| Scheduler drag & drop success rate     | 0%          | >95%           | Error tracking (Sentry)        | Engineering |
| Admin navigation clarity score         | ~3/5        | >4.5/5         | Usability testing (5 users)    | UX          |
| Onboarding completion rate             | ~40% (est.) | >85%           | Analytics (Mixpanel)           | Growth      |
| Pricing configuration adoption         | 0%          | >90% (30 days) | DB query % clubs with rate set | Product     |
| Profile page traffic (sessions/month)  | ~50         | >250           | Google Analytics               | Product     |
| Trainer session modification errors    | N/A         | <1%            | Error tracking                 | Engineering |

### Qualitative Metrics

- **User Feedback Scores:** Admin satisfaction survey >4/5 on management tools
- **Support Ticket Volume:** Court management tickets reduced by 80%
- **Feature Adoption:** >80% of trainers using drag & drop within 1 month
- **System Trust:** Reduced "is my change saved?" support inquiries

### Leading Indicators

- Sprint velocity (story points completed)
- Bug report rate for new features
- API error rate for new endpoints
- User engagement with new navigation items (clicks/week)

---

## 5. RISK REGISTER & MITIGATION STRATEGY

### High-Risk Items

| Risk ID  | Risk Description                                                   | Probability | Impact    | Mitigation Strategy                                                   | Owner       |
| -------- | ------------------------------------------------------------------ | ----------- | --------- | --------------------------------------------------------------------- | ----------- |
| RISK-001 | Incomplete API implementations block UI work                       | Medium      | High      | Backend-first development; mock APIs for frontend prototyping         | Tech Lead   |
| RISK-002 | Court deletion breaks historical bookings                          | High        | High      | Soft delete only; maintain referential integrity; preserve in reports | Engineering |
| RISK-003 | Drag & drop introduces scheduling conflicts (double-booked courts) | Medium      | High      | Backend conflict detection in PATCH; optimistic locking; UI warnings  | Engineering |
| RISK-004 | Multi-club admin club-scoping bugs (data leakage)                  | Low         | Very High | Comprehensive integration tests; security code review; audit logging  | Security    |

### Medium-Risk Items

| Risk ID  | Risk Description                                 | Probability | Impact | Mitigation                                                 | Owner       |
| -------- | ------------------------------------------------ | ----------- | ------ | ---------------------------------------------------------- | ----------- |
| RISK-005 | Court Types not seeded → dropdown empty          | Low         | Medium | Ensure seed data in migration; test on staging             | DevOps      |
| RISK-006 | Pricing migration errors for existing bookings   | Medium      | Medium | Run calculation validation script on production preview    | Finance     |
| RISK-007 | Calendar performance degrades with many courts   | Low         | Medium | Implement pagination/virtualization; load courts on demand | Engineering |
| RISK-008 | Onboarding progress not persisted across devices | Low         | Low    | Use server-side storage if authenticated                   | Engineering |

### Low-Risk Items

| Risk ID  | Risk Description                             | Probability | Impact | Mitigation                                         | Owner   |
| -------- | -------------------------------------------- | ----------- | ------ | -------------------------------------------------- | ------- |
| RISK-009 | User confusion from navigation label changes | Low         | Low    | In-app announcement for 2 weeks; tooltips          | Product |
| RISK-010 | Notifications implementation scope creep     | Medium      | Low    | Phase 1: simple page link; Phase 2: dropdown badge | Product |
| RISK-011 | Accessibility issues in new modals           | Medium      | Low    | Follow WCAG 2.1 AA; screen reader testing          | UX      |

---

## 6. ACCESSIBILITY REQUIREMENTS

All new UI components must comply with **WCAG 2.1 AA** standards:

- **Keyboard Navigation:** All modals, tables, and forms must be fully keyboard-operable
- **Screen Reader Support:** Proper ARIA labels on icons and buttons; table headers marked
- **Color Contrast:** Minimum 4.5:1 for text, 3:1 for UI components
- **Focus Management:** Modal focus trap; logical tab order
- **Error Identification:** Form validation errors announced, suggestions provided
- **Language:** Page language declared (`lang="de"`); consider internationalization readiness

**Accessibility Testing Checklist per Initiative:**

- [ ] Color contrast validated withaxe DevTools
- [ ] Keyboard-only navigation tested end-to-end
- [ ] Screen reader (NVDA/VoiceOver) tested for critical flows
- [ ] Focus not trapped in modals without escape path
- [ ] Form labels properly associated with inputs

---

## 7. INTERNATIONALIZATION (I18N) READINESS

Current content appears German (`Datum`, `Autor`, etc.). While full i18n may be out of scope, design with i18n in mind:

- **Text Extraction:** All UI strings should be in translation files even if single-language initially
- **Date/Time Formatting:** Use locale-aware formatting (e.g., `date-fns` with `de` locale)
- **Number Formatting:** Currency (€) must support locale variants
- **RTL Support:** Not required (German LTR), but layout flexible if future expansion

**I18n Debt:** Plan to externalize strings in Phase 3 or separate sprint.

---

## 8. PERFORMANCE BENCHMARKS

### Target Performance Metrics

| Page/Endpoint          | Target Load Time   | Target API Latency     | Monitoring      |
| ---------------------- | ------------------ | ---------------------- | --------------- |
| `/admin/courts/manage` | < 1.5s (LCP)       | Courts API < 200ms     | Lighthouse, RUM |
| Court CRUD operations  | < 1s (perceived)   | PATCH < 300ms          | Custom metrics  |
| Scheduler drag & drop  | Optimistic < 100ms | Session update < 500ms | User timing API |
| Court types API        | < 100ms            | GET all < 100ms        | API monitoring  |

### Performance Optimization Checklist

- **Code Splitting:** Lazy load modals and heavy components
- **Data Fetching:** Server-side rendering where possible; parallel fetches
- **Caching:** Court types infrequently changing → SWR cache or React Query
- **Bundle Size:** Audit new dependencies; tree-shaking enabled
- **Database:** Indexes on `courts.club_id`, `court_types.id`

---

## 9. OWNERSHIP & RACI MATRIX

| Role                  | Responsible   | Accountable        | Consulted    | Informed     |
| --------------------- | ------------- | ------------------ | ------------ | ------------ |
| **Product Manager**   | ✓ (scope)     | ✓ (prioritization) | –            | Stakeholders |
| **Engineering Lead**  | ✓ (execution) | –                  | PM, UX       | Team         |
| **Backend Engineer**  | ✓ (API, DB)   | –                  | Frontend, PM | –            |
| **Frontend Engineer** | ✓ (UI, Nav)   | –                  | Backend, UX  | –            |
| **UX Designer**       | –             | –                  | ✓ (reviews)  | Team         |
| **QA Engineer**       | ✓ (testing)   | –                  | –            | Team         |
| **Security Officer**  | –             | –                  | ✓ (review)   | Leadership   |

---

## 10. ALIGNMENT WITH PRODUCT STRATEGY

This roadmap directly supports SwingZ's strategic pillars:

1. **Self-Serve Club Management:** Courts, trainers, pricing – all configurable without support
2. **Scalable Multi-Tenancy:** Robust club-scoping enables growth to 1000+ clubs
3. **Operational Efficiency:** Intuitive admin tools reduce manual work
4. **User Engagement:** Clear navigation + working features → higher retention

**Product Principles Reinforced:**

- Simplicity: Remove duplicate navigation; consolidate where possible
- Ownership: Clubs control their configuration
- Reliability: Security fixes + working drag & drop build trust
- Scalability: Entity management supports growth

---

## 11. DEFINITION OF DONE (DoD)

Each initiative must meet:

**Functional:**

- [ ] All acceptance criteria met (see per-initiative sections)
- [ ] Manual QA passed on staging environment
- [ ] E2E tests written and passing (critical paths)
- [ ] No console errors in production build
- [ ] Cross-browser tested (Chrome, Firefox, Safari)

**Non-Functional:**

- [ ] Performance budgets met (see Section 8)
- [ ] Accessibility audit passed (axe-core, manual screen reader test)
- [ ] Security review: no new vulnerabilities, club-scoping validated
- [ ] Documentation updated (API docs, user guides if needed)
- [ ] Monitoring: relevant metrics/errors instrumented

**Process:**

- [ ] Code reviewed by at least 1 peer
- [ ] Merge to main after successful CI/CD pipeline
- [ ] Deployed to production with feature flag (if applicable)
- [ ] rollout monitored for 48 hours; rollback plan ready

---

## 12. MONITORING & OBSERVABILITY

Add instrumentation to track:

1. **Usage Metrics (via analytics service):**
   - Page views: `/admin/courts/manage`, `/admin/trainers`, `/admin/court-types`
   - Feature usage: courts created/edited/deleted per week
   - Scheduler drag & drop events (count, success/failure rate)
   - Pricing configuration changes

2. **Error Tracking (Sentry/LogRocket):**
   - API errors: courts, sessions PATCH, court types
   - Frontend errors in new modals and pages
   - Authorization failures (track potential attack patterns)

3. **Business Metrics:**
   - % clubs with configured pricing
   - Avg courts per club
   - Trainer profile completeness

**Alerting:**

- Spike in 403 errors on court APIs → potential security issue
- Drag & drop failure rate > 5% → API or conflict issue
- Court creation errors > 10% → court types missing

---

## 13. DOCUMENTATION & KNOWLEDGE TRANSFER

**Artifacts to Update:**

1. `README.md` – architecture overview with new admin sections
2. `docs/API.md` – document new/updated endpoints (courts/[id], court-types, sessions PATCH)
3. `docs/ADMIN_GUIDE.md` – how to manage courts, trainers, court types, pricing
4. `CHANGELOG.md` – entry for each phase release
5. `SECURITY.md` – document club-scoping enforcement rules

**Team Enablement:**

- Walkthrough session for support team on new admin features
- Screenshot guide for end-users (admins) on court/trainer management
- Training materials for onboarding flow

---

## 14. SUPPORT & INCIDENT RESPONSE

**Known Issues Prior to Launch:**

- None identified as blockers

**Post-Launch Monitoring Period:**

- **Week 1:** Daily health checks on new endpoints; 15min response SLA for critical issues
- **Week 2-3:** Daily monitoring; 1h response SLA
- **Week 4+:** Standard monitoring; weekly review

**Rollback Procedures:**

- Court CRUD UI: feature flag; disable flag to revert to old navigation (but functionality still needed)
- Scheduler DnD: can be disabled via frontend flag; legacy edit form remains available
- Court Types: simple CRUD; rollback via DB migration reversal
- Security fix: critical; no rollback (must stay in place)

---

## 15. ROADMAP VISUALIZATION (GANTT- style)

```
Week 1: [SEC-001][ADM-001-B][ADM-002][ADM-001-F][SCH-001][UX-001]
Week 2: [ADM-003][BIZ-001-DB][BIZ-001-UI][BIZ-002][BIZ-003]
Week 3: [UX-001-add][UX-002][AUTH-001][TEST-001]
Week 4: Buffer & Polish
```

Legend:

- [SEC-001] Security fix
- [ADM-001-B] Court CRUD Backend
- [ADM-001-F] Court CRUD Frontend
- [SCH-001] Scheduler DnD
- [UX-001] Nav cleanup
- [ADM-003] Court Types
- [BIZ-001] Pricing
- [BIZ-002] Analytics multi-club
- [BIZ-003] Onboarding wizard
- [UX-002] Calendar consistency
- [AUTH-001] Trainer auth
- [TEST-001] E2E tests

---

## 16. APPENDIX: OPEN DECISIONS (RESOLVED)

**Decision Log:**

| Decision                            | Options Considered                   | Decision                        | Rationale                                          |
| ----------------------------------- | ------------------------------------ | ------------------------------- | -------------------------------------------------- |
| Court CRUD location                 | Separate page vs modal over calendar | Separate `/admin/courts/manage` | Better for bulk operations; clearer UX             |
| Trainer management route            | `/admin/trainers` vs `/admin/staff`  | `/admin/trainers`               | Consistent with existing naming (`/admin/members`) |
| Court types as separate page or tab | Standalone vs integrated             | Tab in court management (later) | Initially separate for speed; later consolidate    |
| Scheduler trainer restriction       | Can move all vs only own             | Only own sessions               | Security + accountability                          |
| Pricing per club vs per court       | Per club vs per court                | Per club (v1)                   | Simpler; 95% of clubs uniform pricing              |
| Onboarding persistence              | localStorage vs DB                   | localStorage → future DB        | Fast implementation; upgrade path clear            |
| Notifications UI                    | Menu item vs header badge            | Header badge (Phase 2)          | Better discoverability; standard pattern           |

---

## 17. REFERENCES (ENHANCED)

**Codebase Map (Critical Files):**

```
app/
├── api/
│   ├── courts/
│   │   ├── route.ts (GET list, POST create) → needs PATCH/DELETE routes
│   │   └── [id]/
│   │       └── route.ts (NEW: GET single, PATCH, DELETE)
│   ├── court-types/ (NEW)
│   │   └── route.ts (CRUD)
│   ├── sessions/
│   │   └── [id]/
│   │       └── route.ts (NEW/VERIFY: PATCH for reschedule)
│   └── trainer-profiles/ (exists, verify club-scoping)
├── (protected)/admin/
│   ├── courts/
│   │   └── manage/
│   │       └── page.tsx (NEW)
│   ├── trainers/
│   │   └── page.tsx (NEW)
│   ├── court-types/
│   │   └── page.tsx (NEW)
│   ├── settings/
│   │   └── page.tsx (MODIFY: add pricing field)
│   └── analytics/
│       └── page.tsx (MODIFY: multi-club)
components/
├── layout/
│   └── sidebar.tsx (MODIFY: labels, links)
├── admin-court-calendar.tsx (MODIFY: DnD handler)
├── scheduler/
│   └── page.tsx (MODIFY: DnD handler + auth filter)
└── trainer-profile-management.tsx (EXISTING)
lib/
├── booking/
│   └── court.service.ts (EXTEND: update, delete)
└── api-auth.ts (EXISTING – robust)
```

**Database Schema (Relevant Tables):**

```sql
-- Verified existing
clubs (id, name, ...)
courts (id, club_id, name, court_type_id, surface, ...)
court_types (id, name, surface, is_active)
sessions (id, court_id, trainer_id, day_of_week, start_time, ...)
trainer_profiles (id, trainer_id, qualifications, availability, ...)
user_club_memberships (user_id, club_id, role)

-- To extend
clubs: ADD COLUMN default_hourly_rate NUMERIC(10,2)
-- Optional: seasons, groups (future)
```

**API Contract Examples:**

_Court Types GET:_

```json
GET /api/court-types
Response: [
  { "id": "1", "name": "Sand", "surface": "clay", "is_active": true },
  { "id": "2", "name": "Hartplatz", "surface": "hard", "is_active": true }
]
```

_Session PATCH (DnD):_

```json
PATCH /api/sessions/abc123
Body: {
  "dayOfWeek": 3,
  "startTime": "10:00",
  "courtId": "court-uuid"
}
Response: 204 No Content or updated session object
```

---

## 18. CONCLUSION & NEXT STEPS

This transformation plan converts the original audit's scattered observations into a **cohesive, prioritized, and executable roadmap**. The phased approach balances **urgency** (security, core functionality) with **quality** (accessibility, performance, UX polish).

**Immediate Actions (Next 24 Hours):**

1. [ ] Review and approve this roadmap with stakeholders
2. [ ] Assign initiative owners (engineering tickets)
3. [ ] Create sprint backlog for Phase 1
4. [ ] Set up monitoring dashboards (error rates, performance)
5. [ ] Schedule kickoff meeting

**Review Gates:**

- **After Phase 1:** Security & core functionality validated → proceed or adjust
- **After Phase 2:** Structural enhancements complete → assess Phase 3 scope
- **After Phase 3:** Full transformation delivered → retrospective & lessons learned

**Long-term Vision (Post-Roadmap):**

- Groups & Seasons entity management (if needed)
- Real-time notifications
- Advanced analytics dashboard
- Mobile app synchronization
- Internationalization rollout

---

**Document Control:**

- Version: 2.0
- Approved by: ******\_\_\_\_******
- Next Review: After Sprint 1 completion
