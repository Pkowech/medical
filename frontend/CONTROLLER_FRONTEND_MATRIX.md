Backend controller → Frontend proxy & call-site matrix

Purpose

- Quick reference mapping backend controller roots to frontend server proxies (Next.js app/api) and the main frontend call sites that consume those proxies.
- Use this to identify missing frontend implementations, canonicalization targets, and a migration backlog.

Legend

- Controller: backend controller filename (controller root inferred from name)
- Proxy: frontend Next.js API route(s) under `src/app/api/.../route.ts` that forward to BACKEND_URL
- Call sites: frontend files that call `/api/...` or directly use BACKEND_URL env variables
- Status: short assessment (Proxy exists, Consumers exist, Needs UI, Needs proxy)

Matrix (selected controllers)

- auth.controller.ts (auth)
  - Proxy: src/app/api/auth/[...nextauth]/route.ts, src/app/api/auth/session/route.ts, src/app/api/auth/register/route.ts, src/app/api/auth/email/resend/route.ts, src/app/api/auth/verify-email/[token]/route.ts
  - Call sites: src/lib/nextauth.ts (CredentialsProvider -> /api/auth/login), src/app/(auth)/verify-email/page.tsx (calls /api/auth/email/resend), src/app/(auth)/resend-verification/page.tsx
  - Status: Proxy exists, Consumers exist

- users.controller.ts (users)
  - Proxy: none specific; user endpoints commonly proxied via /api/users (check src/app/api/users if present)
  - Call sites: many UI components refer to `/api/users` or `/api/users/profile` (src/lib/apiPaths lists PROFILE)
  - Status: Consumers exist; confirm proxy file presence (may be covered by auth/session or general /api endpoints)

- materials.controller.ts (materials)
  - Proxy: src/app/api/materials/route.ts
  - Call sites: src/app/upload.tsx (now uses API_PATHS.MATERIALS.UPLOAD), src/components/ShareMaterial.tsx (fetch('/api/materials/share'))
  - Status: Proxy exists, Consumers exist

- units.controller.ts (units)
  - Proxy: none explicit in scan results (verify src/app/api/units)
  - Call sites: frontend references to unit endpoints via quiz/unit and other services (tests reference /quiz/unit/:id)
  - Status: Needs verification whether a proxy exists; UI consumers present

- courses.controller.ts (courses)
  - Proxy: src/app/api/courses/route.ts, src/app/api/courses/[courseId]/enroll/route.ts, src/app/api/courses/[courseId]/prerequisites/route.ts, src/app/api/courses/featured/route.ts, src/app/api/courses/my-courses/route.ts
  - Call sites: src/app/(app)/courses/page.tsx, src/components/course/CourseDiscovery.tsx, src/app/(app)/courses/[courseId]/page.tsx
  - Status: Proxy exists, Consumers exist

- quiz.controller.ts, unit-quiz.controller.ts (assessments/quiz)
  - Proxy: many quiz-related proxies are available under /api/quiz and /api/quizzes (see src/app/api/quiz/... if present)
  - Call sites: src/hooks/useQuiz.ts (fetch('/api/quiz/submit')), src/components/assessment/AdaptiveQuiz.tsx (fetch('/api/assessments/adaptive-quiz/\*'))
  - Status: Proxy exists for submit endpoints; other assessment endpoints present in UI

- progress.controller.ts (progress)
  - Proxy: src/app/api/progress/\* (see src/app/api/progress/route.ts if present)
  - Call sites: src/lib/offline/syncManager.ts (fetch('/api/progress/log')), various progress widgets
  - Status: Proxy exists or uses /api/progress, Consumers exist

- clinical-cases.controller.ts (clinical-cases)
  - Proxy: src/app/api/clinical-cases/route.ts, src/app/api/clinical-cases/[caseId]/route.ts, src/app/api/clinical-cases/attempts/route.ts, src/app/api/clinical-cases/attempts/[attemptId]/progress/route.ts
  - Call sites: src/app/(app)/clinical-cases/page.tsx, src/components/clinical-cases/InteractiveCaseInterface.tsx, CaseLibraryManagement.tsx
  - Status: Proxy exists, Consumers exist

- chat.controller.ts (chat)
  - Proxy: src/app/api/chat/sessions/route.ts, src/app/api/chat/sessions/[sessionId]/messages/route.ts, src/app/api/chat/message/route.ts
  - Call sites: src/app/(app)/chat/page.tsx, chat components
  - Status: Proxy exists, Consumers exist

- learning-paths.controller.ts (learning-paths)
  - Proxy: src/app/api/learning-paths/route.ts, src/app/api/learning-paths/[id]/route.ts, src/app/api/learning-paths/[id]/enroll/route.ts, src/app/api/learning-paths/[id]/progress/route.ts, src/app/api/learning-paths/my-progress/route.ts
  - Call sites: src/components/learning-paths/\*, src/app/(app)/learning-paths pages
  - Status: Proxy exists, Consumers exist

- learning-goals.controller.ts (learning-goals)
  - Proxy: src/app/api/learning-goals/route.ts, src/app/api/learning-goals/[id]/progress/route.ts, src/app/api/learning-goals/analytics/route.ts, src/app/api/learning-goals/smart-suggestions/route.ts
  - Call sites: src/components/goals/\*.tsx, dashboard widgets
  - Status: Proxy exists, Consumers exist

- analytics controllers (consolidated-analytics.controller.ts, analytics.controller.ts, assessment-analytics.controller.ts)
  - Proxy: src/app/api/analytics/\* (individual files may vary); consolidatedAnalyticsService exists in frontend/src/services/consolidatedAnalyticsService.ts
  - Call sites: analytics widgets and services
  - Status: Proxy presence confirmed for some endpoints; consumers exist

- ai controllers (ai.controller.ts, ai-recommendation.controller.ts, assessment-recommendations.controller.ts)
  - Proxy: likely under src/app/api/ai/\* (verify file presence)
  - Call sites: AI features in frontend services/components
  - Status: Needs verification for some ai endpoints

- course-categories.controller.ts
  - Proxy: src/app/api/course-categories/route.ts
  - Call sites: src/app/(app)/courses/page.tsx (fetch('/api/course-categories'))
  - Status: Proxy exists, Consumers exist

- files.controller.ts, integrations.controller.ts, search.controller.ts
  - Proxy: infrastructure files & integrations may have proxies; search.controller backed endpoints are invoked via /api/search if implemented
  - Call sites: search UI, file upload/download features
  - Status: Needs targeted verification

Files that still read BACKEND_URL or NEXT_PUBLIC_API_URL directly (candidates for canonicalization)

- src/services/api/baseApi.ts (reads NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_API_URL)
- src/services/api.ts
- src/services/auth.service.ts (builds baseURL from env)
- src/services/quizService.ts (uses NEXT_PUBLIC_API_URL)
- src/lib/config.ts (reads NEXT_PUBLIC_API_URL)
- next.config.js (rewrites referencing NEXT_PUBLIC_API_URL)
- Several server proxies in src/app/api/\* use process.env.BACKEND_URL to forward requests (expected)

Recommendations & Next steps

1. Finish exhaustive per-controller mapping (A): I can expand this file into a full CSV/JSON containing every backend controller, list of proxy files, and all frontend call sites. This will precisely show missing frontend UIs or missing proxies.
2. Canonicalization plan (B): Migrate frontend fetch/axios calls to use `src/lib/apiPaths.ts` and local `/api/*` proxies in small batches (3-5 files per batch). Run `pnpm --filter ./frontend run type-check` after each batch and fix type errors incrementally.
3. TypeScript triage (C): Triage the 131 type errors and prioritize ones blocking migration (auth context, response typings, runtime misuse of TypeScript-only declarations).

Pick next action:

- Reply "A" — produce exhaustive CSV/JSON mapping of controller→proxy→call-sites.
- Reply "B" — start canonicalizing backend URL usages in small batches and run type-check between batches.
- Reply "C" — produce a patch bundle of current changes for manual review.

If you want, I can start with "A" and produce the exhaustive export now.
