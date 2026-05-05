# SwingZ Production Deployment Guide

**Version**: v2.0 (Phase 3 Complete)  
**Date**: 2026-05-06  
**Status**: Ready for Production Deployment

---

## Prerequisites

### Required Accounts

- ✅ Vercel Account (for hosting)
- ✅ Supabase Cloud Account (database already linked)
- ✅ GitHub Account (repository access)

### Required Services

- ✅ Supabase Project: `kjubypbdibzlqjsdlqlu`
- ✅ Database: PostgreSQL (Supabase Cloud)
- ⏳ Vercel KV (for rate limiting - optional)
- ⏳ Zapier (for webhook integration - optional)

---

## Environment Variables

### Required Variables

Copy these to Vercel Project Settings → Environment Variables:

```bash
# Database (Supabase)
DATABASE_URL=postgresql://postgres:[password]@[host]/postgres
NEXT_PUBLIC_SUPABASE_URL=https://kjubypbdibzlqjsdlqlu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...

# Supabase Service Role (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# Authentication
NEXTAUTH_SECRET=[generate-with: openssl rand -base64 32]
NEXTAUTH_URL=https://your-domain.vercel.app

# Email (Resend - optional)
RESEND_API_KEY=re_...

# Payment (Stripe - optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Rate Limiting (Vercel KV - optional but recommended)
KV_REST_API_URL=https://...kv.vercel-storage.com
KV_REST_API_TOKEN=...

# Webhooks (Zapier - optional)
ZAPIER_WEBHOOK_SECRET=[generate-random-string]

# Feature Flags
NODE_ENV=production
```

### Generate Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ZAPIER_WEBHOOK_SECRET
openssl rand -hex 32
```

---

## Deployment Steps

### 1. Vercel Setup

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link project
vercel link

# Set environment variables
vercel env add DATABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# ... add all other required variables
```

### 2. Database Setup (Already Done)

Database is already linked to Supabase Cloud:

- ✅ Project Ref: `kjubypbdibzlqjsdlqlu`
- ✅ Migrations applied
- ✅ RLS policies configured
- ✅ Superadmin user: `superadmin@swingz.com`

### 3. Deploy to Production

```bash
# Deploy to production
vercel --prod

# Or use GitHub integration (recommended)
git push origin main
# Vercel will automatically deploy
```

### 4. Verify Deployment

After deployment, test these endpoints:

```bash
# Health check
curl https://your-domain.vercel.app/api/health

# Database connection
curl https://your-domain.vercel.app/api/debug/auth

# Login (should return CSRF token)
curl https://your-domain.vercel.app/api/csrf-token
```

### 5. Post-Deployment Checklist

- [ ] Health check endpoint responds with 200
- [ ] Landing page loads correctly
- [ ] Login works with test credentials
- [ ] Dashboard loads for each role (Member, Trainer, Admin, Superadmin)
- [ ] Sessions can be viewed
- [ ] Bookings can be created
- [ ] Mobile bottom navigation works
- [ ] Keyboard shortcuts work (press `?`)
- [ ] No console errors in browser
- [ ] No errors in Vercel logs

---

## Configuration

### Vercel KV Setup (Optional but Recommended)

For distributed rate limiting across multiple server instances:

1. Go to Vercel Dashboard → Storage → Create KV Database
2. Link to your project
3. Copy `KV_REST_API_URL` and `KV_REST_API_TOKEN` to environment variables

Without Vercel KV, rate limiting will work but only per-instance (acceptable for most use cases).

### Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Configure DNS records as shown
4. Update `NEXTAUTH_URL` environment variable

---

## Monitoring

### Vercel Analytics

1. Enable Vercel Analytics in project settings
2. Monitor performance metrics:
   - Response times
   - Error rates
   - Geographic distribution

### Supabase Monitoring

1. Go to Supabase Dashboard → Database
2. Monitor:
   - Query performance
   - Database size
   - Connection pool usage

### Error Tracking (Recommended)

Consider adding Sentry for error tracking:

```bash
npm install @sentry/nextjs

# Add SENTRY_DSN to environment variables
vercel env add SENTRY_DSN production
```

---

## Performance Expectations

### API Response Times

| Endpoint              | Expected Response Time |
| --------------------- | ---------------------- |
| `/api/sessions`       | 100-200ms              |
| `/api/bookings`       | 200-300ms              |
| `/api/schedule`       | 300-500ms              |
| `/api/dashboard/kpis` | 200-400ms              |

### Cache Hit Rates

| Cache Type    | Expected Hit Rate |
| ------------- | ----------------- |
| Schedule data | 70-80%            |
| Trainer data  | 80-90%            |
| Static assets | 95%+              |

---

## Rollback Plan

If deployment fails or critical issues are found:

```bash
# Revert to previous deployment
vercel rollback

# Or redeploy specific commit
git revert HEAD
git push origin main
```

---

## Database Backups

Supabase automatically backs up your database daily. To create manual backup:

1. Go to Supabase Dashboard → Database → Backups
2. Click "Create Backup"
3. Backups are retained for 30 days (paid plans)

---

## Security Checklist

- [x] CSRF protection enabled on all mutations
- [x] Rate limiting implemented (login: 5/15min, API: 100/min)
- [x] SQL injection prevention (parameterized queries)
- [x] XSS protection (React auto-escaping)
- [x] Secure session management (NextAuth)
- [x] Row-Level Security (RLS) enabled
- [x] API authentication required
- [x] Role-based access control (RBAC)
- [x] Audit logging for sensitive operations
- [x] Webhook signature validation
- [ ] SSL/TLS certificate (automatic via Vercel)
- [ ] Environment variables secured (not committed to git)

---

## Scaling Considerations

### Current Architecture

- **Database**: Supabase Cloud (auto-scaling)
- **Hosting**: Vercel Edge Network (auto-scaling)
- **Caching**: In-memory per-instance (Phase 3)

### When to Scale Up

Monitor these metrics:

- Database CPU > 80% sustained
- API response time > 1000ms P95
- Error rate > 1%
- Cache memory usage > 100MB per instance

### Scaling Options

1. **Database**: Upgrade Supabase plan for more resources
2. **Caching**: Migrate to Redis (Upstash or Vercel KV)
3. **CDN**: Enable Vercel's CDN for static assets
4. **Read Replicas**: Add read replicas for heavy read workloads

---

## Support & Troubleshooting

### Common Issues

**Issue**: "Database connection failed"

- **Solution**: Check `DATABASE_URL` environment variable
- **Verify**: Connection string is correct and includes password

**Issue**: "CSRF token mismatch"

- **Solution**: Clear browser cookies
- **Verify**: `NEXTAUTH_URL` matches actual domain

**Issue**: "Rate limit exceeded"

- **Solution**: Wait or increase rate limits in `lib/rate-limit.ts`
- **Note**: Rate limits reset every 15 minutes

### Logs

View logs in Vercel Dashboard:

- Runtime logs: Functions → Logs
- Build logs: Deployments → [deployment] → Build Logs
- Edge logs: Edge Middleware → Logs

---

## Next Steps (Phase 4 - Optional)

After successful deployment, consider implementing:

1. **Feedback System** - Trainer ratings and reviews
2. **Email Campaigns** - Automated reminders and newsletters
3. **PWA Support** - Offline functionality and push notifications
4. **Internationalization** - Multi-language support (DE, EN, FR)
5. **Advanced Analytics** - Custom dashboards and reports
6. **API Documentation** - OpenAPI/Swagger for external integrations

---

## Contact & Resources

- **Repository**: [GitHub URL]
- **Documentation**: `/docs` folder
- **Architecture**: `ARCHITECTURE_ANALYSIS.md`
- **Performance**: `docs/PERFORMANCE_OPTIMIZATIONS.md`
- **Deployment Status**: `DEPLOYMENT_STATUS.md`

---

**Deployment prepared by**: Kilo AI  
**Last updated**: 2026-05-06  
**Version**: v2.0 - Phase 3 Complete
