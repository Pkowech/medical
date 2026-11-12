# MedTrack Hub — active roadmap
This roadmap is being actively trimmed. Items that are already implemented or documented as complete are moved to the done section below; only the remaining work stays in the active backlog.

## Done and already documented
- [x] Canonical learning activity ownership is defined in [docs/LEARNING_ACTIVITY_ARCHITECTURE.md](../docs/LEARNING_ACTIVITY_ARCHITECTURE.md).
- [x] The authoritative ownership model was documented: `topic_progress`, `quiz_attempts`, `study_sessions`, `user_activities`, `user_skill_states`, and Redis are clearly separated.
- [x] The main learning lifecycle was clarified: publish content → study → complete assessment → persist progress/activity/mastery → recommend next actions.
- [x] The database reset and migration consolidation work is treated as completed at the project level, with verification still required before claiming production readiness.
- [x] The PWA foundation exists and should be preserved while behavior is being verified rather than replaced.
- [x] The architecture no longer treats `analytics_events` as the canonical source of learning truth.

## In progress / still active
- [ ] Confirm the canonical ownership model is enforced in code, not just documented.
- [ ] Verify all publication, authorization, and cache invalidation paths for catalogue content.
- [ ] Verify quiz submission idempotency, retries, and adaptive session safety.
- [ ] Reconcile interrupted study sessions and duration rules.
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
- [ ] Validate login, logout, refresh, password recovery, and rate limiting.
- [ ] Verify RBAC at controller and service boundaries.
- [ ] Audit and fix any remaining catalogue publication/authorization gaps.
- [ ] Confirm material sharing, unpublished content filtering, and cache invalidation remain safe.

# 2. Phase 2 — Secure assessment integrity
- [ ] Build a single authoritative question representation and remove ambiguity.
- [ ] Verify proper answer exposure rules and question versioning.
- [ ] Check quiz generation, randomization, timers, and answer grading.
- [ ] Ensure duplicate and replayed submissions are rejected or safely idempotent.
- [ ] Verify adaptive assessment behavior and session safety.
- [ ] Confirm assessment result persistence works under retries and disconnects.

# 3. Phase 3 — Unify learning activity
- [ ] Finalize canonical domain ownership for progress, quiz attempts, sessions, and activity projections.
- [ ] Remove or formally deprecate dormant event pipelines.
- [ ] Enforce source IDs, idempotency keys, and duplicate handling.
- [ ] Reconcile interrupted sessions and study-day logic.
- [ ] Align progress, streak, and mastery calculation rules across NestJS and Rust.
- [ ] Persist durable outbox events for post-submission processing.

# 4. Phase 4 — Complete academic lifecycle
- [ ] Verify course, unit, topic, and material publication logic.
- [ ] Finish onboarding and profile completion behavior.
- [ ] Audit learning-path eligibility and recommendation filtering.
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

## Working checklist for the next three milestones
1. [ ] Assessment integrity report: prove quiz submission, grading, retries, and adaptive sessions are correct.
2. [ ] Canonical activity architecture: establish one reliable source of learning activity and make the outbox durable.
3. [ ] Verified Pharmacy learning journey: demonstrate a student can onboard, study, complete a quiz, receive correct progress, and get valid next-step recommendations.

This is the active backlog. Once a task is independently verified, it should be moved from the active list into the done section above and removed from the working backlog.
