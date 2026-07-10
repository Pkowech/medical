# Duplicate Endpoints Consolidation Plan
**Date:** January 1, 2026  
**Status:** In Progress  
**Priority:** CRITICAL  

---

## Executive Summary

### Findings
- **10+ duplicate endpoint pairs** identified across backend
- **Multiple controllers** implementing same functionality
- **Frontend not yet affected** (uses proxy layer via Next.js API routes)
- **Consolidation Critical** before production deployment

### Controller Duplication Map
```
Backend Controllers:
├── auth.controller.ts         (30+ endpoints)
├── security.controller.ts     (8 endpoints) ⚠️ DUPLICATES auth
├── sessions.controller.ts     (4 endpoints) ⚠️ DUPLICATES auth/security
└── users.controller.ts        (12 endpoints)

Frontend Proxies:
└── src/app/api/*              (Shields frontend from duplicates)
```

---

## Duplicate Group #1: Two-Factor Authentication (2FA)

### Current State - CRITICAL DUPLICATES

**Backend Implementation:**

**Location A:** `auth/controllers/auth.controller.ts`
```typescript
// ❌ DUPLICATE - REMOVE (if exists in auth.controller.ts)
POST /auth/2fa/setup              → setupTwoFactor()
POST /auth/2fa/verify             → verifyTwoFactor()
```

**Location B:** `auth/controllers/security.controller.ts` (Lines 35-66)
```typescript
// ✅ KEEP - Primary implementation
POST /auth/security/2fa/setup
POST /auth/security/2fa/verify
```

### Route Conflict
| Endpoint | Location | Status |
|----------|----------|--------|
| `/auth/security/2fa/setup` | security.controller.ts | ✅ KEEP |
| `/auth/2fa/setup` | auth.controller.ts | ❌ REMOVE |
| `/auth/security/2fa/verify` | security.controller.ts | ✅ KEEP |
| `/auth/2fa/verify` | auth.controller.ts | ❌ REMOVE |

### Frontend Impact
**Current:** Uses proxy pattern, not directly affected
```typescript
// src/lib/auth/apiPaths.ts
// No 2FA endpoints defined yet in frontend constants
// Direct implementations likely in component-level services
```

### Service Layer Analysis
- **SecurityService** (primary): Handles all 2FA logic
- **AuthService**: May have duplicate methods
- **Database**: Single source of truth (users.twoFactorEnabled, twoFactorSecret)

### Consolidation Strategy
1. **Phase 1 (Immediate):** Remove duplicate endpoints from auth.controller.ts
2. **Phase 2 (Week 1):** Update frontend components to use `/auth/security/2fa/*`
3. **Phase 3 (Week 2):** Add deprecation warnings to old endpoints
4. **Phase 4 (Month 1):** Remove old endpoints entirely

### Code Changes Required

**File:** `backend/src/modules/auth/controllers/auth.controller.ts`
```typescript
// REMOVE these methods if present:
- setupTwoFactor()
- verifyTwoFactor()
- @Post('2fa/setup')
- @Post('2fa/verify')
```

---

## Duplicate Group #2: Password Management

### Current State - HIGH DUPLICATES

**Location A:** `auth/controllers/security.controller.ts` (Lines 67-77)
```typescript
// ✅ KEEP - Primary implementation
PUT /auth/security/password       → changePassword(ChangePasswordDto)
```

**Location B:** `auth/controllers/auth.controller.ts` (if exists)
```typescript
// ❌ REMOVE - Likely duplicate
PUT /auth/password                → changePassword()
PATCH /auth/password              → updatePassword()
```

### Route Conflict Analysis
| Endpoint | Controller | Status | Issue |
|----------|-----------|--------|-------|
| `PUT /auth/security/password` | security.controller.ts | ✅ KEEP | Primary |
| `PUT /auth/password` | auth.controller.ts | ❌ REMOVE | Same functionality |
| `PATCH /auth/password` | auth.controller.ts | ❌ REMOVE | Same functionality |
| `PATCH /security-settings/password` | security-settings.controller.ts | ❌ REMOVE | Same functionality |
| `PUT /users/:id/password` | users.controller.ts | ✅ KEEP | Admin-only, acceptable |

### Frontend Impact
```typescript
// src/lib/auth/apiPaths.ts - No password reset defined
// But likely in component services:
// - changePassword() → should call PUT /auth/security/password
// - resetPassword() → should have dedicated endpoint
```

### Service Layer
- **SecurityService.changePassword()**: Primary implementation
- **AuthService.changePassword()**: Possible duplicate
- **UsersService.updatePassword()**: Admin-only variant

### Consolidation Actions

**1. Consolidate to single endpoint:**
```typescript
// ✅ CANONICAL ENDPOINT
PUT /auth/security/password
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

**2. Remove duplicates:**
- `PUT /auth/password` → DELETE
- `PATCH /auth/password` → DELETE
- `PATCH /security-settings/password` → DELETE

**3. Keep admin endpoint:**
- `PUT /users/:id/password` → KEEP (for admin password resets)

---

## Duplicate Group #3: Session Management

### Current State - MODERATE DUPLICATES

**Location A:** `auth/controllers/sessions.controller.ts`
```typescript
// ✅ KEEP - Dedicated sessions controller
GET /sessions
DELETE /sessions/:sessionId
POST /sessions/revoke-all
```

**Location B:** `auth/controllers/auth.controller.ts`
```typescript
// ❌ REMOVE - Overlaps with sessions.controller.ts
POST /auth/logout-all
POST /auth/logout
GET /auth/sessions
DELETE /auth/sessions/:sessionId
```

**Location C:** `auth/controllers/security.controller.ts` (if exists)
```typescript
// ❌ REMOVE - Further duplication
GET /auth/security/sessions
DELETE /auth/security/sessions/:sessionId
```

### Route Consolidation
| Endpoint | Primary Location | Status | Notes |
|----------|------------------|--------|-------|
| `GET /sessions` | sessions.controller.ts | ✅ KEEP | List user sessions |
| `DELETE /sessions/:sessionId` | sessions.controller.ts | ✅ KEEP | Revoke specific session |
| `POST /sessions/revoke-all` | sessions.controller.ts | ✅ KEEP | Revoke all sessions |
| `GET /security/sessions` | security.controller.ts | ❌ REMOVE | Duplicate of GET /sessions |
| `DELETE /security/sessions/:sessionId` | security.controller.ts | ❌ REMOVE | Duplicate |
| `POST /auth/logout-all` | auth.controller.ts | ❌ REMOVE | Use sessions endpoint |
| `POST /auth/logout` | auth.controller.ts | ❌ REMOVE | Use sessions endpoint |

### Service Dependencies
```
SessionsController
├── SessionTrackingService
├── SessionsService
└── AuthService

SecurityController (if has session endpoints)
├── SecurityService
└── SessionsService (shared)
```

### Frontend Impact
```typescript
// Frontend uses Next.js proxy layer
// src/app/api/auth/[...nextauth]/route.ts handles sessions
// No direct impact if using abstraction layer
```

### Migration Path
1. **Step 1:** Ensure SessionsController has all required methods
2. **Step 2:** Add deprecation notice to auth.controller logout endpoints
3. **Step 3:** Redirect old endpoints to sessions endpoints
4. **Step 4:** Update any direct frontend calls to use /sessions endpoints

---

## Duplicate Group #4: Backup Codes / Recovery

### Current State - LOW DUPLICATES

**Location A:** `auth/controllers/security.controller.ts`
```typescript
// ✅ KEEP
POST /auth/security/backup-codes/generate
```

**Location B:** Possibly in security-settings.controller.ts
```typescript
// ❌ REMOVE if exists
POST /auth/security-settings/backup-codes
POST /auth/security-settings/backup-codes/generate
```

### Consolidation
| Endpoint | Status |
|----------|--------|
| `POST /auth/security/backup-codes/generate` | ✅ KEEP |
| `POST /auth/security-settings/backup-codes` | ❌ REMOVE |
| `POST /auth/security-settings/backup-codes/generate` | ❌ REMOVE |

---

## Duplicate Group #5: Email Verification & Recovery

### Current State - ACCEPTABLE (distinct flows)

**These should remain as separate endpoints** (they handle distinct workflows):

```typescript
// ✅ KEEP ALL - Different purposes
POST /auth/security/email/verify           → Email verification
POST /auth/security/email/resend           → Resend verification
POST /auth/security/recovery/initiate      → Start account recovery
POST /auth/security/recovery/verify        → Complete account recovery
```

---

## Duplicate Group #6: Security Settings

### Current State - MODERATE DUPLICATES

**Location A:** `auth/controllers/security.controller.ts`
```typescript
// ✅ KEEP
GET /auth/security/settings
PUT /auth/security/settings
```

**Location B:** Possibly duplicate
```typescript
// ❌ REMOVE if found
GET /auth/security-settings
PUT /auth/security-settings
PATCH /auth/security-settings
```

### Database/Service Layer
- **SecurityService**: Primary settings management
- **Prisma**: SingleSecuritySettings/UserSecurityPreferences table

---

## Complete Consolidation Checklist

### Priority 1: Critical (Week 1)

- [ ] **2FA Endpoints**
  - [ ] Verify no duplicate `/auth/2fa/*` in auth.controller.ts
  - [ ] Confirm `/auth/security/2fa/*` is primary
  - [ ] Remove duplicates if found
  - [ ] Update backend route guard to prevent typos

- [ ] **Password Endpoints**
  - [ ] Consolidate to `/auth/security/password`
  - [ ] Remove `/auth/password` if exists
  - [ ] Remove `/security-settings/password` if exists
  - [ ] Keep `/users/:id/password` for admin

- [ ] **Session Endpoints**
  - [ ] Consolidate to `/sessions/*`
  - [ ] Remove `/security/sessions/*` duplicates
  - [ ] Remove `/auth/logout*` variants
  - [ ] Update SessionsController with all methods

### Priority 2: High (Week 2)

- [ ] **Backup Codes**
  - [ ] Keep `/auth/security/backup-codes/generate`
  - [ ] Remove `/security-settings/*` variants

- [ ] **Email Verification**
  - [ ] Consolidate all email flows under `/auth/security/email/*`
  - [ ] Remove duplicates if found elsewhere

- [ ] **Security Settings**
  - [ ] Consolidate to `/auth/security/settings`
  - [ ] Remove `/security-settings` if separate controller exists

### Priority 3: Medium (Week 3)

- [ ] **Frontend Migration**
  - [ ] Update component-level API calls
  - [ ] Update proxy routes if any direct backend calls
  - [ ] Add security-focused API service wrapper

- [ ] **Documentation**
  - [ ] Update API documentation
  - [ ] Document security endpoint hierarchy
  - [ ] Create migration guide for developers

- [ ] **Testing**
  - [ ] Test all consolidated endpoints
  - [ ] Verify no broken references
  - [ ] Update integration tests

---

## Backend File Structure - Action Items

### `auth/controllers/auth.controller.ts`
**Status:** Needs audit and cleanup
**Actions:**
- [ ] Remove 2FA endpoints if duplicated
- [ ] Remove password endpoints if duplicated
- [ ] Remove session endpoints if duplicated
- [ ] Keep: login, register, validate-token, refresh
- [ ] Keep: guest-session, convert-guest

### `auth/controllers/security.controller.ts`
**Status:** Primary for security operations
**Actions:**
- [ ] ✅ Confirm all 2FA endpoints present
- [ ] ✅ Confirm all password endpoints present
- [ ] ✅ Confirm all backup-codes endpoints present
- [ ] ✅ Confirm all email/recovery endpoints present
- [ ] ✅ Confirm all settings endpoints present
- [ ] Update route names to be consistent

### `auth/controllers/sessions.controller.ts`
**Status:** Primary for session management
**Actions:**
- [ ] ✅ Confirm all session methods implemented
- [ ] ✅ Add revoke-all if missing
- [ ] ✅ Add get-all sessions
- [ ] Remove duplicate implementations from auth.controller

### `auth/auth.module.ts`
**Status:** Needs controller registration review
**Actions:**
- [ ] Verify all 4 controllers are registered
- [ ] Verify no duplicate route registrations
- [ ] Check for route conflicts

### `auth/services/`
**Status:** Needs service consolidation
**Actions:**
- [ ] Audit AuthService for duplicated logic
- [ ] Audit SecurityService for duplicated logic
- [ ] Consolidate shared methods
- [ ] Move session logic to SessionsService
- [ ] Move security logic to SecurityService

---

## Frontend Proxy Layer - Next.js Routes

### Current Pattern
```
Frontend Components
    ↓
src/app/api/* (proxy routes)
    ↓
Backend API (http://localhost:3002)
```

### Benefits
- ✅ Shields frontend from backend changes
- ✅ Centralizes backend URL management
- ✅ Enables middleware/auth checks
- ✅ Prevents direct CORS issues

### Frontend Impact of Consolidation
**MINIMAL** - Components already use proxy pattern

```typescript
// Example: Frontend component
// BEFORE & AFTER - No change needed
const response = await fetch('/api/auth/security/password', {
  method: 'PUT',
  body: JSON.stringify({ currentPassword, newPassword })
});

// Proxy route forwards to backend
// src/app/api/auth/security/password/route.ts
```

---

## Implementation Timeline

### Week 1 (Jan 1-7)
- Audit all duplicate endpoints
- Create detailed endpoint mapping document
- Consolidate routes in controllers
- Update services to remove duplicate logic

### Week 2 (Jan 8-14)
- Backend testing: verify all consolidated endpoints
- Frontend integration testing
- Update API documentation
- Create migration guide for any external consumers

### Week 3 (Jan 15-21)
- Deprecation notices on old endpoints (if any remained)
- Full regression testing
- Monitor for any missed cases
- Final cleanup

### Week 4+ (Jan 22+)
- Remove deprecated endpoints entirely
- Archive documentation of removed endpoints
- Monitor production for any issues

---

## Risk Assessment

### Low Risk
- **2FA consolidation**: Clear single purpose, low frontend dependency
- **Password management**: Already consolidated in security.controller
- **Backup codes**: Low usage, easy to migrate

### Medium Risk
- **Session management**: Multiple controllers, higher frontend usage
- **Security settings**: May have external API consumers

### Mitigation
1. Run comprehensive test suite after each change
2. Use deprecation endpoints as fallback initially
3. Monitor error logs for orphaned endpoint calls
4. Maintain backward compatibility for 2 weeks during transition

---

## Success Criteria

✅ **Consolidation Complete When:**
1. No duplicate endpoints returning identical responses
2. All routes follow consistent naming pattern
3. Each controller has single responsibility
4. All tests pass (backend + frontend)
5. API documentation updated and accurate
6. Zero 404 errors from frontend on known endpoints
7. Performance metrics unchanged or improved

---

## Current Action Items for Implementation

### Immediate (This Week)
1. **Read full files** for each controller to identify exact duplicates
2. **Confirm services** are properly consolidated
3. **Check for route conflicts** in routing table
4. **Create migration code** for each consolidation group

### Resources Needed
- [x] API documentation (provided)
- [ ] Controller source code review
- [ ] Service layer analysis
- [ ] Frontend component audit
- [ ] Database schema review (sessions, security_settings)

---

**Next Steps:** Proceed to detailed code analysis and consolidation implementation.
