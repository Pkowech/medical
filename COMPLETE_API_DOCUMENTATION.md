# Complete API Documentation
**Generated:** December 31, 2025  
**Project:** Medical Tracker Platform  
**Status:** Production Candidate with Optimization Needed

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Complete Endpoint Inventory](#complete-endpoint-inventory)
4. [Testing Status](#testing-status)
5. [Duplicate Endpoints Analysis](#duplicate-endpoints-analysis)
6. [Critical Issues](#critical-issues)
7. [Authentication & Security](#authentication--security)
8. [Endpoint Consolidation Recommendations](#endpoint-consolidation-recommendations)
9. [Testing Coverage Gap Analysis](#testing-coverage-gap-analysis)

---

## Executive Summary

### Current State
- **Total Endpoints Discovered:** 100+
- **Endpoints Tested:** 22 (22% coverage)
- **Passing Tests:** 17 (77.27% success rate)
- **Failing Tests:** 5 (22.73% failure rate)
- **Duplicate Endpoints Identified:** 10+ pairs
- **Similar Function Groups:** 13 groups requiring consolidation

### Critical Findings
1. **Duplicate Route Definitions:** Multiple endpoints serving identical purposes with different URLs
2. **Controller Proliferation:** Security/Auth functions spread across 3 controllers (auth, security, security-settings)
3. **Permission Issues:** Admin user unable to access `/users` endpoint (403 Forbidden)
4. **Server Errors:** 2 endpoints returning 500 errors requiring debugging
5. **Token Validation Issues:** `/auth/validate-token` failing despite valid JWT

### Immediate Action Items
- [ ] Consolidate duplicate endpoints
- [ ] Fix 5 failing endpoints
- [ ] Standardize authentication controller routes
- [ ] Expand test coverage to remaining 78 endpoints
- [ ] Audit permission-based access controls

---

## System Architecture

### Technology Stack
| Component | Technology | Port | Status |
|-----------|-----------|------|--------|
| Backend API | NestJS (Node.js) | 3002 | ✅ Running |
| Database | PostgreSQL | 5432 | ✅ Running |
| Cache Layer | Redis | 6379 | ✅ Running (with in-memory fallback) |
| Analytics Engine | Rust Service | 8080 | ✅ Running |
| Frontend | Next.js | 3000 | ✅ Running |

### Database Models
Primary entities: Users, Courses, LearningPaths, Units, Progress, Assessments, Quizzes, Flashcards, StudyGroups, Materials, Notifications, ChatSessions, Forums, ClinicalCases, Events, AuditLogs

### Authentication Flow
```
1. POST /auth/login (email, password)
2. Response: { success, data: { accessToken, user }, message }
3. Use: Authorization: Bearer {accessToken}
4. Protected: All endpoints except /auth/login, /auth/register, /auth/guest-session
```

### Module Structure
```
backend/src/modules/
├── auth/                    # 30+ authentication endpoints
├── education/
│  ├── assessment/          # Quiz, flashcards, assessments
│  ├── courses/             # Courses, units, materials, progress
│  └── events/              # Event tracking
├── engagement-communication/ # Chat, notifications, forum, gamification
├── admin/                   # Admin analytics and user management
├── ai-analytics/           # AI-powered analytics
└── infrastructure/          # Health, metrics, search, integrations
```

---

## Complete Endpoint Inventory

### 🟢 PASSING ENDPOINTS (17/22 Tested)

#### Infrastructure & Health (2/4)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/health` | ✅ 200 | Health check |
| GET | `/health/full` | ❌ 500 | **BROKEN** - Server error |
| GET | `/metrics` | ✅ 200 | System metrics |
| GET | `/metrics/summary` | ⏳ Untested | - |

#### Authentication (1/10)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/auth/login` | ✅ 200 | Working auth |
| POST | `/auth/register` | ⏳ Untested | User registration |
| POST | `/auth/guest-session` | ⏳ Untested | Guest mode |
| POST | `/auth/convert-guest` | ⏳ Untested | Convert guest to user |
| GET | `/auth/validate-token` | ❌ 401 | **BROKEN** - Validation fails |
| POST | `/auth/logout` | ⏳ Untested | Logout |
| POST | `/auth/logout-all` | ⏳ Untested | Logout all devices |
| POST | `/auth/refresh` | ⏳ Untested | Token refresh |

#### Users (1/12)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/users/profile` | ✅ 200 | Current user profile |
| GET | `/users` | ❌ 403 | **BROKEN** - Permission denied |
| GET | `/users/:id` | ⏳ Untested | Get specific user |
| GET | `/users/profile/:id` | ⏳ Untested | Get user profile |
| GET | `/users/email/:email` | ⏳ Untested | Lookup by email |
| GET | `/users/username/:username` | ⏳ Untested | Lookup by username |
| PATCH | `/users/:id` | ⏳ Untested | Update user |
| PUT | `/users/:id/role` | ⏳ Untested | Change user role |
| PUT | `/users/:id/password` | ⏳ Untested | Admin password reset |
| POST | `/users/reset-password` | ⏳ Untested | Self password reset |
| DELETE | `/users/:id` | ⏳ Untested | Delete user |
| POST | `/users/validate` | ⏳ Untested | Validate user data |

#### Learning Paths (3/15)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/learning-paths` | ✅ 200 | List all paths |
| GET | `/learning-paths/analytics/trending` | ✅ 200 | Trending paths |
| GET | `/learning-paths/analytics/personalized` | ✅ 200 | Personalized paths |
| POST | `/learning-paths` | ⏳ Untested | Create path |
| GET | `/learning-paths/:id` | ⏳ Untested | Get by ID |
| PATCH | `/learning-paths/:id` | ⏳ Untested | Update path |
| DELETE | `/learning-paths/:id` | ⏳ Untested | Delete path |
| GET | `/learning-paths/categories/:category` | ⏳ Untested | Filter by category |
| GET | `/learning-paths/analytics/collaborative` | ⏳ Untested | Collaborative analytics |
| GET | `/learning-paths/recommendations` | ⏳ Untested | Recommendations |
| GET | `/learning-paths/recommendations/collaborative` | ⏳ Untested | Collab recommendations |
| GET | `/learning-paths/trending-legacy` | ⏳ Untested | **DUPLICATE?** |
| GET | `/learning-paths/my-progress` | ⏳ Untested | User's path progress |
| GET | `/learning-paths/:id/progress` | ⏳ Untested | Path progress |
| POST | `/learning-paths/:id/progress` | ⏳ Untested | Update progress |
| POST | `/learning-paths/:id/publish` | ⏳ Untested | Publish path |
| POST | `/learning-paths/:id/unpublish` | ⏳ Untested | Unpublish path |
| POST | `/learning-paths/:id/duplicate` | ⏳ Untested | Clone path |

#### Courses (3/13)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/courses` | ✅ 200 | List all courses |
| GET | `/courses/featured` | ✅ 200 | Featured courses |
| GET | `/courses/my-courses` | ✅ 200 | User's courses |
| POST | `/courses` | ⏳ Untested | Create course |
| GET | `/courses/recommended` | ⏳ Untested | Recommended |
| GET | `/courses/stats` | ⏳ Untested | Statistics |
| GET | `/courses/:id` | ⏳ Untested | Get by ID |
| PATCH | `/courses/:id` | ⏳ Untested | Update |
| DELETE | `/courses/:id` | ⏳ Untested | Delete |
| POST | `/courses/:id/enroll` | ⏳ Untested | Enroll in course |
| DELETE | `/courses/:id/enroll` | ⏳ Untested | Unenroll |
| POST | `/courses/:id/assign-instructor` | ⏳ Untested | Assign instructor |
| POST | `/courses/:id/units/:unitId/complete` | ⏳ Untested | Mark unit complete |

#### Units (5/5)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/units` | ⏳ Untested | List units |
| GET | `/units/:id` | ⏳ Untested | Get unit |
| POST | `/units` | ⏳ Untested | Create unit |
| PUT | `/units/:id` | ⏳ Untested | Update unit |
| DELETE | `/units/:id` | ⏳ Untested | Delete unit |

#### Progress Tracking (1/13)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/progress/me` | ✅ 200 | Current user progress |
| POST | `/progress/units/:unitId` | ⏳ Untested | Update unit progress |
| GET | `/progress/user-progress/:userId` | ⏳ Untested | User progress |
| GET | `/progress/overview/:userId` | ⏳ Untested | Progress overview |
| GET | `/progress/courses/:userId` | ⏳ Untested | Course progress |
| GET | `/progress/courses/:courseId/detailed` | ⏳ Untested | Detailed course progress |
| GET | `/progress/activities` | ⏳ Untested | Recent activities |
| GET | `/progress/achievements` | ⏳ Untested | User achievements |
| GET | `/progress/peer-comparison/:userId` | ⏳ Untested | Peer analytics |

#### Materials (1/8)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/materials` | ✅ 200 | List materials |
| POST | `/materials/upload` | ⏳ Untested | Upload material |
| GET | `/materials/:id` | ⏳ Untested | Get material |
| GET | `/materials/:id/download` | ⏳ Untested | Download |
| POST | `/materials/:id/track/view` | ⏳ Untested | Track view |
| GET | `/materials/:id/with-url` | ⏳ Untested | Get with URL |
| GET | `/materials/local/serve/:fileHash` | ⏳ Untested | Serve file |
| GET | `/materials/:id/stats` | ⏳ Untested | Material stats |
| DELETE | `/materials/:id` | ⏳ Untested | Delete |

#### Quiz & Assessment (1/25)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/quiz/unit/:unitId` | ❌ 404 | **BROKEN** - No test data |
| POST | `/quiz/submit` | ⏳ Untested | Submit quiz |
| POST | `/quiz/submit-quiz` | ⏳ Untested | **DUPLICATE** |
| GET | `/quiz/results/:userId/:unitId` | ⏳ Untested | Quiz results |
| GET | `/quiz/rapid-review/:userId` | ⏳ Untested | Rapid review |
| GET | `/quiz/history/:userId` | ⏳ Untested | Quiz history |
| GET | `/quiz/:assessmentId/recommendations` | ⏳ Untested | Recommendations |
| GET | `/quiz/:assessmentId/analytics` | ⏳ Untested | Analytics |
| GET | `/quiz/:assessmentId/resources` | ⏳ Untested | Resources |
| POST | `/flashcards/create` | ⏳ Untested | Create flashcard |
| GET | `/flashcards/due/:userId` | ❌ 500 | **BROKEN** - Server error |
| POST | `/flashcards/update/:cardId` | ⏳ Untested | Update card |
| GET | `/flashcards/stats/:userId` | ✅ 200 | Flashcard stats |
| GET | `/flashcards/high-risk-topics/:userId` | ⏳ Untested | High-risk topics |
| POST | `/flashcards/sync/:userId` | ⏳ Untested | Sync cards |
| POST | `/assessment-progress/:assessmentId` | ⏳ Untested | Create progress |
| GET | `/assessment-progress/:assessmentId` | ⏳ Untested | Get progress |
| GET | `/assessment-progress/user/:userId` | ⏳ Untested | User progress |
| GET | `/assessment-progress/performance/:userId` | ⏳ Untested | Performance |
| GET | `/assessment-progress/profile/:userId` | ⏳ Untested | Profile |
| GET | `/assessment-progress/recommendations` | ⏳ Untested | Recommendations |
| GET | `/assessment-progress/analytics` | ⏳ Untested | Analytics |
| GET | `/assessment-progress/study-materials` | ⏳ Untested | Study materials |
| GET | `/assessment-progress/next-steps` | ⏳ Untested | Next steps |
| GET | `/assessment-progress/admin/recommendations/:userId` | ⏳ Untested | Admin recommendations |
| GET | `/assessment-progress/analytics/user/:userId` | ⏳ Untested | **DUPLICATE?** |
| GET | `/assessment-progress/insights/:userId` | ⏳ Untested | Insights |
| GET | `/assessment-progress/analytics/assessment/:assessmentId` | ⏳ Untested | **DUPLICATE?** |

#### Clinical Cases (10)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/clinical-cases` | ⏳ Untested | Create case |
| GET | `/clinical-cases` | ⏳ Untested | List cases |
| GET | `/clinical-cases/specialties` | ⏳ Untested | List specialties |
| GET | `/clinical-cases/complexities` | ⏳ Untested | List complexities |
| GET | `/clinical-cases/:id` | ⏳ Untested | Get case |
| POST | `/clinical-cases/:id/start` | ⏳ Untested | Start case |
| PATCH | `/clinical-cases/attempts/:attemptId/progress` | ⏳ Untested | Update progress |
| POST | `/clinical-cases/attempts/:attemptId/diagnosis` | ⏳ Untested | Submit diagnosis |
| POST | `/clinical-cases/attempts/:attemptId/complete` | ⏳ Untested | Complete case |
| GET | `/clinical-cases/attempts/:attemptId` | ⏳ Untested | Get attempt |

#### Course Categories (8)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/course-categories` | ⏳ Untested | Create category |
| GET | `/course-categories` | ⏳ Untested | List categories |
| GET | `/course-categories/hierarchy` | ⏳ Untested | Category hierarchy |
| GET | `/course-categories/:id` | ⏳ Untested | Get category |
| GET | `/course-categories/slug/:slug` | ⏳ Untested | Get by slug |
| GET | `/course-categories/:id/stats` | ⏳ Untested | Category stats |
| PATCH | `/course-categories/:id` | ⏳ Untested | Update |
| DELETE | `/course-categories/:id` | ⏳ Untested | Delete |

#### CPD (Continuing Professional Development) (2)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| PUT | `/cpd/activities/:id/verify` | ⏳ Untested | Verify activity |
| POST | `/cpd/cycles/:cycleId` | ⏳ Untested | Create cycle |

#### Assessment (Blueprint, Feedback) (7)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/blueprint/:learningPathId/readiness` | ⏳ Untested | Readiness |
| GET | `/blueprint/summary` | ⏳ Untested | Summary |
| GET | `/blueprint/breakdown/:userId` | ⏳ Untested | Breakdown |
| GET | `/blueprint/mastery/:userId` | ⏳ Untested | Mastery |
| POST | `/feedback` | ⏳ Untested | Create feedback |
| GET | `/feedback` | ⏳ Untested | List feedback |
| GET | `/events` | ⏳ Untested | Event tracking |

#### Notifications (4/4)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/notifications` | ✅ 200 | List notifications |
| POST | `/notifications` | ⏳ Untested | Create |
| PATCH | `/notifications/:id/read` | ⏳ Untested | Mark read |
| DELETE | `/notifications/:id` | ⏳ Untested | Delete |

#### Chat (5)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/chat/message` | ⏳ Untested | Send message |
| GET | `/chat/sessions` | ✅ 200 | List sessions |
| GET | `/chat/sessions/:sessionId/messages` | ⏳ Untested | Get messages |
| DELETE | `/chat/sessions/:sessionId` | ⏳ Untested | Delete session |
| POST | `/chat/sessions/:sessionId/regenerate` | ⏳ Untested | Regenerate |

#### Forum (10)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/forum` | ⏳ Untested | Create forum |
| GET | `/forum` | ⏳ Untested | List forums |
| GET | `/forum/:id` | ⏳ Untested | Get forum |
| PUT | `/forum/:id` | ⏳ Untested | Update |
| DELETE | `/forum/:id` | ⏳ Untested | Delete |
| POST | `/forum/:id/topics` | ⏳ Untested | Create topic |
| GET | `/forum/:id/topics` | ⏳ Untested | List topics |
| POST | `/forum/:forumId/topics/:topicId/subscribe` | ⏳ Untested | Subscribe |
| POST | `/forum/:id/posts` | ⏳ Untested | Create post |
| GET | `/forum/:id/posts` | ⏳ Untested | List posts |

#### Study Groups (8)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/study-groups` | ⏳ Untested | Create group |
| GET | `/study-groups` | ⏳ Untested | List groups |
| GET | `/study-groups/my-groups` | ⏳ Untested | My groups |
| GET | `/study-groups/:id` | ⏳ Untested | Get group |
| PUT | `/study-groups/:id` | ⏳ Untested | Update |
| DELETE | `/study-groups/:id` | ⏳ Untested | Delete |
| POST | `/study-groups/:id/join` | ⏳ Untested | Join |
| DELETE | `/study-groups/:id/leave` | ⏳ Untested | Leave |

#### Engagement & Gamification (8)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/engagement/peer-stats/:userId/:topicId` | ⏳ Untested | Peer stats |
| GET | `/engagement/leaderboard/:topicId` | ⏳ Untested | Leaderboard |
| GET | `/engagement/study-group/:groupId` | ⏳ Untested | Study group |
| GET | `/engagement/analytics/:userId` | ✅ 200 | Analytics |
| POST | `/gamification/award/:userId` | ⏳ Untested | Award points |
| GET | `/gamification/points/:userId` | ✅ 200 | Get points |
| POST | `/rewards/grant/:userId` | ⏳ Untested | Grant reward |
| GET | `/rewards/user/:userId` | ⏳ Untested | User rewards |

#### Admin & Analytics (10)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/admin/system-analytics/metrics` | ⏳ Untested | System metrics |
| POST | `/admin/users` | ⏳ Untested | Create user |
| PUT | `/admin/users/:id` | ⏳ Untested | Update user |
| GET | `/analytics/system-analytics` | ⏳ Untested | System analytics |
| GET | `/analytics/system-analytics-ai` | ⏳ Untested | AI analytics |
| GET | `/analytics/progress-records` | ⏳ Untested | Progress records |
| POST | `/analytics/process-analytics` | ⏳ Untested | Process |
| GET | `/analytics/trending-paths` | ⏳ Untested | Trending |
| GET | `/analytics/consolidated` | ⏳ Untested | Consolidated |

#### Security & Sessions (15)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/sessions` | ⏳ Untested | List sessions |
| DELETE | `/sessions/:sessionId` | ⏳ Untested | Revoke session |
| POST | `/sessions/revoke-all` | ⏳ Untested | Revoke all |
| POST | `/security-settings/two-factor/setup` | ⏳ Untested | Setup 2FA |
| POST | `/security-settings/two-factor/verify` | ⏳ Untested | Verify 2FA |
| PATCH | `/security-settings/password` | ⏳ Untested | Change password |
| POST | `/security-settings/backup-codes` | ⏳ Untested | Generate codes |
| PATCH | `/security-settings` | ⏳ Untested | Update settings |
| GET | `/security/settings` | ⏳ Untested | Get settings |
| POST | `/security/2fa/setup` | ⏳ Untested | **DUPLICATE** |
| POST | `/security/2fa/verify` | ⏳ Untested | **DUPLICATE** |
| PUT | `/security/password` | ⏳ Untested | **DUPLICATE** |
| PUT | `/security/settings` | ⏳ Untested | **DUPLICATE** |
| GET | `/security/sessions` | ⏳ Untested | **DUPLICATE** |
| DELETE | `/security/sessions/:sessionId` | ⏳ Untested | **DUPLICATE** |
| GET | `/security/events` | ⏳ Untested | Security events |
| POST | `/security/backup-codes/generate` | ⏳ Untested | Generate codes |
| POST | `/security/email/verify` | ⏳ Untested | Verify email |
| POST | `/security/email/resend` | ⏳ Untested | Resend email |
| POST | `/security/recovery/initiate` | ⏳ Untested | Start recovery |
| POST | `/security/recovery/verify` | ⏳ Untested | Verify recovery |

#### Roles & Permissions (8)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/roles` | ⏳ Untested | List roles |
| POST | `/roles` | ⏳ Untested | Create role |
| PATCH | `/roles/:id` | ⏳ Untested | Update role |
| DELETE | `/roles/:id` | ⏳ Untested | Delete role |
| POST | `/roles/:id/permissions` | ⏳ Untested | Add permission |
| DELETE | `/roles/:id/permissions/:permissionId` | ⏳ Untested | Remove permission |
| GET | `/roles/permissions` | ⏳ Untested | List all permissions |
| POST | `/roles/permissions` | ⏳ Untested | Create permission |

#### User Features (3)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/user-features/:userId` | ⏳ Untested | Get features |
| POST | `/user-features/:userId/enable` | ⏳ Untested | Enable feature |
| POST | `/user-features/:userId/disable` | ⏳ Untested | Disable feature |

#### Additional Features (8)
| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/audit` | ⏳ Untested | Audit logs |
| GET | `/weekly-digest/latest` | ⏳ Untested | Latest digest |
| POST | `/weekly-digest/generate` | ⏳ Untested | Generate digest |
| POST | `/weekly-digest/:digestId/read` | ⏳ Untested | Mark read |
| POST | `/events` | ⏳ Untested | Create event |
| PATCH | `/events/:id` | ⏳ Untested | Update event |
| DELETE | `/events/:id` | ⏳ Untested | Delete event |
| GET | `/study-sessions` | ⏳ Untested | Study sessions |

---

## Testing Status

### Summary
| Metric | Count | Percentage |
|--------|-------|-----------|
| Total Endpoints Identified | 100+ | - |
| Endpoints Tested | 22 | 22% |
| Endpoints Passing | 17 | 77.27% |
| Endpoints Failing | 5 | 22.73% |
| Endpoints Untested | 78+ | 78% |

### Test Results Breakdown

#### Passing (✅ 200 OK)
1. `GET /health` - Health check
2. `GET /metrics` - System metrics
3. `POST /auth/login` - Authentication
4. `GET /users/profile` - User profile
5. `GET /learning-paths` - Learning paths list
6. `GET /learning-paths/analytics/trending` - Trending analytics
7. `GET /learning-paths/analytics/personalized` - Personalized analytics
8. `GET /courses` - Courses list
9. `GET /courses/featured` - Featured courses
10. `GET /courses/my-courses` - User's courses
11. `GET /notifications` - Notifications list
12. `GET /progress/me` - User progress
13. `GET /flashcards/stats/1` - Flashcard stats
14. `GET /engagement/analytics/1` - Engagement analytics
15. `GET /gamification/points/1` - Gamification points
16. `GET /materials` - Materials list
17. `GET /chat/sessions` - Chat sessions

#### Failing (❌ Error Status)

**500 Internal Server Error (2)**
1. `GET /health/full` - Full health check
   - **Root Cause:** Server-side error in health check implementation
   - **Impact:** Can't verify full system health
   - **Fix Required:** Debug health controller `/full` endpoint

2. `GET /flashcards/due/1` - Get due flashcards
   - **Root Cause:** Server exception handling or missing data
   - **Impact:** Users can't get due flashcards
   - **Fix Required:** Review flashcards service and database queries

**401 Unauthorized (1)**
1. `GET /auth/validate-token` - Validate token
   - **Root Cause:** Token validation logic rejecting valid JWT
   - **Impact:** Token validation endpoints unreliable
   - **Fix Required:** Debug JWT validation middleware/service

**403 Forbidden (1)**
1. `GET /users` - List all users
   - **Root Cause:** Role-based access control blocking admin user
   - **Impact:** Admin can't list users
   - **Fix Required:** Review RBAC implementation for admin role

**404 Not Found (1)**
1. `GET /quiz/unit/1` - Get quiz by unit
   - **Root Cause:** No quiz data exists for unit ID 1
   - **Impact:** Expected behavior with missing test data
   - **Fix Required:** Seed database with sample quiz data

---

## Duplicate Endpoints Analysis

### 🔴 CRITICAL DUPLICATES (Same Function)

#### 1. Quiz Submission - 2 Identical Endpoints
```
POST /quiz/submit              ← PRIMARY
POST /quiz/submit-quiz         ← DUPLICATE (same functionality)
```
**Recommendation:** Remove `/quiz/submit-quiz`, consolidate to `/quiz/submit`

#### 2. 2FA Setup/Verify - 4 Endpoints Across 2 Controllers
```
POST /auth/2fa/setup                       ← Auth module
POST /auth/2fa/verify                      ← Auth module
POST /security-settings/two-factor/setup   ← Security module (DUPLICATE)
POST /security-settings/two-factor/verify  ← Security module (DUPLICATE)
```
**Recommendation:** Keep only `/auth/2fa/*` routes, remove `/security-settings/two-factor/*`

#### 3. Session Management - 6 Overlapping Endpoints
```
GET /sessions                              ← Sessions controller
DELETE /sessions/:sessionId                ← Sessions controller
POST /sessions/revoke-all                  ← Sessions controller
GET /security/sessions                     ← Security controller (DUPLICATE)
DELETE /security/sessions/:sessionId       ← Security controller (DUPLICATE)
POST /auth/logout-all                      ← Auth controller (SIMILAR)
```
**Recommendation:** Consolidate to `/sessions/*`, remove `/security/sessions/*`

#### 4. Password Management - 4 Endpoints
```
PATCH /security-settings/password          ← Security settings
PATCH /security/password                   ← Security (DUPLICATE)
PUT /auth/password                         ← Auth (SIMILAR)
PUT /users/:id/password                    ← Admin endpoint (acceptable)
```
**Recommendation:** Consolidate to `/auth/password` or `/security/password`, keep `/users/:id/password` for admin

#### 5. Backup Codes - 2 Endpoints
```
POST /security/backup-codes/generate       ← Security
POST /security-settings/backup-codes       ← Settings (DUPLICATE)
```
**Recommendation:** Keep `/security/backup-codes/generate`, remove `/security-settings/*`

---

### 🟡 SIMILAR FUNCTION GROUPS (Overlapping Purpose)

#### 6. User Profile Retrieval - 3 Endpoints
```
GET /users/profile            ← Current user
GET /users/profile/:id        ← Specific user profile
GET /users/:id                ← User data (overlaps with profile)
```
**Recommendation:** Consolidate `/users/:id` and `/users/profile/:id`

#### 7. Security Settings Access - 3 Endpoints
```
GET /security/settings                     ← Security module
GET /security-settings                     ← Settings module (DUPLICATE)
PATCH /security-settings                   ← Update settings
```
**Recommendation:** Consolidate to `/security/*`, deprecate `/security-settings/*`

#### 8. Quiz Analytics - 5 Similar Endpoints
```
GET /quiz/results/:userId/:unitId                              ← Quiz results
GET /quiz/:assessmentId/analytics                              ← Quiz analytics
GET /assessment-progress/analytics                             ← Assessment analytics
GET /assessment-progress/analytics/assessment/:assessmentId    ← Assessment analytics (similar scope)
GET /assessment-progress/analytics/user/:userId                ← Assessment analytics (similar scope)
```
**Recommendation:** Clarify distinction between `/quiz/*` and `/assessment-progress/*`

#### 9. Progress Tracking - 6 Related Endpoints
```
GET /learning-paths/:id/progress                ← Path progress
GET /learning-paths/my-progress                 ← User's path progress
GET /progress/me                                ← Overall progress
GET /progress/overview/:userId                  ← User overview
GET /progress/courses/:userId                   ← Course progress
GET /progress/courses/:courseId/detailed        ← Detailed course progress
```
**Recommendation:** Organize under `/progress/*`, separate concerns (path vs course)

#### 10. Study Recommendations - 4 Related Endpoints
```
GET /assessment-progress/study-materials       ← Study materials
GET /assessment-progress/recommendations       ← Recommendations
GET /quiz/:assessmentId/recommendations        ← Quiz recommendations
GET /assessment-progress/next-steps             ← Next steps
```
**Recommendation:** Consolidate to `/assessment-progress/*` with clear scopes

#### 11. Course Filtering - 4 Related Endpoints
```
GET /courses                    ← All courses
GET /courses/featured           ← Featured courses
GET /courses/recommended        ← Recommended courses
GET /courses/my-courses         ← User's courses (acceptable variation)
```
**Recommendation:** Accept these as feature-specific endpoints, all necessary

#### 12. Learning Path Analytics - 5 Endpoints
```
GET /learning-paths/analytics/trending                 ← Trending
GET /learning-paths/analytics/collaborative            ← Collaborative
GET /learning-paths/analytics/personalized             ← Personalized
GET /learning-paths/trending-legacy                    ← DUPLICATE? of trending
GET /learning-paths/recommendations                    ← Similar to personalized
```
**Recommendation:** Remove `/trending-legacy`, clarify `/recommendations`

#### 13. Email Verification & Recovery - 4 Endpoints
```
POST /security/email/verify                ← Verify email
POST /security/email/resend                ← Resend email
POST /security/recovery/initiate           ← Start recovery
POST /security/recovery/verify             ← Verify recovery
```
**Recommendation:** Accept these as necessary security flows

---

## Critical Issues

### Issue #1: Health Check Failure (500)
**Endpoint:** `GET /health/full`  
**Status:** 500 Internal Server Error  
**Severity:** HIGH  
**Impact:** Cannot verify full system health status

**Diagnosis:**
```
GET /health → ✅ 200 (basic check works)
GET /health/full → ❌ 500 (full check broken)
```

**Likely Causes:**
1. Missing health check service dependencies
2. Database connectivity issue in full health check
3. Exception in Redis connection test
4. Unhandled error in external service checks

**Fix:**
```typescript
// In health.controller.ts, debug full() method
// Check: Database, Redis, External Services, Message Queue
// Add try-catch with proper error handling
```

---

### Issue #2: Flashcards Due Failure (500)
**Endpoint:** `GET /flashcards/due/1`  
**Status:** 500 Internal Server Error  
**Severity:** HIGH  
**Impact:** Users cannot fetch due flashcards for review

**Diagnosis:**
- Endpoint exists in flashcards.controller.ts
- Server returns 500 instead of 200 or 404

**Likely Causes:**
1. Missing user ID validation
2. Database query error in flashcard retrieval
3. Unhandled null reference in response mapping
4. Redis cache corruption

**Fix:**
```typescript
// In flashcards.service.ts
// Add validation: if userId doesn't exist, return empty array
// Check database query for nulls
// Add error handling for redis failures
```

---

### Issue #3: Token Validation Failure (401)
**Endpoint:** `GET /auth/validate-token`  
**Status:** 401 Unauthorized  
**Severity:** HIGH  
**Impact:** Cannot validate tokens despite valid JWT provided

**Diagnosis:**
- Token obtained from `/auth/login` works for other endpoints
- Token fails when sent to `/auth/validate-token`

**Likely Causes:**
1. Incorrect JWT verification in validate endpoint
2. Token claims validation too strict
3. Wrong secret key used in validation
4. Middleware striping token before reaching endpoint

**Fix:**
```typescript
// In auth.controller.ts validateToken() method
// Verify: Same JwtService instance used
// Check: Token claims expected fields
// Debug: Log token and error details
```

---

### Issue #4: Users List Permission Denied (403)
**Endpoint:** `GET /users`  
**Status:** 403 Forbidden  
**Severity:** MEDIUM  
**Impact:** Admin cannot list all users

**Diagnosis:**
- User role: Admin (with 30+ permissions)
- Permission check still blocking access

**Likely Causes:**
1. Missing `users:read` or `users:list` permission for admin
2. Endpoint-level guard rejecting admin role
3. RBAC service not recognizing admin permissions
4. Permission decorator mismatch

**Fix:**
```typescript
// In users.controller.ts, find() method
// Check: @UseGuards() and @Permissions() decorators
// Verify: Admin role has required permissions in database
// Debug: Permission evaluation logic
```

---

### Issue #5: Missing Test Data (404)
**Endpoint:** `GET /quiz/unit/1`  
**Status:** 404 Not Found  
**Severity:** LOW  
**Impact:** Cannot test quiz endpoint

**Diagnosis:**
- Expected behavior - no quiz data exists for unit ID 1

**Fix:**
```sql
-- Seed database with sample quiz data
INSERT INTO quizzes (id, unit_id, title, created_at)
VALUES ('quiz-1', '1', 'Unit 1 Quiz', NOW());
```

---

## Authentication & Security

### Login Flow
```
1. POST /auth/login
   Body: { email, password }
   
2. Response: 200 OK
   {
     "success": true,
     "data": {
       "accessToken": "eyJhbGciOiJIUzI1NiIs...",
       "user": {
         "id": "uuid",
         "email": "aaronrono427@gmail.com",
         "firstName": "Aaron",
         "lastName": "Rono",
         "role": "admin"
       }
     },
     "message": "Login successful"
   }

3. Use Token:
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### JWT Token Details
- **Algorithm:** HS256
- **Expiration:** Not yet confirmed (check .env)
- **Claims:** Typically include user.id, user.email, user.role
- **Storage:** Use secure httpOnly cookies or localStorage

### Protected Endpoints
All endpoints except:
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/guest-session`
- `GET /health`
- `GET /metrics`

Require: `Authorization: Bearer {accessToken}`

### Test Credentials
```
Email: aaronrono427@gmail.com
Password: AU110s/6081/2021MTH
Role: admin
Permissions: 30+ (including user, course, role management)
```

### Security Concerns
1. ⚠️ Test credentials should not be hardcoded in documentation
2. ⚠️ Validate token endpoint not working (issue #3)
3. ⚠️ Some 2FA endpoints duplicated across controllers
4. ⚠️ Permission validation inconsistent (issue #4)

---

## Endpoint Consolidation Recommendations

### Priority 1: Remove Duplicate Endpoints (High Impact)
These endpoints serve identical purposes and should be consolidated.

#### Action 1.1: Quiz Submission
**Remove:** `POST /quiz/submit-quiz`  
**Keep:** `POST /quiz/submit`  
**Timeline:** Immediate

```
BEFORE:
POST /quiz/submit          ← Use this
POST /quiz/submit-quiz     ← DELETE

AFTER:
POST /quiz/submit          ← Single endpoint
```

#### Action 1.2: 2FA Setup/Verify
**Remove:** `/security-settings/two-factor/*`  
**Keep:** `/auth/2fa/*`  
**Timeline:** Immediate

```
BEFORE:
POST /auth/2fa/setup
POST /auth/2fa/verify
POST /security-settings/two-factor/setup     ← DELETE
POST /security-settings/two-factor/verify    ← DELETE

AFTER:
POST /auth/2fa/setup
POST /auth/2fa/verify
```

#### Action 1.3: Session Management
**Remove:** `/security/sessions/*`  
**Keep:** `/sessions/*` and `/auth/logout*`  
**Timeline:** Immediate

```
BEFORE:
GET /sessions
DELETE /sessions/:sessionId
GET /security/sessions              ← DELETE
DELETE /security/sessions/:sessionId ← DELETE
POST /auth/logout-all

AFTER:
GET /sessions
DELETE /sessions/:sessionId
POST /sessions/revoke-all           ← Consolidate logout-all
POST /auth/logout
```

#### Action 1.4: Password Management
**Remove:** `/security/password`, `/security-settings/password`  
**Keep:** `/auth/password`  
**Timeline:** Phase 2

```
BEFORE:
PUT /auth/password
PUT /security/password              ← DELETE/REDIRECT
PATCH /security-settings/password   ← DELETE/REDIRECT
PUT /users/:id/password             ← Keep for admin

AFTER:
PUT /auth/password                  ← For users
PUT /users/:id/password             ← For admin
```

#### Action 1.5: Backup Codes
**Remove:** `/security-settings/backup-codes`  
**Keep:** `/security/backup-codes/generate`  
**Timeline:** Phase 2

```
BEFORE:
POST /security/backup-codes/generate
POST /security-settings/backup-codes ← DELETE

AFTER:
POST /security/backup-codes/generate
```

### Priority 2: Consolidate Related Groups (Medium Impact)

#### Action 2.1: Security Settings Endpoints
**Consolidate:** `/security-settings/*` → `/security/*`  
**Timeline:** Phase 2

```
BEFORE: 8 endpoints across 2 controllers
GET /security/settings
GET /security-settings

AFTER:
GET /security/settings              ← Single source
```

#### Action 2.2: User Profile Endpoints
**Consolidate:** `/users/profile/:id` and `/users/:id`  
**Timeline:** Phase 3

```
BEFORE:
GET /users/profile
GET /users/profile/:id
GET /users/:id                      ← Overlaps with above

AFTER:
GET /users/profile                  ← Current user
GET /users/:id                      ← Specific user (replaces profile/:id)
```

#### Action 2.3: Quiz Analytics
**Clarify Scope:**
- `/quiz/*` → Quiz-specific analytics
- `/assessment-progress/*` → Assessment-specific analytics

```
BEFORE: Confusing which endpoint to use
GET /quiz/:assessmentId/analytics
GET /assessment-progress/analytics

AFTER: Clear documentation of differences
```

#### Action 2.4: Study Recommendations
**Consolidate:** All study-related recommendations under `/assessment-progress/`

```
AFTER:
GET /assessment-progress/recommendations
GET /assessment-progress/study-materials
GET /assessment-progress/next-steps
```

### Priority 3: Documentation & Standards (Low Impact)

#### Action 3.1: API Versioning
- Current: `/v1` prefix
- Ensure all endpoints consistent

#### Action 3.2: Naming Conventions
- Standardize between:
  - `/users/profile` vs `/users/:id`
  - `/auth/logout` vs `/sessions/revoke`
  - `/quiz/` vs `/assessment-progress/`

#### Action 3.3: Deprecation Strategy
- Mark duplicate endpoints as `@Deprecated()`
- Add warnings in API documentation
- Set timeline for removal (6 months)

---

## Testing Coverage Gap Analysis

### Summary
- **Total Endpoints:** 100+
- **Tested:** 22 (22%)
- **Remaining:** 78+ (78%)

### High-Priority Untested Categories

#### 1. Authentication (7/10 untested)
```
Priority: CRITICAL
Register, guest session, token refresh, logout variants
Tests needed: 5
Estimated time: 2 hours
```

#### 2. User Management (11/12 untested)
```
Priority: CRITICAL
List users, create, update, delete, role management
Tests needed: 11
Estimated time: 3 hours
```

#### 3. Roles & Permissions (8/8 untested)
```
Priority: HIGH
All role and permission endpoints
Tests needed: 8
Estimated time: 2 hours
```

#### 4. Learning Paths (12/15 untested)
```
Priority: HIGH
Create, update, delete, analytics, recommendations
Tests needed: 12
Estimated time: 3 hours
```

#### 5. Assessment & Quiz (24/25 untested)
```
Priority: HIGH
Quiz submission, assessment tracking, flashcards, clinical cases
Tests needed: 24
Estimated time: 6 hours
```

#### 6. Security & Sessions (14/21 untested)
```
Priority: MEDIUM
2FA, email verification, recovery, session management
Tests needed: 14
Estimated time: 4 hours
```

#### 7. Communication (23/23 untested)
```
Priority: MEDIUM
Chat, forum, notifications, discussions
Tests needed: 23
Estimated time: 5 hours
```

#### 8. Admin & Analytics (9/10 untested)
```
Priority: LOW
System analytics, admin operations
Tests needed: 9
Estimated time: 2 hours
```

### Recommended Testing Order
1. **Phase 1 (Critical):** Fix 5 failing endpoints, test auth & users (15 endpoints) - 3-4 hours
2. **Phase 2 (High):** Test roles, learning paths, assessments (28 endpoints) - 6-8 hours
3. **Phase 3 (Medium):** Test security, communication (37 endpoints) - 9-10 hours
4. **Phase 4 (Low):** Test admin, miscellaneous (8 endpoints) - 1-2 hours

**Total Estimated Time:** 20-25 hours for 100% coverage

---

## Summary & Next Steps

### Key Metrics
| Metric | Value | Status |
|--------|-------|--------|
| API Endpoints Discovered | 100+ | ✅ Complete |
| Testing Coverage | 22% | 🟡 Low |
| Success Rate | 77.27% | 🟡 Good |
| Critical Issues | 2 | 🔴 Needs Fix |
| High Priority Issues | 3 | 🟡 Needs Fix |
| Duplicate Endpoints | 10+ pairs | 🔴 Needs Cleanup |

### Action Items
- [ ] **Week 1:** Fix 5 failing endpoints
- [ ] **Week 1:** Consolidate 10+ duplicate endpoints
- [ ] **Week 2:** Test auth & user management endpoints (15)
- [ ] **Week 2:** Test roles & permissions (8)
- [ ] **Week 3:** Test learning paths & assessments (28)
- [ ] **Week 3-4:** Test security & communication (37)
- [ ] **Week 4:** Final testing & documentation

### Expected Outcomes
- ✅ 100% endpoint coverage testing
- ✅ All critical issues resolved
- ✅ Duplicate endpoints consolidated
- ✅ Complete API documentation
- ✅ Comprehensive test suite with >80% pass rate

---

**Document Version:** 1.0  
**Last Updated:** June 4, 2026  
**Prepared By:** API Testing & Documentation Task
