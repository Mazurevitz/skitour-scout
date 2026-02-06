# SkitourScout Improvement Tracker

> **Note:** This file can be deleted once most or all items are completed.

Last updated: 2026-02-06

---

## Critical Issues (fix before production)

- [x] **Memory leak in auth listener** - `useAuthStore.ts` - Fixed: now stores subscription and provides cleanup function
- [x] **OAuth redirect risk** - `useAuthStore.ts` - Fixed: validates origin against ALLOWED_ORIGINS list
- [x] **RLS policy gap** - Fixed: new migration `20240104000000_fix_profile_rls.sql` prevents `is_admin` updates

---

## High Priority Improvements

### Performance
- [x] **Missing memoization in MobileDashboard.tsx** - Fixed with useMemo/useCallback
  - sortedRoutes, verifiedReports, recentReports now memoized
  - Callbacks memoized with useCallback

### Offline Support
- [x] Add offline indicator UI - Added offline banner with useOnlineStatus hook
- [ ] Implement retry queue for failed operations
- [ ] Add conflict resolution strategy for sync
- [ ] Two-way sync (currently one-way only)

### Error Handling
- [x] Show user feedback for weather/avalanche failures - Added error banner in MobileDashboard
- [ ] Add error boundaries for async operations
- [ ] Improve error messages in search failures

### Database Performance
- [ ] Add pagination for reports query (`useReportsStore.ts:310` fetches 200 every sync)
- [ ] Move aggregation to SQL instead of JavaScript
- [ ] Consider PostGIS for geographic queries (currently JSONB)

---

## Medium Priority

### Code Architecture
- [ ] Refactor `Orchestrator.ts:150-312` - Split 163-line scoring into separate modules
- [ ] Consolidate `WebSearchAgent.ts:279-291` - 3 brittle regex patterns for DuckDuckGo
- [ ] Remove duplicated report conversion logic in `useReportsStore.ts`

### Missing Features
- [ ] Remove or fix Facebook OAuth (currently disabled)
- [ ] Integrate admin report moderation UI
- [ ] Add search/filter for reports by date or type
- [ ] Add report sharing functionality

### UX/Accessibility
- [ ] Fix color contrast issues in `CommunityIntel.tsx`
- [ ] Add ARIA labels on interactive elements
- [ ] Add haptic feedback for gestures
- [ ] Consistent loading skeletons across views

---

## Low Priority / Nice to Have

- [ ] Optimize PWA cache strategy (1 hour too long for edge functions)
- [ ] Add internationalization (currently Polish only, hardcoded)
- [ ] Add favorites/bookmarks for routes
- [ ] Replace `date-fns` with native `toLocaleDateString` where possible

---

## Feature Completion Status (from original plan)

| Phase | Status |
|-------|--------|
| Supabase Foundation | Done |
| Authentication | Done (Facebook disabled) |
| Edge Functions | Done |
| Reports Integration | Partial (one-way sync) |
| User Dashboard | Done |
| Admin Features | Partial (ingestion exists, moderation UI missing) |
| Cleanup | Not done |

---

## Completed Items

- **2026-02-06**: Fixed memory leak in auth listener (`useAuthStore.ts`) - stores subscription reference and provides `cleanup()` function
- **2026-02-06**: Fixed OAuth redirect vulnerability - validates origin against allowed list before redirect
- **2026-02-06**: Fixed RLS policy gap - new migration prevents users from updating their own `is_admin` field
- **2026-02-06**: Added memoization to MobileDashboard - `useMemo` for computed values, `useCallback` for handlers
- **2026-02-06**: Added error feedback UI - error state in store, dismissible error banner in dashboard
- **2026-02-06**: Added offline indicator - `useOnlineStatus` hook detects connectivity, shows amber banner when offline

