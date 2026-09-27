# Schema Consolidation Checklist

**Status date:** 2026-09-26  
**Scope:** Evidence-based schema cleanup and the larger migrations it depends on. The architecture assessment is in [ARCHITECTURE_ANALYSIS_14_QUESTIONS.md](ARCHITECTURE_ANALYSIS_14_QUESTIONS.md).

## Started: Dead Assessment Fields

- [x] Remove `Question.isMultipleChoice`; `Question.type` is canonical and no application consumer was found.
- [x] Remove `Question.discriminationIndex` and `Question.guessingParameter`; runtime IRT reads `discrimination` and `guessing`.
- [x] Remove `QuizAttempt.timeSpent`; active attempt duration uses `timeTaken`.
- [x] Remove `UserResponse.timeSpent`; answer submission and analytics use `responseTime`.
- [x] Migrate adaptive assessment analytics writes/aggregations to `timeTaken` and `responseTime` in `backend/src/modules/ai-analytics/services/assessment-analytics.service.ts`.
- [x] Add migration `20260926120000_remove_dead_assessment_fields`.
- [x] Run Prisma schema validation and regenerate the client; touched schema/analytics files have no diagnostics.
- [x] Apply the assessment-field cleanup to local `medtrack`; values in the removed duplicate columns were discarded per user direction.
- [ ] Clear the remaining whole-backend typecheck errors (one in `course-analytics.service.ts`, four in the untracked notes controller).
- [ ] Run focused assessment tests; no assessment-specific backend test file was found in the workspace.
- [ ] Review deployed database values before applying the destructive migration.

## Production-Data Gate: Spaced Repetition

- [x] Confirm application behavior uses `UserFlashcardProgress`; no runtime consumers of `SpacedRepetitionCard` or `Progress` SM-2 columns remain.
- [x] Remove `SpacedRepetitionCard`, the SM-2 fields/index on `Progress`, and the stale frontend `Progress` type fields.
- [x] Apply `20260926140000_remove_duplicate_spaced_repetition` to local `medtrack`; legacy review data was discarded per user direction.
- [x] Verify `spaced_repetition_cards` and the four `topic_progress` scheduler columns are absent while `user_flashcard_progress` remains.
- [x] Keep `UserFlashcardProgress` and the active SM-2 service.

## Progress Table Retirement

- [x] Migrate backend and Rust runtime consumers away from `CourseProgress` and `UnitProgress`.
- [x] **Unit progress navigation:** Replaced the direct `UnitProgress` lookup in `backend/src/modules/education/courses/services/study.service.ts` with the existing `ProgressService.calculateUnitProgress` calculation.
- [x] Preserve frontend progress API response contracts; progress service and DTOs now derive course/unit values without Prisma aggregate models.
- [x] **Admin analytics fallback:** Count `CourseEnrollment.status = completed` instead of `CourseProgress.status = completed`; the enrollment completion flow maintains that lifecycle state.
- [x] **Course details:** Reuse `progressPercentage` and `lastAccessed` from the already-loaded `CourseEnrollment` rather than querying `CourseProgress`.
- [x] **Rust course-progress calculation:** Centralized both Rust callers in `rust_analytics/src/modules/analytics/progress_tracking/mod.rs`; completed-material counts now read `topic_progress`, and access totals read `unit_accesses`.
- [x] Migrate Rust reporting, material history, repository, and system-summary reads to `CourseEnrollment`, `StudySession`, `topic_progress`, and `unit_accesses`.
- [x] Remove the redundant `unit_completions` join from Rust learning history; retain `UnitCompletion` because it owns score/feedback data with no equivalent destination.
- [x] Remove `CourseProgress` and `UnitProgress` Prisma models; migration `20260926130000_retire_course_and_unit_progress` backfills their data and drops both tables.
- [x] Apply both cleanup migrations to local `medtrack`; aggregate rows were copied where applicable, and catalog check confirmed `course_progress` and `unit_progress` are absent while `unit_completions` remains.
- [ ] **Production parity/release gate:** If deploying to production, back up and compare legacy aggregate results against `CourseEnrollment`, `topic_progress`, `StudySession`, and `unit_accesses` first.
- [ ] Decide whether `UnitCompletion` score/feedback should remain a separate record or be migrated into a new canonical assessment outcome model.
- [ ] **Search:** Decide whether course-local FTS remains a separate endpoint capability or is routed through `GlobalSearchIndex`; migrate direct local FTS consumers before dropping per-entity vectors/indexes.
- [ ] **Security history:** Document which events belong in `SecurityAudit` versus `SecurityEvent`; stop or justify the dual write in `backend/src/modules/auth/services/audit-log.service.ts` before considering consolidation.

## Field Reconciliation Decisions

- [x] **Question statistics:** Remove the unused `QuestionStats` table/model; retain active metrics on `Question` and its existing writer/selection paths.
- [x] Apply `20260926150000_remove_unused_question_stats` to local `medtrack`; catalog verification confirmed `question_stats` is absent.
- [ ] **Streak ownership:** Keep learning-path and learning-goal streaks scoped to those entities. Define one user-wide source and derive/cache `User.streakDays` or `UserLearningAnalytics.currentStreak` from it.
- [ ] **Progress percentages:** Audit divergent `progressPercentage` and `completionPercentage` values, define their meanings, reconcile/backfill, then remove or rename one field.
- [ ] **Course/Unit labels:** Define `name` vs `title` API and storage ownership; migrate display/search/prerequisite readers and preserve API compatibility before dropping a column.
- [ ] **Notification importance:** Define a value mapping from `severity` (`critical`, `important`, `suggestion`) to `NotificationPriority`; migrate throttling and existing rows before removing either field.
- [ ] **Progress timestamps:** Keep `lastUpdated` while offline conflict resolution depends on its epoch-millisecond semantics; do not replace it with `updatedAt` without a sync protocol migration.

## Completion Gates

- [x] `prisma validate`, Prisma client generation, and backend typecheck pass.
- [x] Focused Rust progress aggregation tests and default-feature Rust compile pass.
- [x] No backend or Rust runtime SQL consumers of `course_progress` or `unit_progress` remain.
- [x] Local migration execution and physical table-retirement verification passed; no separate local backup/parity run was performed per user direction.
- [ ] Execute on production only after any required backup and parity review.
- [ ] Deploy only after production backup, parity checks, and coordinated backend/Rust release.
- [ ] Migration is reviewed against production data and deployed with a rollback/archive plan.