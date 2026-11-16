# MedTrack Hub — active roadmap
This roadmap is being actively trimmed. Items that are already implemented or documented as complete are moved to the done section below; only the remaining work stays in the active backlog.

## Done and already documented
- [x] Canonical learning activity ownership is defined in [docs/LEARNING_ACTIVITY_ARCHITECTURE.md](../docs/LEARNING_ACTIVITY_ARCHITECTURE.md).
- [x] The authoritative ownership model was documented: `topic_progress`, `quiz_attempts`, `study_sessions`, `user_activities`, `user_skill_states`, and Redis are clearly separated.
- [x] The main learning lifecycle was clarified: publish content → study → complete assessment → persist progress/activity/mastery → recommend next actions.
- [x] The database reset and migration consolidation work is treated as completed at the project level, with verification still required before claiming production readiness.
- [x] The PWA foundation exists and should be preserved while behavior is being verified rather than replaced.
- [x] The architecture no longer treats `analytics_events` as the canonical source of learning truth.
- [x] Phase 2 assessment integrity is implemented and covered by focused regressions; the scoring backfill migration still requires deployment validation in Phase 1.
- [x] Study-session validity uses unrounded active seconds with a one-minute minimum; expired sessions close as invalid, and invalid sessions create no learning activity or outbox event.
- [x] Legacy learning-progress updates require content identifiers, idempotency, client time, and an expected revision; course enrollment and topic/material associations are validated.
- [x] Rust user-level course statistics derive from published topic/unit progress; shared fixtures cover aggregation and zero-progress status mapping.

## In progress / still active
- [ ] Confirm the canonical ownership model is enforced in code, not just documented.
- [ ] Verify all publication, authorization, and cache invalidation paths for catalogue content.
- [ ] Complete the durable outbox pattern for post-quiz processing and critical events.
- [ ] Validate end-to-end learning progress, streak, and mastery parity.
- [ ] Finish the reliable onboarding and learning-path journey.
- [ ] Verify Rust analytics integration against persisted evidence.
- [ ] Harden offline sync, storage, and document lifecycle handling.
- [ ] Finish production QA, infrastructure checks, and deployment readiness.

---

# 1. Phase 1 — Stabilize foundations
- [ ] Check the reset database is the intended clean baseline.
- [ ] Run the full migration sequence against an empty test database.
- [ ] Verify Prisma migration deployment in CI.
- [ ] Establish a reliable initial administrator creation flow.
- [ ] Verify role and permission reference data.
  - [x] Re-run default permission upserts when roles already exist, without reapplying grants that administrators may have changed.
  - [ ] Track intentional role-grant overrides before attempting to repair missing default grants for existing roles.
- [ ] Validate login, logout, refresh, password recovery, and rate limiting.
- [ ] Verify RBAC at controller and service boundaries.
- [ ] Audit and fix any remaining catalogue publication/authorization gaps.
- [ ] Confirm material sharing, unpublished content filtering, and cache invalidation remain safe.
  - [x] Add owner-checked direct-share revocation and refresh material search indexing after sharing changes.

# 2. Phase 2 — Secure assessment integrity
- [x] Define `QuizQuestion.points` as the quiz-specific grading weight and snapshot question order and answers per attempt.
- [x] Withhold answer feedback and configured-hidden results; prevent edits that could change attempted quizzes.
- [x] Enforce quiz randomization, server-side attempt limits and deadlines, and weighted grading.
- [x] Make duplicate and replayed submissions safe and idempotent.
- [x] Verify adaptive assessment behavior and session safety.
- [x] Confirm assessment results persist across retries and disconnects.

# 3. Phase 3 — Unify learning activity
- [ ] Enforce the documented canonical ownership model across all remaining learning writes and readers.
- [ ] Remove or formally deprecate dormant event pipelines.
- [ ] Complete source-ID, idempotency-key, and duplicate handling for every remaining legacy and internal learning writer.
- [ ] Complete progress, streak, and mastery parity across NestJS and Rust, including database-backed student-history validation.
- [ ] Complete durable outbox coverage for all critical post-submission effects and verify retry/terminal-failure handling.

# 4. Phase 4 — Complete academic lifecycle
- [ ] Verify course, unit, topic, and material publication logic.
- [ ] Finish onboarding and profile completion behavior.
- [ ] Audit learning-path eligibility and recommendation filtering.
- [ ] Build evidence-based prerequisite remediation paths: detect repeated topic-level difficulty from quiz/adaptive-assessment evidence; use a diagnostic assessment to distinguish a target-topic gap from missing foundational knowledge; map the confirmed gaps through explicit topic prerequisites and existing courses, units, materials, and assessments; then curate a sequenced, learner-specific path with a clear rationale and reassessment checkpoints.
  - [x] Aggregate target and prerequisite evidence across distinct completed attempts, excluding the current attempt, and return insufficient evidence when the minimum evidence threshold is not met.
  - [x] Present recommendation steps in order with rationale and a target reassessment checkpoint.
  - [ ] Persist reviewed sequences as learner-specific paths with independent progress ownership and verified prerequisite ordering.
- [ ] Define safe remediation rules: do not infer a broad knowledge deficit from one failed attempt; require sufficient evidence or a diagnostic, track confidence and evidence for each identified gap, avoid recommending unrelated prerequisites, and let learners review the proposed plan before it affects their active learning.
- [ ] Verify generated remediation paths preserve source links, prerequisite order, learner eligibility, and progress attribution, and can be revised when new assessment evidence changes the diagnosis.
- [ ] Verify student progression through content and assessments.
- [ ] Ensure goal tracking and next-step recommendations are valid.

# 5. Phase 5 — Verify analytics
- [ ] Confirm Rust and NestJS agree on user progress and required-topic aggregation.
- [ ] Validate course completion, topic mastery, and study-time analytics against persisted records.
- [ ] Recheck recommendation ranking and eligibility logic.
- [ ] Keep BKT predictions as analytics-only outputs unless ownership is explicitly confirmed.

# 6. Phase 6 — Offline and storage hardening
- [ ] Verify R2 upload, replacement, deletion, and signed URL authorization.
- [ ] Validate document lifecycle and offline reading flows.
- [ ] Verify offline progress sync ordering and duplicate prevention.
- [ ] Confirm reconciled sync behavior for offline submissions and reconnects.

# 7. Phase 7 — Production QA
- [ ] Repair test infrastructure gaps and centralize live-service tests.
- [ ] Add integration and end-to-end tests for the real student journey.
- [ ] Validate production readiness under Redis, PostgreSQL, Rust, and R2 failures.
- [ ] Verify backup, restoration, rollback, and incident procedures.
- [ ] Establish CI gates for migrations, TypeScript, lint, and tests.

# 8. Phase 8 — Product expansion
- [ ] Defer all features beyond the stable learning lifecycle until the core journey is verified.
- [ ] Revisit flashcards, study planner, groups, benchmarking, and community modules only after the core system is reliable.

---

## Working checklist for the next milestones
1. [x] Assessment integrity report: verify quiz submission, grading, retries, and adaptive sessions.
2. [ ] Canonical activity architecture: establish one reliable source of learning activity and make the outbox durable.
3. [ ] Verified Pharmacy learning journey: demonstrate a student can onboard, study, complete a quiz, receive correct progress, and get valid next-step recommendations.
4. [ ] Prerequisite remediation journey: demonstrate that repeated difficulty in an endocrine clinical-pharmacy topic triggers a targeted diagnostic, identifies only evidence-supported gaps, and proposes an ordered path through relevant foundational resources, courses, and assessments with a follow-up check.

This is the active backlog. Once a task is independently verified, it should be moved from the active list into the done section above and removed from the working backlog.
