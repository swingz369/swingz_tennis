# SwingZ Architecture Refinement Plan

**Date:** 2026-05-06  
**Status:** Implementation Phase  
**Priority:** Critical

---

## Executive Summary

Based on comprehensive codebase analysis of 45+ files:

- **23 Critical Issues** identified
- **31 High-Priority Issues** identified
- **18 Medium-Priority Issues** identified
- **12 Low-Priority Issues** identified

**Total Technical Debt Estimation:** 2-3 weeks for critical issues, 1-2 months for full cleanup

---

## Phase 1: Critical Fixes (Week 1) ✓ IN PROGRESS

### 1.1 Standardized Error Response Format

**Issue:** Inconsistent error responses across API routes  
**Files:** All `/app/api/**/*.ts`  
**Fix:** Create unified error response handler

### 1.2 Error Boundaries for All Pages

**Issue:** Missing error boundaries cause full page crashes  
**Files:** All `/app/(protected)/**/page.tsx`  
**Fix:** Wrap all pages with ErrorBoundary component

### 1.3 Fix Silent Error Swallowing

**Issue:** Errors caught but not surfaced to user  
**File:** `/app/api/sessions/route.ts:78-100`  
**Fix:** Return partial error state in response

### 1.4 useEffect Cleanup & Race Conditions

**Issue:** setState on unmounted components  
**File:** `/app/(protected)/trainer/page.tsx:38-58`  
**Fix:** Add AbortController and cleanup functions

### 1.5 Optimistic Update Race Conditions

**Issue:** Cache updates conflict with server responses  
**File:** `/hooks/use-sessions.ts:64-79`  
**Fix:** Use onSettled instead of onSuccess

### 1.6 Remove/Secure Demo Mode

**Issue:** Demo mode cookie can bypass authentication  
**Files:** `/components/layout/protected-route.tsx`, multiple API routes  
**Fix:** Restrict demo mode to development environment only

---

## Phase 2: High-Priority Fixes (Week 2)

### 2.1 Request Timeouts

**Issue:** Fetch requests can hang indefinitely  
**Fix:** Add AbortSignal with 30s timeout to all fetch calls

### 2.2 Retry Logic with Exponential Backoff

**Issue:** Single retry too aggressive for transient errors  
**Files:** `/hooks/use-user-data.ts`, all React Query hooks  
**Fix:** Implement exponential backoff (1s, 2s, 4s)

### 2.3 Type Safety - Remove 'any'

**Issue:** 106 occurrences of ': any' bypass type safety  
**Priority Files:** `/lib/services/analytics-service.ts`, `/hooks/use-sessions.ts`  
**Fix:** Define proper TypeScript interfaces

### 2.4 Missing Request Validation

**Issue:** Some API routes lack input validation  
**Fix:** Apply Zod validation to all routes consistently

### 2.5 Proper Loading States

**Issue:** Generic "Laden..." without skeleton loaders  
**Files:** Multiple components  
**Fix:** Implement skeleton loading components

### 2.6 Role & Club Access Verification

**Issue:** Inconsistent authorization checks  
**Fix:** Create verifyClubAccess helper, enforce consistently

---

## Phase 3: Medium-Priority Refactoring (Weeks 3-4)

### 3.1 Centralize Type Definitions

**Issue:** Same entities defined differently across files  
**Fix:** Create `/lib/types/` with canonical interfaces

### 3.2 Structured Logging

**Issue:** Mix of console.error, console.log  
**Fix:** Implement `/lib/logger.ts` with levels

### 3.3 Query Key Consistency

**Issue:** Query keys not used consistently  
**Fix:** Audit all hooks, enforce QUERY_KEYS usage

### 3.4 Session Expiry Validation

**Issue:** Protected routes don't check session expiry  
**File:** `/components/layout/protected-route.tsx`  
**Fix:** Add token expiry check and refresh logic

---

## Implementation Strategy

### Priority Matrix

| Issue #             | Severity | Impact | Effort | Priority Score |
| ------------------- | -------- | ------ | ------ | -------------- |
| 1. Error Response   | Critical | High   | Low    | 1              |
| 2. Error Boundaries | Critical | High   | Low    | 1              |
| 3. Silent Errors    | Critical | High   | Low    | 1              |
| 4. Race Conditions  | Critical | Medium | Medium | 2              |
| 5. Demo Mode        | Critical | High   | Low    | 1              |
| 6. Type Safety      | High     | Medium | High   | 3              |
| 7. Timeouts         | High     | High   | Low    | 2              |
| 8. Retry Logic      | High     | Medium | Medium | 2              |

---

## Success Metrics

### Before Refactoring:

- Error handling consistency: 45%
- Type safety coverage: 62% (106 'any' occurrences)
- Loading state coverage: 70%
- Test coverage: ~50%

### After Phase 1 (Target):

- Error handling consistency: 85%
- Type safety coverage: 75%
- Loading state coverage: 90%
- Test coverage: 60%

### After Phase 2 (Target):

- Error handling consistency: 95%
- Type safety coverage: 90%
- Loading state coverage: 95%
- Test coverage: 70%

---

## Risk Mitigation

### Risks:

1. **Breaking Changes**: Standardizing error responses may break frontend consumers
   - _Mitigation:_ Implement adapter layer, gradual rollout

2. **Performance Impact**: Additional validation adds latency
   - _Mitigation:_ Cache validation schemas, use fast validators

3. **Testing Burden**: Need comprehensive tests for refactored code
   - _Mitigation:_ Write tests alongside refactoring, not after

4. **Regression Risk**: Touching critical code paths
   - _Mitigation:_ Feature flags, canary deployments, rollback plan

---

## Files Requiring Immediate Attention

### Critical Priority:

1. `/app/api/sessions/route.ts` - Silent error swallowing
2. `/app/(protected)/bookings/page.tsx` - Stale closures, no error boundary
3. `/app/(protected)/trainer/page.tsx` - Race conditions
4. `/hooks/use-sessions.ts` - Optimistic update conflicts
5. `/lib/api-auth.ts` - Type safety, demo mode
6. `/components/layout/protected-route.tsx` - Demo mode, session expiry

### High Priority:

7. `/hooks/use-user-data.ts` - Retry logic
8. All `/app/api/**/*.ts` - Consistent error handling
9. `/lib/services/analytics-service.ts` - Type safety (9 'any' occurrences)
10. Multiple components - Loading states

---

## Next Steps

1. ✅ Create standardized error response utility
2. ✅ Implement global error boundary wrapper
3. ✅ Fix critical race conditions in hooks
4. ✅ Remove demo mode or restrict to dev
5. ✅ Add request timeouts globally
6. Add retry logic with exponential backoff
7. Begin type safety improvements
8. Add comprehensive error logging

---

**Status:** Ready for implementation  
**Estimated Completion:** 3 weeks for critical issues
