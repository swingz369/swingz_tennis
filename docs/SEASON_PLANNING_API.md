# Season Planning System - API Documentation

## Overview

The Season Planning System is a comprehensive feature that allows tennis club admins to plan entire training seasons (Summer/Winter) by collecting user preferences and using AI-optimized scheduling to generate conflict-free training plans.

## Core Concepts

### Season Lifecycle

1. **Draft** → Create season, configure settings
2. **Collecting Preferences** → Open for users to submit availability
3. **Auto Planning** → Algorithm generates optimized schedule
4. **Manual Review** → Admin reviews and adjusts plan
5. **Published** → Plan is visible to members
6. **Active** → Season is running
7. **Completed** → Season ended

### Key Features

- **User Preferences**: Members and trainers submit weekly availability
- **Auto-Planning Algorithm**: AI-optimized scheduling based on preferences
- **Conflict Detection**: Automatic detection of scheduling conflicts
- **Manual Adjustments**: Admins can modify auto-generated plans
- **Audit Trail**: Complete history of all planning actions

---

## API Endpoints

### Seasons

#### GET /api/seasons

List all seasons for a club

**Query Parameters:**

- `club_id` (required if not admin)
- `season_type`: `summer` | `winter`
- `year`: number
- `planning_status`: comma-separated list
- `is_active`: `true` | `false`

**Response:**

```json
{
  "success": true,
  "seasons": [
    {
      "id": "uuid",
      "club_id": "uuid",
      "name": "Sommer 2026",
      "season_type": "summer",
      "year": 2026,
      "start_date": "2026-04-01",
      "end_date": "2026-09-30",
      "planning_status": "published",
      "preferences_open": false,
      "is_active": true,
      "total_preferences": 45,
      "submitted_preferences": 42,
      "planned_entries": 120,
      "open_conflicts": 3,
      "trainers_count": 8,
      "groups_covered": 12
    }
  ],
  "count": 1
}
```

#### POST /api/seasons

Create a new season

**Request Body:**

```json
{
  "club_id": "uuid",
  "name": "Sommer 2026",
  "season_type": "summer",
  "year": 2026,
  "start_date": "2026-04-01",
  "end_date": "2026-09-30",
  "preferences_deadline": "2026-03-15",
  "description": "Sommertraining 2026",
  "auto_plan_config": {
    "max_iterations": 1000,
    "optimization_goals": ["minimize_conflicts", "maximize_preferences"]
  }
}
```

#### GET /api/seasons/[id]

Get single season with full statistics

#### PATCH /api/seasons/[id]

Update season

**Request Body:**

```json
{
  "name": "Updated Name",
  "planning_status": "collecting_preferences",
  "preferences_open": true
}
```

#### DELETE /api/seasons/[id]

Delete season (only if status is `draft`)

---

### User Preferences

#### GET /api/seasons/[id]/preferences

Get all preferences for a season (admin) or own preference (users)

**Query Parameters (Admin only):**

- `user_id`: Filter by user
- `is_submitted`: `true` | `false`
- `user_role`: `member` | `trainer` | `admin`

**Response:**

```json
{
  "success": true,
  "preferences": [
    {
      "id": "uuid",
      "season_id": "uuid",
      "user_id": "uuid",
      "user_name": "Max Mustermann",
      "user_email": "max@example.com",
      "user_role": "member",
      "preferred_level": "intermediate",
      "weekly_availability": {
        "monday": [{ "start": "09:00", "end": "12:00" }],
        "wednesday": [{ "start": "17:00", "end": "20:00" }]
      },
      "is_submitted": true,
      "submitted_at": "2026-03-10T10:00:00Z"
    }
  ],
  "count": 1
}
```

#### POST /api/seasons/[id]/preferences

Submit or update user preferences

**Request Body:**

```json
{
  "user_role": "member",
  "preferred_level": "intermediate",
  "preferred_age_group": "adult",
  "preferred_group_ids": ["uuid1", "uuid2"],
  "weekly_availability": {
    "monday": [{ "start": "09:00", "end": "12:00" }],
    "tuesday": [],
    "wednesday": [{ "start": "17:00", "end": "20:00" }],
    "thursday": [],
    "friday": [{ "start": "09:00", "end": "11:00" }],
    "saturday": [{ "start": "10:00", "end": "14:00" }],
    "sunday": []
  },
  "unavailable_dates": ["2026-07-15", "2026-08-01"],
  "priority": 8,
  "special_requests": "Prefer outdoor courts"
}
```

#### GET /api/seasons/[id]/preferences/[userId]

Get specific user's preference

#### PATCH /api/seasons/[id]/preferences/[userId]

Update user's preference

#### DELETE /api/seasons/[id]/preferences/[userId]

Delete user's preference

---

### Plan Entries

#### GET /api/seasons/[id]/plan-entries

Get all plan entries for a season

**Query Parameters:**

- `trainer_id`: Filter by trainer
- `court_id`: Filter by court
- `group_id`: Filter by group
- `day_of_week`: 0-6 (0=Monday)
- `status`: comma-separated
- `entry_type`: `training` | `trial_lesson` | etc.

**Response:**

```json
{
  "success": true,
  "entries": [
    {
      "id": "uuid",
      "season_id": "uuid",
      "trainer_id": "uuid",
      "trainer_name": "John Coach",
      "court_id": "uuid",
      "court_name": "Court 1",
      "group_id": "uuid",
      "group_name": "Intermediate Group A",
      "day_of_week": 1,
      "start_time": "09:00:00",
      "end_time": "10:30:00",
      "duration_minutes": 90,
      "entry_type": "training",
      "status": "published",
      "max_participants": 10,
      "participant_count": 8,
      "preference_match_score": 87.5,
      "optimization_score": 92.3
    }
  ],
  "count": 120
}
```

#### POST /api/seasons/[id]/plan-entries

Create a new plan entry (manual)

**Request Body:**

```json
{
  "trainer_id": "uuid",
  "court_id": "uuid",
  "group_id": "uuid",
  "day_of_week": 1,
  "start_time": "09:00:00",
  "end_time": "10:30:00",
  "duration_minutes": 90,
  "max_participants": 10,
  "notes": "Beginner group session"
}
```

#### GET /api/seasons/[id]/plan-entries/[entryId]

Get single plan entry

#### PATCH /api/seasons/[id]/plan-entries/[entryId]

Update plan entry

#### DELETE /api/seasons/[id]/plan-entries/[entryId]

Delete plan entry (not if published/active)

---

### Auto-Planning

#### POST /api/seasons/[id]/auto-plan

Trigger auto-planning algorithm

**Request Body:**

```json
{
  "config": {
    "max_iterations": 1000,
    "optimization_goals": ["minimize_conflicts", "balance_trainer_load"],
    "allow_overbooking": false,
    "prefer_consistent_timeslots": true
  },
  "dry_run": false
}
```

**Response:**

```json
{
  "success": true,
  "season_id": "uuid",
  "metrics": {
    "iterations": 856,
    "runtime_ms": 1234,
    "score": 87.5,
    "conflicts_detected": 3,
    "preferences_matched": 42,
    "trainer_utilization": 75.2,
    "court_utilization": 68.9
  },
  "entries_created": 120,
  "conflicts_detected": 3,
  "warnings": ["3 conflicts detected"]
}
```

#### GET /api/seasons/[id]/auto-plan/status

Get current auto-planning status

---

## Workflow Example

### 1. Admin Creates Season

```bash
POST /api/seasons
{
  "name": "Sommer 2026",
  "season_type": "summer",
  "start_date": "2026-04-01",
  "end_date": "2026-09-30"
}
```

### 2. Admin Opens Preferences

```bash
PATCH /api/seasons/{id}
{
  "planning_status": "collecting_preferences",
  "preferences_open": true,
  "preferences_deadline": "2026-03-15"
}
```

### 3. Users Submit Preferences

```bash
POST /api/seasons/{id}/preferences
{
  "user_role": "member",
  "weekly_availability": {...}
}
```

### 4. Admin Runs Auto-Planning

```bash
# Preview first (dry run)
POST /api/seasons/{id}/auto-plan
{
  "dry_run": true
}

# Then execute
POST /api/seasons/{id}/auto-plan
{
  "dry_run": false
}
```

### 5. Admin Reviews and Adjusts

```bash
GET /api/seasons/{id}/plan-entries
PATCH /api/seasons/{id}/plan-entries/{entryId}
```

### 6. Admin Publishes Plan

```bash
PATCH /api/seasons/{id}
{
  "planning_status": "published"
}
```

### 7. Admin Activates Season

```bash
PATCH /api/seasons/{id}
{
  "planning_status": "active",
  "is_active": true
}
```

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "error": "Error message",
  "details": "Additional details (optional)"
}
```

**Common HTTP Status Codes:**

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., scheduling conflict)
- `500` - Internal Server Error

---

## Permissions

| Endpoint                 | Member | Trainer | Admin | Superadmin |
| ------------------------ | ------ | ------- | ----- | ---------- |
| List seasons (published) | ✅     | ✅      | ✅    | ✅         |
| List seasons (all)       | ❌     | ❌      | ✅    | ✅         |
| Create season            | ❌     | ❌      | ✅    | ✅         |
| Update season            | ❌     | ❌      | ✅    | ✅         |
| Delete season            | ❌     | ❌      | ✅    | ✅         |
| Submit own preferences   | ✅     | ✅      | ✅    | ✅         |
| View all preferences     | ❌     | ❌      | ✅    | ✅         |
| Manual planning          | ❌     | ❌      | ✅    | ✅         |
| Auto-planning            | ❌     | ❌      | ✅    | ✅         |

---

## Rate Limits

- Standard endpoints: 100 requests per 15 minutes
- Auto-planning: 5 requests per hour (expensive operation)

---

## Database Schema

See `supabase/migrations/20260506_season_planning_system.sql` for complete schema.

**Key Tables:**

- `seasons` - Season definitions
- `user_training_preferences` - User availability and preferences
- `season_plan_entries` - Generated training schedule
- `planning_conflicts` - Detected scheduling conflicts
- `season_planning_history` - Audit trail

---

## Next Steps

### UI Implementation

The next phase is to build the admin UI:

1. **Season Management Dashboard** (`/admin/seasons`)
   - List all seasons
   - Create/Edit/Delete seasons
   - Status indicators

2. **Season Detail Page** (`/admin/seasons/[id]`)
   - Overview with stats
   - Preference collection status
   - Auto-planning controls
   - Manual planning interface

3. **User Preference Form** (`/member/seasons/[id]/preferences`)
   - Weekly availability picker
   - Group selection
   - Special requests

4. **Planning Calendar** (`/admin/seasons/[id]/calendar`)
   - Visual weekly calendar
   - Drag-and-drop session editing
   - Conflict highlighting

### Testing

- Unit tests for auto-planning algorithm
- Integration tests for API endpoints
- E2E tests for complete workflow
