# SwingZ User Flow Diagrams (Week 1 Design Finalization)

## Persona 1: Johannes (Superadmin)

**Goal:** Platform oversight, studio management, billing administration

```
Landing Page
    ↓ (CTA "Start Free Trial")
Signup → Select "Studio Owner" role
    ↓
Email Verification
    ↓
Onboarding Wizard
├─ Studio Profile Setup
├─ Branding Configuration
├─ Payment Method Entry
└─ Initial Trainer Invite
    ↓
Dashboard (Superadmin View)
├─ Quick Stats: Revenue, Members, Retention
├─ Recent Activity Feed
├─ Quick Actions: "Add Trainer", "View Billing"
└─ Alerts: "Payment Failed", "Trial Expiring"
    ↓
Navigation Pathways:
├─ Dashboard → Overview
├─ Members → Full member list (all clubs)
│   └─ Member Detail → Edit Profile, Assign Trainer, View Payments
├─ Clubs → Manage all studio locations
│   └─ Club Detail → Settings, Staff, Schedule
├─ Billing → Invoices, Revenue, Payouts
├─ Analytics → Platform-wide metrics
└─ Settings → White-label, API keys, Team access
```

**Key Flows:**

- Add new studio location: `Dashboard → Clubs → New Club` (3-step modal)
- Invite admin: `Settings → Team → Invite User → Role: Admin`
- Export revenue report: `Billing → Export CSV (last 30 days)`
- View churn risk: `Analytics → Retention → At-risk members`

---

## Persona 2: Sophia (Admin)

**Goal:** Day-to-day studio operations, member management, trainer oversight

```
Login (Studio Owner credentials)
    ↓
Dashboard (Admin View)
├─ Today's Classes (up to 3)
├─ Waitlist Count
├─ Revenue Today/Week/Month
├─ New Member Signups (last 7 days)
└─ Alert: "3 trainers unscheduled this week"
    ↓
Primary Workflows:
├─ Member Management:
│   ├─ New Member Signup (check-in flow)
│   ├─ Membership tier assignment
│   ├─ Check-in history & attendance tracking
│   └─ Billing & payment issues
├─ Trainer Management:
│   ├─ Schedule assignments
│   ├─ Performance metrics
│   ├─ Time-off requests
│   └─ Class coverage planning
├─ Class Scheduling:
│   ├─ Weekly schedule builder
│   ├─ Waitlist management
│   ├─ Cancellations & make-ups
│   └─ Capacity planning
└─ Financial:
    ├─ Daily revenue reconciliation
    ├─ Invoice disputes
    └─ Payout tracking
```

**Access Rights (Admin):**

- All member data (view/edit)
- All trainer data (view/edit schedules)
- Club settings (branding, hours, policies)
- Billing & revenue reports
- **Cannot:** Access other studios' data, platform settings, delete studio

---

## Persona 3: Mike (Trainer)

**Goal:** Client management, personal schedule, progress tracking

```
Login (Trainer credentials)
    ↓
Dashboard (Trainer View)
├─ Today's Schedule (6:00 AM - 9:00 AM)
│   ├─ 3 clients booked
│   └─ 1 waitlisted
├─ Weekly Overview (Mon-Fri)
├─ Monthly Revenue (earnings to date)
└─ Quick Links: "Client History", "My Schedule", "Progress Notes"
    ↓
Daily Workflow:
1. Clock in (optional location check-in)
2. View client list for the day
3. Check client profiles (goals, injuries, progress)
4. Conduct sessions (mobile check-in for clients)
5. Log session notes (post-workout)
6. View next day's schedule
```

**Trainer Visibility:**

- Assigned members only (not full member list)
- Personal schedule only (not full studio schedule)
- Personal earnings/revenue (not overall studio)
- Client progress metrics (not other trainers' clients)

**Mobile-First Interactions:**

- Quick client lookup during session
- One-tap check-in
- Post-session notes (voice-to-text optional)
- Schedule swap requests with other trainers

---

## Persona 4: Sarah (Member - Regular Attendee)

**Goal:** Book classes, track progress, manage membership

```
Landing Page
    ↓ (Sign up → Select "Member" role)
Signup → Basic info (email, password, name)
    ↓
Email Verification
    ↓
Onboarding (Step 1 of 3)
├─ Step 1: Fitness Goals (slider: Lose weight, Build muscle, Improve endurance)
├─ Step 2: Experience Level (beginner/intermediate/advanced)
└─ Step 3: Preferred class times (morning/afternoon/evening)
    ↓
Dashboard (Member View)
├─ My Schedule (next 7 days)
│   └─ 3 booked classes, 1 waitlist
├─ Progress Tracker
│   ├─ Attendance streak: 12 days
│   └─ Recent PRs
├─ Membership Status (Active, 8 classes left)
└─ Quick Actions: "Book Class", "Buy More", "Refer Friend"
```

**Member Core Flows:**

- **Book a class:** `Dashboard → Bookings → Calendar → Select class → Confirm`
- **Cancel booking:** `My Schedule → Cancel → Confirm` (if >24h before)
- **Join waitlist:** Auto-enabled when class is full
- **Track progress:** `Dashboard → Progress` (weight, PRs, attendance)
- **Manage membership:** `Profile → Membership → Upgrade/Cancel`
- **Refer a friend:** `Profile → Refer → Share link → Friend signs up → Both get 1 free class`

**Mobile Experience:**

- Check-in via QR code at studio
- Real-time class capacity display
- Push notifications for class reminders, waitlist openings
- In-app messaging from trainer

---

## Persona 5: Lisa (Prospective Member - Browsing)

**Goal:** Learn about studio, pricing, classes before signing up

```
Landing Page (Public)
├─ Hero: "Transform Your Fitness" + CTA "Start Free Trial"
├─ Social Proof: "500+ members", "4.9★ rating"
├─ Class Showcase (3-4 featured classes with images)
├─ Trainer Spotlights (photos + bios + specialties)
├── Pricing Tiers (Basic, Pro, Unlimited) → "Most Popular" badge on Pro
├─ Testimonials (carousel)
├─ FAQ accordion
└─ Footer: Contact, Location, Hours
```

**Conversion Path:**

1. Landing → Browse classes/pricing
2. "Start Free Trial" → Email capture → Preview account creation
3. Trial account created (7-day trial)
4. Trial dashboard shows: "3 free classes" countdown timer
5. Uses trial → books first class
6. Post-class: "Upgrade to keep training" prompt (with 20% discount)
7. Upgrade → paid member

**Trial Experience:**

- Limited class bookings (3 total)
- Access to beginner classes only
- No waitlist priority
- Prominent upgrade nudges after 2nd class

---

## Cross-Persona Navigation Matrix

| Navigation Item | Superadmin                   | Admin                  | Trainer                | Member                  | Prospect                   |
| --------------- | ---------------------------- | ---------------------- | ---------------------- | ----------------------- | -------------------------- |
| **Dashboard**   | Platform overview            | Studio overview        | Personal schedule      | My schedule             | Landing only               |
| **Bookings**    | All bookings (all clubs)     | All bookings (studio)  | Assigned clients only  | Own bookings            | Hidden                     |
| **Scheduler**   | Full schedule (all)          | Full schedule (studio) | Personal schedule only | View-only (my bookings) | View-only (public classes) |
| **Analytics**   | Platform-wide                | Studio-level           | Personal metrics       | Personal progress       | None                       |
| **Members**     | Full member DB (all studios) | Studio members         | Assigned members only  | Own profile only        | Signup flow                |
| **Clubs**       | All studios                  | Own studio only        | Own studio only        | N/A                     | N/A                        |
| **Schedules**   | All trainer schedules        | Full staff schedule    | Personal schedule      | My classes              | Public class list          |
| **Settings**    | Platform config              | Studio config          | Personal profile       | Personal profile        | Signup/trial               |
| **Billing**     | Revenue, payouts, invoices   | Invoices, payouts      | Earnings summary       | Billing history         | Pricing page               |

---

## Mobile vs Desktop Navigation

### Desktop (≥1024px)

- Fixed sidebar (left) + main content (right)
- Sidebar shows full text labels
- Header: branding left, user menu right, search center

### Tablet (768-1023px)

- Collapsible sidebar (icon-only default)
- Expand on hover/tap
- Responsive grid for dashboard cards (2×2 → 1×4)

### Mobile (<768px)

- Sidebar drawer (off-canvas, toggle via hamburger)
- Bottom navigation bar (optional, TBD)
- Touch-friendly check-in buttons (large targets)
- Simplified forms (single-column)

---

## User Journey Touchpoints

**Entry Points:**

- Organic search → Landing → Signup
- Referral link → Direct signup (pre-filled referrer)
- Direct URL → Login (existing user)
- Email invitation → Onboarding (admin-invited trainer)

**Key Conversion Events:**

- Landing → Signup (CTA click)
- Signup → First class booking (within 7 days)
- Trial → Paid conversion (day 7)
- Member → Trainer upgrade (if career path)
- Member → Referral (NPS > 9)

**Retention Loops:**

- Daily check-in streak
- Weekly progress summary (email + in-app)
- Monthly milestone celebrations
- Quarterly goal review prompts

**Churn Signals:**

- No bookings in 14 days
- Class cancellations > 50%
- Email unopens > 30 days
- Membership expiring without renewal

---

## Error States & Edge Cases

- **No internet:** Offline mode shows cached data, retry button
- **Session expired:** Auto-logout with "Sign in again" prompt
- **Class full:** Waitlist with position indicator, push notification on spot opening
- **Payment failed:** Grace period (3 days), retry flow in billing
- **Trainer sick:** Swap request broadcast to other trainers, member notified
- **Club closed for holiday:** Schedule exception with makeup options

---

## Accessibility Paths

All flows must support:

- Keyboard navigation (Tab/Enter/Escape)
- Screen reader labels (ARIA live regions for alerts)
- High contrast mode (WCAG 2.1 AA)
- Reduced motion (prefers-reduced-motion)
- Font scaling up to 200% without breakage

---

## Analytics Events to Track

**Page Views:** Each route entry
**CTA Clicks:** "Book Class", "Upgrade", "Refer", "Add Member"
**Feature Usage:** "Scheduler opened", "Filter applied", "Export clicked"
**Conversion Funnel:** Landing→Signup→First Booking→Paid
**Retention Metrics:** Daily active users, session length, bookings per user
**Performance Metrics:** Page load time, API response times, error rates

---

_Last updated: Week 1 design finalization (autonomous implementation)_
