# SwingZ API Developer Guide

**Version**: 2.0.0  
**Last Updated**: 2026-05-06

---

## Quick Start

### 1. Authentication

```bash
# Login to get JWT token
curl -X POST https://swingz.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Response
{
  "user": {...},
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "..."
  }
}
```

### 2. Make Authenticated Requests

```bash
curl -X GET https://swingz.vercel.app/api/sessions?clubId=xxx \
  -H "Authorization: Bearer <your-access-token>"
```

### 3. CSRF Protection

For mutation requests (POST, PUT, DELETE), include CSRF token:

```bash
# Get CSRF token
curl https://swingz.vercel.app/api/csrf-token

# Use in mutations
curl -X POST https://swingz.vercel.app/api/bookings \
  -H "Authorization: Bearer <token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "...", "memberId": "..."}'
```

---

## API Endpoints

### Authentication

#### POST /api/auth/login

**Description**: User login  
**Rate Limit**: 5 requests per 15 minutes  
**Body**:

```json
{
  "email": "string (email)",
  "password": "string"
}
```

**Response** (200):

```json
{
  "user": {
    "id": "uuid",
    "email": "string",
    "role": "member|trainer|admin|super_admin"
  },
  "session": {
    "access_token": "string",
    "refresh_token": "string"
  }
}
```

---

### Members

#### GET /api/members

**Description**: List all members (admin/trainer only)  
**Auth**: Required  
**Query Params**:

- `clubId` (required): Club UUID
- `search` (optional): Search term
- `status` (optional): active|inactive

**Response** (200):

```json
[
  {
    "id": "uuid",
    "email": "string",
    "name": "string",
    "club_id": "uuid",
    "role": "member",
    "is_active": true,
    "created_at": "ISO8601"
  }
]
```

#### POST /api/members

**Description**: Create new member  
**Auth**: Admin only  
**CSRF**: Required  
**Body**:

```json
{
  "email": "string (email)",
  "name": "string",
  "clubId": "uuid",
  "password": "string (min 8 chars)"
}
```

#### PUT /api/members/[id]

**Description**: Update member  
**Auth**: Member (own profile) or Admin  
**CSRF**: Required  
**Body**:

```json
{
  "name": "string",
  "email": "string (email)"
}
```

#### POST /api/members/bulk-deactivate

**Description**: Deactivate multiple members  
**Auth**: Admin only  
**CSRF**: Required  
**Rate Limit**: 10 requests per minute  
**Body**:

```json
{
  "memberIds": ["uuid", "uuid", ...]
}
```

---

### Sessions

#### GET /api/sessions

**Description**: List training sessions  
**Auth**: Required (member+)  
**Query Params**:

- `clubId` (required): Club UUID
- `startDate` (optional): Filter from date (ISO8601)
- `endDate` (optional): Filter to date (ISO8601)

**Response** (200):

```json
[
  {
    "id": "uuid",
    "week": "2026-W18",
    "dayOfWeek": 1,
    "startTime": "09:00",
    "endTime": "10:00",
    "trainerId": "uuid",
    "trainerName": "John Doe",
    "maxParticipants": 8,
    "notes": "Beginner group",
    "bookedByUser": false,
    "bookingId": null
  }
]
```

#### POST /api/sessions

**Description**: Create training session  
**Auth**: Trainer or Admin  
**CSRF**: Required  
**Body**:

```json
{
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "10:00",
  "trainerId": "uuid",
  "maxParticipants": 8,
  "notes": "Optional",
  "clubId": "uuid"
}
```

#### DELETE /api/sessions/[id]

**Description**: Delete session  
**Auth**: Trainer (own) or Admin  
**CSRF**: Required

#### POST /api/sessions/bulk-delete

**Description**: Delete multiple sessions  
**Auth**: Trainer or Admin  
**CSRF**: Required  
**Rate Limit**: 10 requests per minute  
**Body**:

```json
{
  "sessionIds": ["uuid", "uuid", ...]
}
```

---

### Bookings

#### GET /api/bookings

**Description**: List member bookings  
**Auth**: Required  
**Query Params**:

- `memberId` (required): Member UUID

**Response** (200):

```json
[
  {
    "id": "uuid",
    "sessionId": "uuid",
    "status": "confirmed",
    "bookedAt": "ISO8601",
    "session_start": "ISO8601",
    "session_end": "ISO8601",
    "trainer_name": "John Doe",
    "clubId": "uuid"
  }
]
```

#### POST /api/bookings

**Description**: Create booking  
**Auth**: Required  
**CSRF**: Required  
**Body**:

```json
{
  "sessionId": "uuid",
  "memberId": "uuid"
}
```

**Business Rules**:

- Max participants check
- No double bookings
- Cancellation deadline enforcement

#### DELETE /api/bookings/[id]/cancel

**Description**: Cancel booking  
**Auth**: Member (own) or Admin  
**CSRF**: Required  
**Query Params**:

- `force` (optional): Skip cancellation deadline (admin only)

---

### Clubs

#### GET /api/clubs

**Description**: List clubs  
**Auth**: Required  
**Response** (200):

```json
[
  {
    "id": "uuid",
    "name": "Tennis Club Berlin",
    "address": "Hauptstraße 1, 10115 Berlin",
    "contact_email": "info@club.de",
    "is_active": true
  }
]
```

#### POST /api/clubs

**Description**: Create club  
**Auth**: Superadmin only  
**CSRF**: Required  
**Body**:

```json
{
  "name": "string",
  "address": "string",
  "contact_email": "string (email)"
}
```

---

### Billing

#### GET /api/billing/invoices/overview

**Description**: Get invoice overview  
**Auth**: Admin  
**Query Params**:

- `clubId` (required): Club UUID

**Response** (200):

```json
{
  "total": 15000,
  "paid": 12000,
  "pending": 3000,
  "overdue": 0,
  "invoices": [...]
}
```

#### POST /api/billing/invoices/create

**Description**: Create invoice  
**Auth**: Admin  
**CSRF**: Required  
**Body**:

```json
{
  "memberId": "uuid",
  "items": [
    {
      "description": "Monthly membership",
      "amount": 50.0,
      "quantity": 1
    }
  ],
  "dueDate": "ISO8601"
}
```

---

### Analytics

#### GET /api/analytics

**Description**: Get analytics data  
**Auth**: Admin  
**Query Params**:

- `clubId` (required): Club UUID
- `startDate` (optional): ISO8601
- `endDate` (optional): ISO8601
- `metric` (optional): bookings|revenue|members|sessions

**Response** (200):

```json
{
  "bookings": {
    "total": 150,
    "confirmed": 120,
    "cancelled": 20,
    "no_show": 10
  },
  "revenue": {
    "total": 5000,
    "paid": 4500,
    "pending": 500
  },
  "members": {
    "total": 85,
    "active": 75,
    "new_this_month": 5
  }
}
```

---

### System

#### GET /api/health

**Description**: Health check endpoint  
**Auth**: None  
**Response** (200):

```json
{
  "status": "ok",
  "timestamp": "ISO8601",
  "version": "2.0.0"
}
```

#### GET /api/csrf-token

**Description**: Get CSRF token  
**Auth**: None  
**Response** (200):

```json
{
  "csrfToken": "string"
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Error message"
}
```

### Common HTTP Status Codes

- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Missing or invalid auth token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Rate Limiting

Default rate limits per IP address:

| Endpoint Pattern   | Limit        | Window     |
| ------------------ | ------------ | ---------- |
| `/api/auth/login`  | 5 requests   | 15 minutes |
| `/api/*/bulk-*`    | 10 requests  | 1 minute   |
| `/api/webhooks/*`  | 10 requests  | 1 minute   |
| `/api/*` (default) | 100 requests | 1 minute   |

**Response Headers**:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
```

When rate limited (429):

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

---

## Webhooks

### Stripe Webhook

**Endpoint**: `POST /api/webhooks/stripe`  
**Auth**: Stripe signature verification  
**Events**:

- `payment_intent.succeeded`
- `payment_intent.failed`
- `invoice.paid`
- `invoice.payment_failed`

### Zapier Webhook

**Endpoint**: `POST /api/webhooks/zapier`  
**Auth**: HMAC signature (X-Zapier-Signature header)  
**Rate Limit**: 10 requests per minute

---

## Best Practices

### 1. Always Use HTTPS

Production API only accepts HTTPS connections.

### 2. Handle Rate Limits

Implement exponential backoff when receiving 429 responses.

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status !== 429) {
      return response;
    }

    const retryAfter = response.headers.get('X-RateLimit-Reset');
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i) * 1000;

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error('Max retries exceeded');
}
```

### 3. Cache Responses

Many GET endpoints return data that doesn't change frequently. Use caching:

```javascript
// Cache for 5 minutes
const response = await fetch('/api/sessions?clubId=xxx', {
  headers: {
    'Cache-Control': 'max-age=300',
  },
});
```

### 4. Use Pagination

For large datasets, implement pagination:

```javascript
// Future: Pagination will be added
// ?page=1&limit=50
```

### 5. Validate Input Client-Side

Reduce API calls by validating before sending:

```javascript
import { z } from 'zod';

const bookingSchema = z.object({
  sessionId: z.string().uuid(),
  memberId: z.string().uuid(),
});

// Validate before API call
const result = bookingSchema.safeParse(data);
if (!result.success) {
  // Handle validation errors
  return;
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
class SwingZClient {
  private baseUrl: string;
  private token: string | null = null;
  private csrfToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    this.token = data.session.access_token;
    return data;
  }

  async getCSRFToken() {
    const response = await fetch(`${this.baseUrl}/api/csrf-token`);
    const data = await response.json();
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  async getSessions(clubId: string) {
    const response = await fetch(`${this.baseUrl}/api/sessions?clubId=${clubId}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    return response.json();
  }

  async createBooking(sessionId: string, memberId: string) {
    if (!this.csrfToken) {
      await this.getCSRFToken();
    }

    const response = await fetch(`${this.baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        'X-CSRF-Token': this.csrfToken!,
      },
      body: JSON.stringify({ sessionId, memberId }),
    });
    return response.json();
  }
}

// Usage
const client = new SwingZClient('https://swingz.vercel.app');
await client.login('user@example.com', 'password');
const sessions = await client.getSessions('club-id');
await client.createBooking('session-id', 'member-id');
```

### Python

```python
import requests
from typing import Optional

class SwingZClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.csrf_token: Optional[str] = None

    def login(self, email: str, password: str):
        response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"email": email, "password": password}
        )
        data = response.json()
        self.token = data['session']['access_token']
        return data

    def get_csrf_token(self):
        response = requests.get(f"{self.base_url}/api/csrf-token")
        self.csrf_token = response.json()['csrfToken']
        return self.csrf_token

    def get_sessions(self, club_id: str):
        response = requests.get(
            f"{self.base_url}/api/sessions",
            params={"clubId": club_id},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        return response.json()

    def create_booking(self, session_id: str, member_id: str):
        if not self.csrf_token:
            self.get_csrf_token()

        response = requests.post(
            f"{self.base_url}/api/bookings",
            json={"sessionId": session_id, "memberId": member_id},
            headers={
                "Authorization": f"Bearer {self.token}",
                "X-CSRF-Token": self.csrf_token
            }
        )
        return response.json()

# Usage
client = SwingZClient('https://swingz.vercel.app')
client.login('user@example.com', 'password')
sessions = client.get_sessions('club-id')
client.create_booking('session-id', 'member-id')
```

---

## Testing

### Postman Collection

Import the Postman collection from `/docs/postman/swingz-api.json`

Or create your own:

1. Set environment variables:
   - `base_url`: https://swingz.vercel.app
   - `access_token`: (get from login)
   - `csrf_token`: (get from /api/csrf-token)

2. Add pre-request script for CSRF:

```javascript
pm.sendRequest(
  {
    url: pm.environment.get('base_url') + '/api/csrf-token',
    method: 'GET',
  },
  (err, res) => {
    pm.environment.set('csrf_token', res.json().csrfToken);
  }
);
```

### cURL Examples

See individual endpoint documentation above.

---

## Changelog

### v2.0.0 (2026-05-06)

- ✅ Phase 3 complete: Performance optimizations, mobile UX, accessibility
- ✅ N+1 query fixes with batch fetching
- ✅ In-memory caching with TTL
- ✅ Keyboard shortcuts
- ✅ Unified booking interface

### v1.0.0 (2026-05-05)

- ✅ Phase 1 complete: Security fixes, CSRF protection, rate limiting
- ✅ Phase 2 complete: State machines, audit logging, toast system

---

## Support

- **Email**: support@swingz.app
- **Documentation**: https://swingz.vercel.app/api-docs
- **GitHub Issues**: [Your repo URL]

---

**© 2026 SwingZ - Tennis Club Management System**
