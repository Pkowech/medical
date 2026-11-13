# Canonical learning activity and progress

**Status:** Canonical ownership and revision-based progress conflict handling
are implemented in the application. Selected backend/Rust calculations share
fixtures, but full database-backed parity and production rollout remain
unverified.

## Ownership

Do not add another general-purpose event table. Durable learning facts remain in
their domain records; `user_activities` is a compact, user-facing activity and
streak projection, not the authority for assessment scores or progress.

| Record | Canonical meaning | Write owner |
| --- | --- | --- |
| `topic_progress` (`Progress`) | Reading/content progress for a user and material, topic, or unit. Quiz scores and BKT estimates must not set reading completion. `timeSpent` is resource-level progress and is not the canonical study-session duration. | NestJS `ProgressService` for sync/material reads; `MasteryGateService` may store gate metadata only. |
| `quiz_attempts` (`QuizAttempt`) | Assessment attempts, answers, scores, pass result, and completion time. This is the assessment-performance source. | NestJS assessment/quiz services. Rust may consume it but must not create a second canonical attempt. |
| `study_sessions` (`StudySession`) | Session lifecycle, context, active duration, validity, and associated attempt IDs. | NestJS `StudyService`. Redis may cache active UI/analytics state but cannot replace the persisted session. |
| `user_activities` (`UserActivity`) | Feed/streak projection of completed learning, quiz, study-session, and explicit flashcard-review actions. Preserve the domain record ID in details and `sourceKey` when available. | The NestJS service that commits the corresponding domain fact, in the same database transaction. |
| `user_skill_states` (`UserSkillState`) | Rust-owned BKT estimate (`p_known`) derived from assessment evidence; it is not content completion or the quiz pass result. | Rust analytics service only. |
| `analytics_events` (`AnalyticsEvent`) | Deprecated generic analytics-ingestion pipeline; not a learning source of truth. No dashboard, progress, streak, or mastery calculation should depend on it. The unused NestJS `trackCourseEvent` writer is disabled; Rust's deprecated gRPC batch writer and historical reader remain for compatibility. | No new NestJS learning writes. Retire Rust batch ingestion and the table after confirming external gRPC consumers and historical retention requirements. |
| `study_events` (`StudyEvent`) | Non-authoritative product/interaction telemetry. Not a substitute for the domain records above. | NestJS analytics telemetry only. |
| Redis | Rebuildable cache/deduplication/short-lived UI state only. | Individual services; no unique learning outcome may exist only in Redis. |

`Progress` is the Prisma model mapped to `topic_progress`. Course and unit
progress are derived from topic/content progress, not independent evidence.
`CourseEnrollment` remains the enrollment lifecycle record.
`Progress.quizScores` is transitional gate metadata for attempts/unlock flags;
it is not authoritative score history. Score analytics read completed
`QuizAttempt` rows.

## Deadline and calendar ownership

- `Deadline.dueDate` owns user-facing academic deadlines. Generated course
  deadlines are per-user reminders keyed by user, course, and unit; repeated
  generation does not create another record. `Deadline.completed` is the
  authoritative completion state for these records.
- `LearningGoal.targetDate` owns a goal's target day. Goal dates are UTC
  calendar days, not event instants. Goal progress and completion remain owned
  by the goal record; a calendar event is not a second goal deadline.
- `ScheduleEvent.date` and `endDate` own user-created calendar appointments as
  instants. They are independent of academic deadlines and goal targets.
- Do not add a universal deadline table. Keep each date with its domain owner;
  expose a combined view by reading those owners without copying their
  records. Goal-to-calendar writes have been removed, and legacy linked goal
  projections are excluded from normal calendar views.
- Academic due-date filtering and goal-day comparisons use UTC calendar-day
  boundaries. Appointment reminders use the stored event instant and a unique
  notification source key so scheduler retries do not duplicate notifications.

## Activity provenance and duplicate handling

- Event occurrence time is the originating action time in UTC. Activity
  projections use the domain timestamp (`completedAt`, `endTime`, `lastReview`,
  or progress `lastUpdated`) as `createdAt`; domain `createdAt`/`updatedAt`
  remain persistence timestamps. Invalid client timestamps are rejected.
- Source IDs are the immutable domain IDs: quiz attempt ID, study session ID,
  flashcard result ID, or progress update's client idempotency key. Store the
  relevant source ID in `UserActivity.details`; use the namespaced
  `UserActivity.sourceKey` as a unique deduplication key when one exists.
- A retry with the same source key is a no-op, not another activity or duration
  increment. Progress sync accepts `X-Idempotency-Key`; the offline queue uses
  its stable item ID, and the online progress client generates a UUID. The key
  claim and progress mutation share a database transaction. The regular quiz
  and topic-quiz submission endpoints use their stable attempt IDs and replay
  only matching answers. Topic-quiz retries with a missing or malformed
  `X-Idempotency-Key` are rejected. Legacy progress clients that omit a key
  still need request-level idempotency before all retries are safe.
- `topic_progress.revision` is the server-owned conflict version. A write must
  include the revision it read; accepted writes increment it, while stale
  revisions return a conflict and require clients to refresh and reconcile.
  The frontend offline queue preserves that conflict instead of silently
  retrying against a newer revision. `lastUpdated` and the client timestamp
  describe occurrence/provenance, not write ordering. Idempotency keys protect
  retries independently of the revision check.
- Redis entries are caches: invalidate them after the authoritative database
  transaction. Analytics cache or gRPC failure must not roll back or replace a
  persisted learning fact.
- The application outbox is for retryable effects that follow a domain write.
  Its event envelope has a stable event ID/deduplication key, aggregate ID,
  event type, payload, and processing state. Quiz submission commits its
  required outbox records atomically; the processor retries with backoff and
  records terminal failures for inspection/replay. Consumers must be
  idempotent. Adaptive answer checkpoints and their BKT outbox records are
  committed together; Rust unavailability does not lose the answer or
  checkpoint.

## Progress, sessions, streaks, and mastery

- Content status is `notStarted` (no content progress), `inProgress` with
  `progressPercentage` 1–99, or `completed` with 100%. Topic progress is
  based on its content/material evidence; quiz performance is independent and
  remains in `quiz_attempts`. Frontend course-progress storage is a
  user-scoped presentation cache; a passing quiz must not mark reading
  complete or turn that cache into canonical progress.
- Course progress uses published topics. Within a unit, aggregate mandatory
  topics when any exist; otherwise aggregate all published topics. Average
  progress within each unit, then weight units equally. An empty unit uses
  explicit unit progress or zero. A topic is complete only from content
  completion; an assessment pass alone is not enough.
- Session duration is active, unpaused time capped by wall-clock duration and
  is written only to `study_sessions`; ending a session does not increment
  `topic_progress.timeSpent`. This prevents retrying an interrupted end request
  from double-counting session minutes in content progress.
  If a client omits active duration, record zero rather than treating elapsed
  wall-clock time as study time.
  Sessions shorter than five minutes are invalid for study-day activity.
  An unfinished session expires after 24 hours, is closed as invalid with zero
  duration, and creates no study-day activity; a late end request cannot make
  it valid. Do not infer duration from elapsed wall time or a Redis key.
  Dashboard total/weekly study time comes from valid, ended
  `StudySession` rows. Resource-level `topic_progress.timeSpent` is separate
  and must not be added again to session duration.
- A UTC study day qualifies on persisted content progress, a completed quiz
  attempt, a valid completed study session, or an explicit flashcard review.
  Login, enrollment, profile changes, recommendations, and generic telemetry
  do not qualify. A current streak may end today or yesterday; a missed UTC day
  resets it, preserves the longest streak, and has no restoration/grace policy.
- NestJS owns the deterministic quiz pass threshold and curriculum unlock
  decision. Rust owns the BKT `p_known` estimate and predictions. BKT can
  inform review recommendations, but it does not override the assessment pass
  or content-completion state. Display a mastery/confidence percentage only
  with sufficient recorded assessment evidence.

## Current gaps and rollout

The backend and Rust streak readers now share the qualifying activity types
and UTC day rule. Explicit flashcard reviews and regular quiz attempts emit a
durable activity in the same transaction as their domain record. Material-read
records now set content status and percentage consistently. NestJS no longer
writes Rust-owned `user_skill_states`; the unused Nest generic analytics writer
is disabled. Study-session duration is read from completed `StudySession` rows
and is not copied into topic progress.

The application now requires expected revisions for progress writes, persists
adaptive quiz checkpoints in `quiz_attempts`, and enqueues adaptive BKT updates
through the outbox. Shared fixtures exercise backend course aggregation,
streaks, mastery projection, and Rust streak/BKT logic. These tests are
calculation-level checks; they do not prove database-query/schema parity or a
production student's end-to-end dashboard parity.

Still required before claiming end-to-end parity or retiring legacy pipelines:

1. Run database-backed integration tests against the deployed schemas and
   services, including a full student-history parity check across progress,
   streak, and mastery readers.
2. Deploy the additive adaptive-state and progress-revision migrations using
   the normal rollout process, and verify all deployed clients send the
   revision contract before relying on conflict protection.
3. Review the historical activity backfill's dry-run output in a
   non-production environment, reconcile counts and samples, then explicitly
   approve any production `--apply` run before switching dashboards to the
   unified streak definition. The script is idempotent and skips ambiguous
   legacy matches rather than guessing.
4. Confirm there are no external `BatchTrackEvents` or `UpdateAttemptMetrics`
   consumers and review historical retention/backup requirements. Only then
   remove the dormant Rust batch writer, `UpdateAttemptMetrics`' second
   `quiz_attempts` writer, and `analytics_events` in separately reviewed
   changes.

Do not deploy schema retirement or drop `analytics_events` until production
backup, consumer verification, and historical-data retention review are done.
