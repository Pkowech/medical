# Controller → Frontend file mapping

This file lists backend controller roots (API routes) found in the repo and the main frontend files/components that call or proxy them. Use this as a quick reference to find where frontend code interacts with backend endpoints.

- Notes

- The frontend often proxies to the backend via Next.js app/api routes under `src/app/api/*`; those server routes in turn call the backend (BACKEND_URL).
- This is a focused mapping extracted from recent grep results (not an exhaustive deep cross-reference). Tell me if you want a full exhaustive list or CSV/JSON export.

Mappings

1. /api/learning-paths

- Frontend server routes:
  - src/app/api/learning-paths/route.ts
  - src/app/api/learning-paths/my-progress/route.ts
  - src/app/api/learning-paths/[id]/route.ts
  - src/app/api/learning-paths/[id]/enroll/route.ts
  - src/app/api/learning-paths/[id]/progress/route.ts
- Frontend components/pages that consume these:
  - src/components/learning-paths/LearningPathInterface.tsx
  - src/components/learning-paths/LearningPathVisualization.tsx
  - src/components/learning-paths/LearningPathAnalytics.tsx
  - src/components/learning-paths/LearningPathRecommendations.tsx
  - src/components/dashboard/LearningPathProgressWidget.tsx
  - src/app/(app)/learning-paths/page.tsx
  - src/app/(app)/learning-paths/[id]/page.tsx
  - src/services/consolidatedAnalyticsService.ts (calls /analytics/learning-paths/\*)

2. /api/chat

- Frontend server routes:
  - src/app/api/chat/sessions/route.ts
  - src/app/api/chat/sessions/[sessionId]/messages/route.ts
  - src/app/api/chat/message/route.ts
- Frontend pages/components:
  - src/app/(app)/chat/page.tsx
  - src/components/auth/sessionManager.tsx (session handling)

3. /api/courses

- Frontend server routes and related:
  - src/app/api/courses/route.ts
  - src/app/api/courses/[courseId]/enroll/route.ts
  - src/app/api/courses/[courseId]/prerequisites/route.ts
  - src/app/api/courses/featured/route.ts
  - src/app/api/courses/my-courses/route.ts
- Frontend consumers:
  - src/components/course/CourseDiscovery.tsx
  - src/app/(app)/courses/page.tsx
  - src/app/(app)/courses/[courseId]/page.tsx

4. /api/learning-goals

- Frontend server routes:
  - src/app/api/learning-goals/route.ts
  - src/app/api/learning-goals/[id]/progress/route.ts
  - src/app/api/learning-goals/analytics/route.ts
  - src/app/api/learning-goals/smart-suggestions/route.ts
- Frontend consumers:
  - src/components/learning-paths/\* (analytics and suggestions)
  - src/components/dashboard/\* (widgets may call analytics endpoints)

5. /api/clinical-cases

- Frontend server routes:
  - src/app/api/clinical-cases/route.ts
  - src/app/api/clinical-cases/[caseId]/route.ts
  - src/app/api/clinical-cases/attempts/route.ts
  - src/app/api/clinical-cases/attempts/[attemptId]/progress/route.ts
- Frontend consumers:
  - src/app/(app)/clinical-cases/page.tsx

6. Misc endpoints

- /api/health — src/app/api/health/route.ts
- /api/course-categories — src/app/api/course-categories/route.ts
- /api/courses/\* (see above)

Where the frontend proxies to the backend

- The Next.js server routes under `src/app/api/.../route.ts` fetch BACKEND_URL/\* and forward responses (example in `src/app/api/learning-paths/route.ts`).

Next steps (pick one)

- I can produce a CSV or JSON export of this mapping.
- I can expand this into an exhaustive list of every frontend file that references each endpoint.
- I can add TODO annotations in the frontend server route files linking to the backend controller source.

If you'd like any of those, tell me which and I'll apply the change.
