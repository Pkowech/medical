# Canonical learning activity and progress

**Status:** Canonical ownership is defined and partially enforced. Cross-service
progress, streak, and mastery parity is not yet complete.

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
  submission endpoint uses its stable attempt ID and replays only matching
  answers. Legacy progress clients that omit a key and the topic-quiz endpoint
  still need request-level idempotency before all retries are safe.
- `topic_progress.lastUpdated` remains the offline conflict version (epoch
  milliseconds). A newer server version rejects a stale client update; partial
  reading percentage is monotonic except an explicit reset. Equal versions
  from distinct devices are merged by the monotonic percentage rule; concurrent
  resets remain last-writer-wins and require an explicit conflict policy.
- Redis entries are caches: invalidate them after the authoritative database
  transaction. Analytics cache or gRPC failure must not roll back or replace a
  persisted learning fact.

## Progress, sessions, streaks, and mastery

- Content status is `notStarted` (no content progress), `inProgress` with
  `progressPercentage` 1–99, or `completed` with 100%. Topic progress is
  based on its content/material evidence; quiz performance is independent and
  remains in `quiz_attempts`. A passing quiz must not mark reading complete.
- Course progress is the aggregate of required topic content progress. A topic
  is complete only from content completion; an assessment pass alone is not
  enough. Rust and NestJS must use the same required-topic set and weighting.
- Session duration is active, unpaused time capped by wall-clock duration and
  is written only to `study_sessions`; ending a session does not increment
  `topic_progress.timeSpent`. This prevents retrying an interrupted end request
  from double-counting session minutes in content progress.
  Sessions shorter than five minutes are invalid for study-day activity.
  An interrupted session remains persisted as unfinished and is not counted as
  completed study time until reconciled; do not infer duration from a Redis
  key. Dashboard total/weekly study time comes from valid, ended
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

Still required before claiming end-to-end parity:

1. Add request idempotency to the topic-quiz endpoint and require keys from
   legacy clients that submit time-bearing progress updates.
2. Reconcile interrupted sessions; their persisted unfinished records are not
   currently included in completed study duration or activity.
3. Use one shared topic-level course aggregation contract in NestJS and Rust,
   including empty units and required-topic selection.
4. Persist adaptive quiz responses outside Redis during an active attempt.
5. Confirm no external `BatchTrackEvents` or `UpdateAttemptMetrics` consumers.
   Both gRPC methods are marked deprecated; remove the dormant Rust batch
   writer, `UpdateAttemptMetrics`' second `quiz_attempts` writer, and the
   `analytics_events` table in separately reviewed changes after consumer and
   historical-retention checks.
6. Add parity tests that run the same student history through backend and Rust
   progress, streak, and mastery readers.
7. Backfill qualifying historical quiz and flashcard records into the activity
   projection before switching production dashboards to the unified streak
   definition.

Do not deploy schema retirement or drop `analytics_events` until production
backup, consumer verification, and historical-data retention review are done.
