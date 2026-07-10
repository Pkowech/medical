# MedTrack Hub: Architecture Analysis – Answers to 14 System-Defining Questions

**Date**: June 4, 2026  
**Status**: Current State Assessment + Gaps & Recommendations

---

## Executive Summary

Your system is **architecturally sound but conceptually scattered**. You have:
- ✅ Strong foundational models (Prisma schema is rich and normalized)
- ✅ Multiple analytics pipelines (NestJS backend + Rust analytics service)
- ✅ Recommendation infrastructure (BKT skill states, Rust recommendation engine)
- ✅ Assessment tracking (QuizAttempt, CaseAttempt, UserResponse)

**But:**
- 🟡 **Canonical SSOT Implementation Complete** — `Progress` model is now the SSOT; `UnitProgress`/`CourseProgress` deprecated.
- ✅ **Prerequisite Types Implemented (Jan 18, 2026)** — `PrerequisiteType` enum added.
- ✅ **Dashboard Standardization Complete (Jan 25, 2026)** — 32+ files renamed to `kebab-case.tsx`; logic centralized in `AppHeader`.
- ✅ **Centralized Streaks Implemented** — Redundant widgets removed; Header acts as authoritative progress tracker.
- ✅ **Enum Consolidation Complete** — Domain enums moved to `schema.prisma` as SSOT.
- ✅ **Prescriptive Goals Implementation (Jan 25, 2026)** — Dynamic effort estimation, goal conflict detection, and USMLE/NCLEX high-stakes weighting implemented.
- ✅ **Tiered Escalations Implemented** — Automated goal-overdue escalation job and tiered notifications (push/email) functional.
- ✅ **Completion with Decay Implemented (March 09, 2026)** — `CompetenceCalculatorService` now handles time-adjusted mastery.
- ✅ **Session Outcome Tracking Implemented (March 09, 2026)** — `StudyService` now calculates learning gain per session.
- ✅ **Prescriptive Analytics Implemented (March 09, 2026)** — `PrescriptiveAnalyticsService` manages blocking gates and support options.
- ❌ **Feedback loops missing** — no mechanism for instructors or students to correct decisions

This document answers each of the 14 questions with honest gaps and concrete recommendations.

---

## 1. Single Source of Truth (SSOT)

### Current State

**Canonical unit exists, but partially:**

```prisma
// Hierarchy: Course → Unit → Topic (each is a real entity)
Course {
  units: Unit[]        // Learning module level
  materials: Material[]
}

Unit {
  topics: Topic[]      // Atomic assessment unit
  materials: Material[]
}

Topic {
  materials: Material[]
  quizzes: Quiz[]      // Assessments mapped to topic
  userSkillStates: UserSkillState[]  // BKT knowledge state
}

Question {
  topic_ids: String[]  // Multi-topic mapping
  conceptsCovered: String[]
}
```

**Problem: Four overlapping progress tables:**

1. `Progress` (topicId) — topic-level progress
2. `UnitProgress` (unitId) — unit-level progress  
3. `CourseProgress` (courseId) — course-level progress
4. `UserSkillState` (skillId referencing Topic) — BKT state

### Critical Gap (Status: Resolved Jan 16, 2026)

**Consolidation:** Redundant `UnitProgress` and `CourseProgress` tables have been removed. The `Progress` model (keyed by `userId`, `courseId`, `unitId`, `materialId`, `topicId`) now serves as the single source of truth for all learning progress.

**Type Safety:** Services have been refactored to remove `as any` bypasses, ensuring Prisma interactions are fully type-safe against the consolidated schema.

### Answer to Question 1

**Topic** is the canonical unit, but you need to formalize:

| Entity | Authority | Scope | Decision |
|--------|-----------|-------|----------|
| **Topic** | SSOT | Atomic learning unit + assessment | Can be independently assessed & passed/failed |
| **Unit** | Derived | Grouping of topics | Completion = all topics completed |
| **Course** | Derived | Grouping of units | Completion = all units completed |

**Implementation Status (Jan 16, 2026):**
- [x] Keep `Progress` as the canonical topic-level record
- [x] Deprecate redundant `UnitProgress` and `CourseProgress` — compute as aggregates
- [x] Store UserSkillState separately for learning analytics (don't use as primary completion signal)
- [x] Ensure type safety for all progress-related operations

---

## 2. Material → Note → Knowledge Flow

### Current State

```prisma
Material {
  title: String
  type: MaterialType  // pdf, video, slide, quiz_guide, notes, audio, interactive, flashcard, other
  fileId: String?     // R2 file reference
  content: String?    // Inline content
  topicId: String?
  metadata: Json?
}

MaterialProgress {
  userId, materialId
  progress: Float (0-1)
  isCompleted: Boolean
  lastAccessedAt: DateTime
}

MaterialEvent {
  eventType: 'view' | 'download' | 'upload'
  viewCount, downloadCount
  lastOccurredAt: DateTime
}
```

### Critical Gap

- **Static notes**: No distinction between instructor-authored, student-authored, AI-generated
- **Versioning absent**: When source material changes, notes don't reflect it
- **No decay model**: A note from January 2023 has same authority as one from yesterday
- **No linking**: Notes don't explicitly reference quiz questions, learning objectives, or outcomes

### Answer to Question 2

A **note is a personalized knowledge object**, not dead weight.

| Type | Authority | Decay | Linkage |
|------|-----------|-------|---------|
| **Source Material** | High (instructor) | None (versioned) | → Quiz, Topics |
| **Generated Abstraction** (AI) | Medium | Fast (1 week stale) | ← Source material, Quiz feedback |
| **Student Notes** | Low (personal) | None (personal) | ← Learning activities |
| **Peer Notes** | Low (social) | None (tagged with date) | ← User contribution |

**Current gap:** No tracking of note → source → assessment lineage.

### Recommendation

Add `Note` and `NoteVersion` models:

```prisma
model Note {
  id: String
  userId: String
  topicId: String
  materialId: String?  // Optional source
  type: 'student' | 'ai_generated' | 'peer_shared'
  content: String
  linkedQuizIds: String[]  // References to quizzes this note covers
  linkedConceptIds: String[]  // Concepts/topics this addresses
  createdAt: DateTime
  lastUpdatedAt: DateTime
  isStale: Boolean @default(false)
  staledAt: DateTime?  // When source material updated
  versions: NoteVersion[]
}
```

---

## 3. Course / Unit / Topic Boundaries

### Current State

```prisma
Course { name, code, difficulty }
Unit { name, order, courseId, estimatedDuration }
Topic { name, order, unitId }
```

**Who defines boundaries?** 
- Implicitly: **Instructor/Curriculum creator** (no explicit boundary-definition UI)
- **Topic atomicity undefined:** No rule like "topic must have ≥1 quiz"
- **Multi-path forbidden:** Topics are strictly Unit → Topic (no cross-unit topics)

### Critical Questions (Unanswered)

1. Can a student **fail a topic**? Yes (if quiz_score < 70%), but what happens next?
2. Can a topic be **dropped and resumed**? Code suggests yes (Progress.status='dropped'), but **UI may not support**
3. **Multi-exam paths?** If a student retakes anatomy 3 times, do all scores count toward assessment?

### Answer to Question 3

**Hard rule:** If you can't **fail or pass it**, it's not a real unit.

**Current state:**
- ✅ Topics can be passed (quiz_score ≥ 70% → masteryUnlocked)
- ✅ Topics can be failed (quiz_score < 70%)
- ❌ **No boundary enforcement:** A unit without quizzes is incomplete
- ❌ **No mastery path:** Failing 2 topics doesn't trigger intervention

### Recommendation

Add validation rules:

```typescript
// 1. Topic must have ≥1 quiz mapped to it
// 2. Unit completion = all topics passed (not just accessed)
// 3. Course completion = all units completed AND final exam passed
// 4. Failure rule: If topic failed 2x, system recommends review materials or instructor intervention
```

---

## 4. Quiz Relevance & Authority

### Current State

```prisma
Quiz {
  title, description
  timeLimit, maxAttempts
  passingScore (default 70%)
  isPublished, isAdaptive
  adaptiveConfig: Json?
  questions: QuizQuestion[]  // Ordered list
}

QuizQuestion {
  quizId, questionId, order, points, isRequired
}

Question {
  type: QuestionType  // multiple_choice, true_false, essay, etc.
  difficulty: QuestionDifficulty  // easy, medium, hard
  category: QuestionCategory  // 20+ categories (anatomy, pharmacology, etc.)
  tags: String[]
  discriminationIndex, difficultyIndex, guessingParameter  // IRT parameters
  successRate: Float  // Empirical pass rate across all users
  usageCount: Int
  createdBy: String?
}
```

### Critical Gap

- ✅ **Questions mapped to topics** (Question.topic_ids: String[])
- ❌ **No exam frequency tracking:** Does this question appear on board exams? Regional exams?
- ❌ **Relevance not validated:** A question can be marked irrelevant by nobody
- ❌ **No feedback loop:** If 95% of students answer a question wrong (successRate=0.05), **nobody acts**
- ❌ **Adaptive logic undefined:** What makes a quiz "adaptive"? (adaptiveConfig is opaque Json)

### Answer to Question 4

**What makes a quiz question official?**

1. **Mapped to topic/unit/course** (exists ✅)
2. **Difficulty calibrated** (exists via discriminationIndex/difficultyIndex ✅)
3. **Exam-relevant** (missing ❌)
4. **Statistical validation** (successRate exists, but **no action rule** ❌)

### Recommendation

Add quiz authority model:

```prisma
model QuestionMetric {
  questionId: String
  examMappings: Json  // { "USMLE_Step1": true, "NCLEX_RN": false }
  successRate: Float
  discriminationIndex: Float
  flaggedAt: DateTime?  // When marked for review
  flagReason: String?   // e.g., "successRate < 0.2", "discriminationIndex < 0.2"
  isRelevant: Boolean @default(true)
  madeIrrelevantAt: DateTime?
}

// Trigger: If Question.successRate < 20%, automatically set flaggedAt
```

---

## 5. Completion Semantics

### Current State

```prisma
// Multiple completion signals:
Progress {
  status: ProgressStatus  // notStarted, inProgress, completed, skipped, dropped, reviewed
  isCompleted: Boolean
  masteryUnlocked: Boolean  // Unlocks next topic
  completionPercentage: Int
}

UnitCompletion {
  userId, unitId
  completedAt: DateTime
  score: Float?
  feedback: String?
}

CourseEnrollment {
  status: EnrollmentStatus  // active, completed, dropped, suspended
  completedAt: DateTime?
}
```

### Critical Gap

**"Completed" means different things:**
1. User viewed material → Progress.progress > 0
2. User attempted quiz → QuizAttempt exists
3. User passed quiz → QuizAttempt.isPassed = true
4. User achieved mastery → Progress.masteryUnlocked = true

**No decay model.** A student who:
- Passed anatomy quiz on 2023-01-15 (passed)
- Never reviewed the material
- Takes board exam in 2026

→ System still shows "mastery unlocked" even though they've likely forgotten.

### Answer to Question 5 (Status: Resolved March 09, 2026)

**Completion is probabilistic with decay, not binary.**

**Implementation (March 09, 2026):**
- [x] **Competence Calculator**: `CompetenceCalculatorService` calculates time-adjusted competence using exponential decay: `pKnown * exp(-decayRate * daysSinceReview)`.
- [x] **Mastery Fading Warnings**: System warns when competence drops below 0.7 threshold.
- [x] **Temporary Mastery**: Mastery is never "permanent"; it is always subject to temporal decay.
- [x] **Spaced Repetition Linkage**: Decay triggers items to reappear in "Due for Review" queues.

---

## 6. Study Sessions as First-Class Citizens

### Current State

```prisma
StudySession {
  userId, topicId
  startTime, endTime
  duration: Int?
  focusScore: Int  // 0-100
  activities: Json?
  notes: String?
  metadata: Json?
}

StudyEvent {
  userId, eventType
  resourceId, resourceType
  duration: Int?
  metadata: Json?
  createdAt: DateTime
}
```

### Critical Gap

- ✅ Sessions are tracked
- ❌ **Sessions don't generate artifacts:** No transcript of "what student learned" 
- ❌ **No session validation:** What invalidates a session? (Network timeout? User leaves window open?)
- ❌ **Multi-topic sessions not modeled:** If student studies topics A and B in one session, how is time allocated?
- ❌ **No explicit learning outcome:** Session duration ≠ learning gain

### Answer to Question 6 (Status: Resolved March 09, 2026)

A study session is **outcome-based, not time-based**.

**Implementation (March 09, 2026):**
- [x] **Learning Gain Metric**: `StudyService` calculates learning gain based on focus score and quiz outcomes.
- [x] **Validity Enforcement**: Sessions < 5 minutes or with zero activity are marked invalid.
- [x] **Artifact Linkage**: Sessions are linked to specific `QuizAttempt` records and material views.
- [x] **Focus Scoring**: Derived from activity consistency and duration.

---

## 7. Analytics: Descriptive vs Prescriptive

### Current State — Rust Analytics Engine

**You have a production-grade Rust analytics microservice** that calculates:

```
rust_analytics/src/
├── modules/analytics/performance/
│   ├── bkt.rs (Bayesian Knowledge Tracing algorithm)
│   └── update_bkt_use_case.rs (Update skill knowledge state)
├── modules/analytics/recommendations/
│   └── service.rs (Multi-factor recommendation scoring)
├── application/use_cases/
│   ├── predict_performance_use_case.rs
│   └── update_bkt_use_case.rs
└── observability/metrics.rs (Prometheus metrics)
```

**What it actually calculates:**

1. **BKT (Bayesian Knowledge Tracing) Updates:**
   - Tracks `p_known` (probability student knows skill) for each Topic
   - Default params: `p_init=0.4, p_slip=0.1, p_guess=0.2, p_transit=0.15`
   - Updates after each quiz attempt: `if correct → increase p_known; if wrong → decrease`
   - Stored in `user_skill_states` table (skill_id → topic_id)
   - **Metrics:** `BKT_UPDATE_TOTAL`, `BKT_UPDATE_IMPROVEMENT_TOTAL` (Prometheus gauges)

2. **Skill Weakness Detection:**
   - `get_weakest_skills()` → returns topics with lowest p_known
   - `build_user_profile()` → aggregates strengths (p_known > threshold) & weaknesses (p_known < threshold)
   - Falls back to historical quiz performance if p_known unavailable
   - **Metric:** `BKT_GAPS_DERIVED` counter

3. **Performance Prediction:**
   - `PredictPerformanceUseCase` blends:
     - Historical p_known (40% weight)
     - Recent quiz trend score (60% weight)
   - Optionally applies ML model (Linfa classifier) if enabled
   - Returns point estimate + (optionally) confidence
   - **Metrics:** `LINFA_PREDICTION_TOTAL`, `LINFA_FAILURE_TOTAL`

4. **Recommendation Scoring (Multi-Factor Algorithm):**
   ```rust
   MaterialScore = {
     base_score: f64,           // How well does this fit the user?
     difficulty_match: f64,     // Does difficulty align with profile?
     topic_relevance: f64,      // Are prerequisites satisfied?
     popularity: f64,           // How many other students completed this?
     prerequisite_met: bool,    // Can user access it?
   }
   
   final_score = weighted_combination(
     base_score * 0.4,
     difficulty_match * 0.3,
     topic_relevance * 0.2,
     popularity * 0.1
   )
   ```

5. **Aggregated Skill Analytics:**
   - `update_bkt_skill_avg_metrics()` → calculates `AVG(p_known)` per skill across all users
   - Exposes as Prometheus gauge: `bkt_skill_average_p_known{skill_id="..."}`
   - Used for peer benchmarking ("You're in bottom 25% for pharmacology")

**But:**
- ✅ All metrics calculated (BKT states, performance predictions, recommendation scores)
- ✅ **Prescriptive Decisions Started:** Analytics can now block topic unlocking via `PrescriptiveAnalyticsService`
- ❌ **Recommendations are separate:** RecommendationEngine produces scores, but nothing blocks/enforces action
- ❌ **No prescriptive trigger:** When p_known drops below threshold, nobody acts (outside of topic unlocking)

### Critical Gap

Examples of **descriptive-only analytics** (no action):

1. "Quiz success rate = 45%" → What happens? Nothing.
2. "Student struggled with physiology" → Suggestion made, but student can ignore.
3. "Peer average = 75%, student = 60%" → Benchmark shown, no intervention.

### Answer to Question 7 (Status: Prescriptive Decisions Implemented March 09, 2026)

**Prescriptive analytics must have decision authority.**

**Implementation (March 09, 2026):**
- [x] **Decision Authority**: `PrescriptiveAnalyticsService` manages mastery gates and blocking logic.
- [x] **BKT Integration**: Direct gRPC linkage to Rust analytics for real-time skill state updates.
- [x] **Support Pairing**: Every "at-risk" decision automatically includes support options (tutoring, groups, bridging materials).
- [x] **Explainability**: Gate decisions include human-readable explanations of *why* access was denied.
- [x] **Graceful Degradation**: Fallback to cache or cohort defaults if Rust service is slow/offline.

### How Rust Analytics Actually Works (Current Implementation)

**Data Flow:**

```
1. QuizAttempt completed (NestJS backend)
   ↓
2. batchTrackEvents() in ai-analytics.service.ts
   ├─ Collects: { userId, skillId, is_correct, timestamp }
   └─ Sends gRPC to Rust analytics
   ↓
3. Rust AnalyticsService.track_event() 
   ├─ Fetches current user_skill_states.p_known
   ├─ Applies BKT formula: p_known_new = update_p_known(p_known_prev, is_correct, BKTParams)
   ├─ Stores updated p_known in user_skill_states
   ├─ Increments Prometheus metric: BKT_UPDATE_TOTAL
   └─ If improved: BKT_UPDATE_IMPROVEMENT_TOTAL++
   ↓
4. refreshBktSkillMetrics() gRPC call
   ├─ Calculates: AVG(p_known) per skill across ALL users
   ├─ Updates Prometheus gauge: bkt_skill_average_p_known{skill_id="..."}
   └─ Returns to NestJS
   ↓
5. Prometheus scrapes metrics every 15 seconds
   ├─ bkt_skill_average_p_known{skill_id="anatomy"} = 0.67
   ├─ bkt_skill_average_p_known{skill_id="pharmacology"} = 0.58
   └─ Used by dashboards for peer benchmarking
```

**BKT Algorithm (The Core):**

```rust
// From bkt.rs
pub fn update_p_known(p_known_prev: f64, is_correct: bool, params: &BKTParams) -> f64 {
    let p_slip = params.p_slip;        // 0.1 (mistake despite knowing)
    let p_guess = params.p_guess;      // 0.2 (guess despite not knowing)
    let p_transit = params.p_transit;  // 0.15 (learn from each attempt)

    let p_known_cond = if is_correct {
        // If correct: probability they actually knew it (not just guessed)
        p_known_prev * (1.0 - p_slip) / (p_known_prev * (1.0 - p_slip) + (1.0 - p_known_prev) * p_guess)
    } else {
        // If wrong: probability they actually didn't know it (didn't slip)
        p_known_prev * p_slip / (p_known_prev * p_slip + (1.0 - p_known_prev) * (1.0 - p_guess))
    };

    // Apply learning transition probability
    p_known_cond + (1.0 - p_known_cond) * p_transit
}

// Example: p_known_prev = 0.6, answered correctly
// p_known_cond = 0.6 * 0.9 / (0.6 * 0.9 + 0.4 * 0.2) = 0.54 / 0.62 ≈ 0.87
// p_known_new = 0.87 + (1 - 0.87) * 0.15 ≈ 0.87 + 0.02 ≈ 0.89
// Result: confidence increased from 60% → 89%
```

**Recommendation Scoring (Multi-Factor Algorithm):**

```rust
// From recommendations/service.rs
async fn get_recommendations_ai(user_id: &str, pool: &Pool<Postgres>) -> Result<Vec<Recommendation>> {
    // Step 1: Build user profile
    let profile = build_user_profile(user_id, pool).await?;
    // Returns: {
    //   completed_materials: 12,
    //   average_score: 78.5,
    //   preferred_difficulty: "medium",
    //   strengths: ["anatomy", "physiology"],
    //   weaknesses: ["pharmacology", "biochemistry"],
    //   recent_topics: ["cardiology", "immunology"]
    // }

    // Step 2: Get candidate materials (not yet completed)
    let candidates = get_candidate_materials(user_id, &profile, pool).await?;
    // Returns: [(material_id, difficulty, [topic_ids]), ...]

    // Step 3: Score each candidate
    let scored: Vec<MaterialScore> = candidates
        .into_iter()
        .map(|(id, difficulty, topics)| score_material(&id, &difficulty, &topics, &profile))
        .collect();
    // Each material gets:
    // - base_score: 0-1 (how relevant to weaknesses?)
    // - difficulty_match: 0-1 (matches user preferred_difficulty?)
    // - topic_relevance: 0-1 (topics match profile strengths/weaknesses?)
    // - popularity: 0-1 (normalized enrollment count)
    // - prerequisite_met: bool

    // Step 4: Calculate final score
    let final_score = calculate_final_score(&scored);
    // final_score = base_score * 0.4 + difficulty_match * 0.3 + topic_relevance * 0.2 + popularity * 0.1

    // Step 5: Return top 10 with reasons
    recommendations
        .iter()
        .take(10)
        .map(|ms| {
            let reason = generate_recommendation_reason(&ms, &profile);
            // Reason examples:
            // - "Addresses your weakness in pharmacology"
            // - "Recommended for peers with similar profile"
            // - "Prerequisite for advanced cardiology"
            Recommendation {
                material_id: ms.material_id,
                score: final_score,
                reason,
            }
        })
        .collect()
}
```

**Performance Prediction (Historical + Trend Blend):**

```rust
// From predict_performance_use_case.rs
pub async fn execute(&self, request: PredictPerformanceRequest) -> Result<PredictPerformanceResponse> {
    // Historical: Get p_known from user_skill_states
    let historical = self.skill_state_repo
        .get_user_skill_state(&request.user_id, &request.skill_id)
        .await?
        .unwrap_or(BKTParams::default().p_init);  // Default 0.4 if no history

    // Trend: Get last 10 quiz attempts for this skill
    let recent_attempts = sqlx::query!(
        "SELECT is_correct FROM quiz_attempts WHERE user_id = $1 AND skill_id = $2 ORDER BY completed_at DESC LIMIT 10",
        request.user_id, request.skill_id
    )
    .fetch_all(self.pool)
    .await?;

    // Calculate trend score (% correct in recent attempts)
    let trend_score = recent_attempts.iter().filter(|a| a.is_correct).count() as f64 / recent_attempts.len() as f64;

    // Blend: 40% historical, 60% trend
    let blended = historical * 0.4 + trend_score * 0.6;

    // Optional: Apply ML model if enabled
    let final_prediction = if LINFA_ENABLED {
        self.predict_with_ml(historical as f32, trend_score as f32).await?
    } else {
        blended
    };

    // Return with confidence
    PredictPerformanceResponse {
        prediction: final_prediction,     // e.g., 0.78 (78% likely to pass)
        confidence: 0.85,                 // Model certainty
    }
}
```

**Weakness Detection (BKT Gaps):**

```rust
// From recommendations/service.rs - build_user_profile()
let bkt_rows = sqlx::query!(
    r#"
    SELECT t.name, uss.p_known
    FROM user_skill_states uss
    JOIN topics t ON uss.skill_id = t.id
    WHERE uss.user_id = $1
    ORDER BY uss.p_known DESC
    "#,
    user_id
)
.fetch_all(pool)
.await?;

if !bkt_rows.is_empty() {
    obs_metrics::inc_bkt_gaps_derived();  // Increment counter for observability
    
    let mut strengths = Vec::new();
    let mut weaknesses = Vec::new();
    
    for row in bkt_rows {
        if row.p_known > 0.7 {
            strengths.push(row.name);  // "You know this well"
        } else if row.p_known < 0.5 {
            weaknesses.push(row.name); // "You need to improve this"
        }
    }
}

// Result: UserProfile {
//   strengths: ["Anatomy", "Physiology"],
//   weaknesses: ["Pharmacology", "Biochemistry"],
// }
```

### Critical Gap: Analytics Don't Block Anything

**Current state:**
- ✅ All calculations happen (BKT, prediction, recommendation scores)
- ❌ Results are **informational only** — displayed in dashboards
- ❌ No decision authority — recommendation score 0.95 doesn't override user's chosen path
- ❌ No escalation — p_known < 0.3 doesn't trigger instructor notification
- ❌ No blocking — student can proceed to next topic even if prerequisite p_known < 0.5

**Example scenario:**

```
Student attempts pharmacology quiz:
1. Scores 40% (fails)
2. BKT updates: p_known = 0.35 (down from 0.5)
3. Rust calculates: weakness detected
4. Dashboard shows: "Pharmacology: 35% confidence"
5. Frontend displays: "You may need more review"
6. Student response: *clicks next unit anyway*
7. System response: ✅ Allowed! (no blocking)
8. Result: Student proceeds unprepared, fails clinical case
```

---

## 8. Recommendation Engine Authority

### Current State

```prisma
Recommendation {
  userId, recommendedUnitId, sourceUnitId
  score: Float
  reason: String
  algorithm: String  // e.g., "Linfa Classifier", "Burn Embeddings"
  isDismissed: Boolean
  isEngaged: Boolean  // Did user follow the recommendation?
  createdAt, updatedAt
}

StudentInteraction {
  userId, unitId
  interactionType: String  // "viewed", "completed", "skipped", "liked", "recommended_and_viewed"
  score: Float  // Strength/sentiment
}
```

**Rust analytics service** provides:
- GetRecommendationsUseCase → returns top N recommendations
- LearningAnalyticsService → generates study recommendations via gRPC

### Critical Gap (Status: Resolved March 09, 2026)

- [x] **Recommendations Integrated with Gating**: `PrescriptiveAnalyticsService` now uses recommendation scores to trigger blocking or support.
- [x] **Escalation Logic**: Instructor notifications triggered when critical remediations are ignored.
- [x] **Explainability**: Every recommendation now includes an `explanation` array.

### Answer to Question 8 (Status: Resolved March 09, 2026)

**Authority depends on recommendation type.**

| Type | Source | Overridable? | Authority |
|------|--------|------------|-----------|
| **Content gap** | Analytics (skill state < 0.6) | No | System blocks progress |
| **Study sequence** | Prerequisite model | No | System enforces dependency |
| **Material suggestion** | Peer trends, collaborative filtering | Yes (with friction) | Shows notification, logs dismissal |
| **Study group invite** | Peer benchmarking | Yes (easy) | Recommendation UI only |
| **Deadline extension** | Performance trend | Yes (requires instructor) | Requires decision |

### Recommendation

```typescript
interface RecommendationPolicy {
  type: 'BLOCKING' | 'STRONG' | 'SOFT';
  
  // BLOCKING: Cannot proceed without resolving
  // e.g., skill state < 0.5 blocks next topic unlock
  
  // STRONG: Can override but triggers escalation
  // e.g., 3 dismissals → instructor notification
  
  // SOFT: Pure suggestion
  // e.g., study group invite
}

// Track ignores:
model RecommendationResponse {
  recommendationId: String;
  userId: String;
  action: 'accepted' | 'dismissed' | 'snoozed';
  reason?: String;  // User-provided reason for dismissal
  respondedAt: DateTime;
}

// Rule: If same recommendation dismissed 3x, escalate to instructor
```

---

## 9. Personalization Ceiling

### Current State

Personalization is **deep but undefined:**

```prisma
// Every user has:
Progress[] // Per-topic progress
CourseProgress[] // Per-course progress
UserSkillState[] // Per-skill BKT state
LearningGoal[] // Personal goals
LearningSuggestion[] // Personalized material suggestions
UserFlashcardProgress[] // Personal spaced repetition
```

### Critical Gap

- ✅ **Individual progress tracked** (highly personalized)
- ❌ **Harm not addressed:** Student who avoids weak topics won't see them → bias reinforcement
- ❌ **Exam alignment loss:** If two students in same course see different topics, they may miss exam-critical material
- ❌ **No cohesion model:** When does personalization become fragmentation?

### Example Scenario

Student A (weak in pharmacology) vs Student B (strong in pharmacology):
- **Current system:** Recommends pharmacology less to A, more to B
- **Harm:** A falls further behind, misses board exam questions
- **Exam alignment:** Both must know same pharmacology concepts for licensing exam

### Answer to Question 9

**Personalization must preserve exam alignment.**

| Scope | Personalizable | Fixed |
|-------|----------------|-------|
| **Learning sequence** | Yes (skip if prereq passed) | Core concepts immutable |
| **Study materials** | Yes (difficulty, format) | Exam topics mandatory |
| **Quiz difficulty** | Yes (adaptive) | Core question bank shared |
| **Pace** | Yes (deadline extensions) | Exam date fixed |
| **Practice priority** | Yes (weak topics first) | Can't skip weak topics |

### Recommendation

```typescript
interface CourseStructure {
  mandatory: {
    topics: TopicId[];      // Must be covered by all students
    assessments: QuizId[];  // Must be passed by all students
    minimumScore: 70;
  };
  
  flexible: {
    supplementalMaterials: MaterialId[];  // Personalized
    enrichmentQuizzes: QuizId[];  // Optional
    paceDeadlines: DateTime[];  // Extendable
  };
}

// Rule: Cannot recommend skipping a mandatory topic
// Rule: Cannot make mandatory assessment optional
// Rule: Personalization ≠ fragmentation
```

---

## 10. Offline vs Online Truth

### Current State

```prisma
// Frontend tracks:
CourseProgress (lastUpdated: BigInt)  // Client timestamp for conflict resolution
UnitProgress (lastUpdated: BigInt)
Progress (lastUpdated: BigInt)
```

Schema shows **last_updated** timestamps (milliseconds) for conflict resolution, but:

### Critical Gap

- ✅ **Offline-first architecture noted** (lastUpdated field)
- ❌ **Reconciliation strategy not implemented:** 
  - What if offline notes and online quiz conflict?
  - Which wins?
- ❌ **Local-only data unmarked:** Which data is never allowed offline?
- ❌ **Sync strategy undefined:** Full sync? Differential? Operational transformation?

### Answer to Question 10

**Rules for conflict resolution:**

| Data Type | Offline Allowed? | Conflict Rule | Authority |
|-----------|-----------------|---------------|-----------|
| **Quiz attempts** | No | Server always wins | Quiz immutable once submitted |
| **Progress updates** | Yes (local) | Merge by timestamp | Newer update wins |
| **Notes** | Yes | Both-way merge | Operational transform or CRDT |
| **User profile** | No | Server wins | Prevents impersonation |
| **Analytics events** | Yes (batch later) | Accumulate, don't conflict | All events logged |

### Recommendation

Add sync strategy:

```prisma
model SyncLog {
  id: String @id
  userId: String
  action: 'upsert' | 'delete' | 'conflict'
  table: String  // e.g., 'progress', 'note'
  recordId: String
  clientTimestamp: BigInt
  serverTimestamp: DateTime
  resolution: 'client_wins' | 'server_wins' | 'merged'
  conflictDetectedAt: DateTime?
  createdAt: DateTime
}

// Rule: Never allow offline-only quiz submission
// Rule: Never allow offline-only user profile change
```

---

## 11. Feedback Loops

### Current State

**Minimal feedback infrastructure:**

```prisma
Quiz {
  showResults: Boolean
  feedback: Json?  // Possible, but optional
}

QuizAttempt {
  feedback: Json?  // Optional feedback per attempt
}

CaseAttempt {
  feedback: Json?
}
```

### Critical Gap

- ✅ **Feedback can be generated** (ClinicalCasesService.generateFeedback)
- ❌ **No student → instructor channel:** Students can't flag bad questions
- ❌ **No instructor override:** Instructors can't correct system mistakes
- ❌ **No correction speed:** If a question is wrong, how fast does it affect recommendations?
- ❌ **No authority model:** Whose feedback matters? (Student < Instructor < Curriculum Designer)

### Answer to Question 11

**Learning systems need fast correction loops.**

```typescript
interface Feedback {
  id: string;
  target: 'Question' | 'Quiz' | 'Material' | 'Recommendation';
  targetId: string;
  
  // From whom?
  submittedBy: {
    userId: string;
    role: 'student' | 'instructor' | 'admin';
  };
  
  // What's wrong?
  issue: 'Ambiguous' | 'Incorrect' | 'Outdated' | 'Inappropriate' | 'Other';
  description: string;
  
  // Resolution
  status: 'pending' | 'acknowledged' | 'fixed' | 'rejected';
  resolvedBy?: string;  // Instructor ID
  resolutionNotes?: string;
  resolvedAt?: DateTime;
}

// Trigger: If 5+ students report same question issue, auto-flag for instructor review
```

### Recommendation

Implement feedback intake and escalation:

1. **Student → Flag question** (1 minute to submit)
2. **System aggregates** (5+ same flag = issue detected)
3. **Instructor notified** (immediately if issue confirmed)
4. **Instructor actions**: Hide question, mark irrelevant, update explanation
5. **Analytics updated** (next recommendation run excludes flagged questions)

---

## 12. Longitudinal Memory

### Current State

```prisma
LearningHistory {
  userId, materialId, category, type
  score, duration, difficulty
  timestamp: DateTime  // When interaction occurred
}

UserLearningAnalytics {
  strongestSubjects, weakestSubjects  // Current snapshot
  completionRate, averageScore
  longestStreak, currentStreak
}

UserSkillState {
  pKnown: Float  // BKT probability of knowing
  lastUpdated: DateTime
  attempts: Int
}
```

### Critical Gap

- ✅ **Historical data stored** (LearningHistory, UserSkillState.lastUpdated)
- ❌ **No longitudinal aggregation:** System doesn't know "Year 1 cardiology weakness → Year 4 clinical mistake"
- ❌ **No chronic misconception detection:** If student gets same concept wrong 5x across 2 years, nobody flags it
- ❌ **No curriculum coherence check:** What if Year 4 assumes Year 2 knowledge that student failed?

### Example Scenario

Student A:
- **Year 1:** Failed pharmacokinetics quiz 2x, barely passed with 71%
- **Year 2:** Passed advanced pharmacotherapy quiz 88% (but misses half the CYP450 questions)
- **Year 4:** Clinical case: incorrect drug dosage → failed, but root cause undetected

→ System has no way to say: "This Year 4 failure is likely due to Year 1 knowledge gap in pharmacokinetics."

### Answer to Question 12

**MedTrack dominates by detecting hidden weakness chains.**

```typescript
interface LongitudinalSkillTrajectory {
  userId: string;
  skillId: string;  // Topic/skill
  
  // Timeline
  firstAttemptDate: DateTime;
  lastAttemptDate: DateTime;
  
  // Historical states
  timeline: {
    date: DateTime;
    pKnown: number;  // BKT state at time
    score?: number;
    source: 'quiz' | 'case' | 'exam';
  }[];
  
  // Trend analysis
  trend: 'improving' | 'stable' | 'declining';
  volatility: number;  // How much does performance vary?
  
  // Chronic weakness flag
  isChroniclyWeak: boolean;  // pKnown < 0.7 for > 1 year
  chronicWeaknessStartDate?: DateTime;
  relatedHigherOrderTopics: string[];  // Topics that depend on this
  
  // Predictor
  riskOfFailureInDependent: number;  // Likelihood of failing topics that depend on this
}

// Trigger: Every Year 4 quiz attempt, check prerequisite skill trajectories
// If prerequisite is chronically weak, flag in clinical feedback
```

### Recommendation

Implement longitudinal analysis:

1. **Track skill trajectory** (not just current pKnown)
2. **Detect weakness chains** (if Year 1 skill weak → Year 4 failure likely)
3. **Surface historical context** in clinical case feedback
4. **Generate preventive alerts** (if diagnostic skill weak, flag clinical cases that need it)

---

## 13. Ethical Guardrails

### Current State

**Prediction exists but safeguards are undefined:**

```prisma
UserLearningAnalytics {
  predictedSuccessRate: Float?
}

// Backend calculates:
// - Assessment predictions (AIAnalyticsService.getAllAssessmentPredictions)
// - Study patterns
// - Performance trends
```

### Recommendation: Bridge the Gap (Rust → NestJS → UI Decision Loop)

**Current flow:**
```
Rust ┈┈→ Calculates ┈┈→ Metrics ┈┈→ Dashboard ┈┈→ Student sees it ┈┈→ [Optional] Student acts
                     (ends here)
```

**Needed flow:**
```
Rust → Calculates → Metrics → NestJS → Evaluates → DECISION → Blocks/Forces → UI Response
                                      (new)      (new)       (new)
```

**Implementation (Add to NestJS Backend):**

```typescript
// New service: prescriptive-analytics.service.ts
@Injectable()
export class PrescriptiveAnalyticsService {
  async evaluateGates(userId: string, topicId: string) {
    // Before unlocking next topic, check:
    const p_known = await this.getSkillState(userId, topicId);
    
    if (p_known < 0.5) {
      // GATE: Block progress
      return {
        canProceed: false,
        reason: 'Skill confidence too low',
        requiredAction: 'Review material or retake quiz',
        offerSupport: ['Suggest study group', 'Offer tutoring', 'Extend deadline'],
      };
    }
    
    if (p_known < 0.7) {
      // GATE: Warn but allow
      return {
        canProceed: true,
        warning: 'Borderline confidence - consider review',
        reason: 'Skill confidence is 65%',
      };
    }
    
    // GATE: Pass
    return { canProceed: true };
  }

  async checkRecommendationAuthority(userId: string) {
    // Has user ignored same recommendation 3x?
    const dismissals = await this.prisma.recommendationResponse.count({
      where: {
        userId,
        action: 'dismissed',
        recommendation: { algorithm: 'weakness_remediation' },
      },
    });

    if (dismissals >= 3) {
      // ESCALATION: Notify instructor
      await this.notificationService.notifyInstructor(userId, {
        type: 'IGNORED_CRITICAL_RECOMMENDATION',
        message: `${userId} dismissed weakness remediation 3x. Manual intervention needed.`,
      });
    }
  }

  async checkPerformanceThreshold(userId: string, topicId: string) {
    const prediction = await this.getPerformancePrediction(userId, topicId);
    
    if (prediction.likelihood_of_pass < 0.6) {
      // ALERT: Low success likelihood
      return {
        level: 'HIGH',
        message: '60% chance of failure on assessment',
        action: 'Provide support options',
      };
    }
  }
}

// In quiz.controller.ts - Before allowing next topic unlock:
async unlockNextTopic(userId: string, topicId: string) {
  const gate = await this.prescriptiveAnalytics.evaluateGates(userId, topicId);
  
  if (!gate.canProceed) {
    throw new ForbiddenException(gate.reason);
    // UI shows: "You need 50%+ confidence before proceeding"
  }
  
  // Allow unlock
  return this.topicService.unlockNextTopic(userId, topicId);
}
```

### Critical Gap (Status: Resolved March 09, 2026)

- [x] **Confidence Intervals**: Rust service now returns low/high bounds for predictions.
- [x] **Support Pairing**: Every "at-risk" prediction is paired with `supportOptions`.
- [x] **Explanation**: `explanation` field added to prescriptive responses.

### Answer to Question 13 (Status: Resolved March 09, 2026)

**Predictions must include uncertainty and actionability.**

```typescript
interface PredictedOutcome {
  prediction: {
    value: number;  // e.g., 0.65 (65% pass probability)
    confidence: number;  // e.g., 0.78 (78% model certainty)
    range: [number, number];  // [0.55, 0.75] – likely range
  };
  
  // Transparency
  factors: {
    factor: string;  // e.g., "quiz_performance"
    weight: number;  // How much did this contribute?
    direction: 'positive' | 'negative';
  }[];
  
  // Actionability
  ifCurrent: string;  // "If you maintain current pace, you'll likely pass."
  ifYouDoThis: [
    { action: string; newPrediction: number },  // "Review pharmacology: 78%"
    { action: string; newPrediction: number },  // "Study 2 hrs/day: 82%"
  ];
  
  // Gatekeeping
  visibility: {
    showToStudent: boolean;
    showToInstructor: boolean;
    showToAdvisor: boolean;
  };
  
  // Support
  recommendedSupport: string[];  // "Tutor", "Study group", "Office hours"
}

// Rule: Never show failure prediction without suggesting path to success
// Rule: Always include uncertainty range, not point estimate
// Rule: Predictions update weekly, not daily (prevent anxiety from noise)
```

### Recommendation

1. **Add confidence intervals** to all predictions
2. **Pair every "at risk" with support** (tutor, peer group, instructor meeting)
3. **Gate predictions by role:** Students see confidence intervals; instructors see raw probabilities
4. **Audit for bias:** Check prediction accuracy by gender, age, socioeconomic background
5. **Limit prediction frequency:** Update weekly, not daily (reduce anxiety)

---

## 14. Final Boss Question (Non-Negotiable)

### The Question

If you removed:
- Flashcards
- Chat / AI tutor
- Community / study groups
- Gamification (points, streaks, badges)

Would MedTrack still **measurably improve exam outcomes**?

### Current State

**Your core thesis:**
1. Materials (lectures, slides, PDFs in R2)
2. Assessments (quizzes, clinical cases)
3. Personalized learning paths (based on skill state)
4. Analytics (performance dashboards)

**Accessories** (nice-to-have):
- Flashcards (spaced repetition)
- Chat (AI tutor, peer discussion)
- Study groups (social learning)
- Gamification (motivation)

### Honest Assessment

| Component | Core? | Evidence of Outcome Impact? |
|-----------|-------|---------------------------|
| **Learning paths** | ✅ Yes | Partial (path structure exists, but effectiveness unvalidated) |
| **Adaptive quizzes** | ✅ Yes | Partial (adaptive logic in code, but learning gain not measured) |
| **Materials + quizzes** | ✅ Yes | Assumed (no A/B test proving this alone improves outcomes) |
| **Flashcards** | ❌ No | Unvalidated (spaced repetition implemented but no outcome metric) |
| **Chat/AI tutor** | ❌ No | Unvalidated (generates responses, but impact unknown) |
| **Study groups** | ❌ No | Unvalidated (social feature, no outcome metrics) |
| **Gamification** | ❌ No | Likely harmful (if drives test-taking at expense of learning) |

### Answer to Question 14

**Your core is sound, but you haven't proven it works.**

**What you need:**

```typescript
interface OutcomeMetric {
  // Primary metric: Exam performance
  examScore: number;
  passRate: boolean;
  
  // Secondary: Retention
  retentionAt3Months: number;  // Can student recall after exam?
  
  // Causality: Correlation to MedTrack activity
  correlations: {
    quizPerformance_to_examScore: number;  // R-squared
    materialsAccessed_to_examScore: number;
    masteryUnlocked_to_examScore: number;
  };
}

// Randomized control trial:
// Group A: Materials + personalized quizzes (no flashcards, chat, etc.)
// Group B: Full MedTrack (all features)
// Hypothesis: No statistical difference in exam outcomes
// → If true: Strip down to core, double down on what works
```

### Recommendation

**Do a brutal audit:**

1. **Identify core** (what actually improves outcomes?)
   - Run correlation analysis: Which interactions predict exam success?
   - Example: Does time spent on flashcards correlate with exam score? (If yes, core; if no, accessory)

2. **Validate core** (prove it works)
   - A/B test: Group with core-only vs. current system
   - Measure: Exam score, retention, time to competence

3. **Cut accessories** (if unvalidated)
   - Flashcards: Keep only if spaced repetition metrics show learning gain
   - Chat: Keep only if correlates with exam performance
   - Gamification: Remove if causes anxiety or test-taking without learning

4. **Simplify ruthlessly**
   - If chat doesn't improve outcomes, it's tech debt
1.  **Identify core** (what actually improves outcomes?)
    - Run correlation analysis: Which interactions predict exam success?
    - Example: Does time spent on flashcards correlate with exam score? (If yes, core; if no, accessory)

2.  **Validate core** (prove it works)
    - A/B test: Group with core-only vs. current system
    - Measure: Exam score, retention, time to competence

3.  **Cut accessories** (if unvalidated)
    - Flashcards: Keep only if spaced repetition metrics show learning gain
    - Chat: Keep only if correlates with exam performance
    - Gamification: Remove if causes anxiety or test-taking without learning

4.  **Simplify ruthlessly**
    - If chat doesn't improve outcomes, it's tech debt
    - If flashcards are nice but not essential, they're a distraction
    - Focus everything on: **confusion → exam ready**

---

## SECTION B: COURSES, MATERIALS, GOALS & DASHBOARDS – Applying Prescriptive Analytics (Implemented March 09, 2026)

Your system has four critical user-facing surfaces that are **descriptive-only** and could benefit from the same prescriptive patterns used for quiz gating:

### 1. COURSES SERVICE – Status: Prescriptive Gates Implemented

**Current Implementation** (`courses.service.ts`, 1469 lines):

```typescript
// What it does:
async enrollInCourse(userId: string, courseId: string): Promise<void> {
  // Creates CourseEnrollment record
  // Status: 'active', 'completed', 'dropped', 'suspended'
  // No prerequisites checked, no analytics consulted, no gates enforced
}

async getCourseRecommendations(userId: string): Promise<Course[]> {
  // Returns courses sorted by popularity/relevance
  // But nowhere does it say: "You can't take Pharmacology II without passing Pharmacology I"
  // Or: "Your performance predicts 40% pass rate; consider these prerequisites first"
}
```

**Current Gap:**
- ✅ Course hierarchy exists (Course → Units → Topics → Materials)
- ✅ Prerequisites defined in schema (Course.prerequisites)
- ❌ **Prerequisites not enforced** — student can enroll in anything
- ❌ **No analytics override** — recommendation scores don't affect enrollment order
- ❌ **No success prediction** — system doesn't warn if student likely to fail

**Applied Pattern: Prescriptive Course Enrollment**

```typescript
// NEW: Add to courses.service.ts
@Injectable()
export class PrescriptiveCourseService {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly analyticsService: LearningAnalyticsService,
    private readonly masterygateService: MasteryGateService,
  ) {}

  // Gate 1: Check prerequisites
  async validateEnrollmentGate(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { prerequisites: true },
    });

    if (!course.prerequisites.length) {
      return { canEnroll: true };  // No prerequisites
    }

    // Check if student has completed all prerequisites
    const prerequisitesMet = await Promise.all(
      course.prerequisites.map(async (prereq) => {
        return this.masterygateService.hasCompletedCourse(userId, prereq.id);
      }),
    );

    if (!prerequisitesMet.every(Boolean)) {
      return {
        canEnroll: false,
        reason: 'Incomplete prerequisites',
        completedPrereqs: prerequisitesMet.filter(Boolean).length,
        totalRequired: course.prerequisites.length,
        missingCourses: course.prerequisites
          .filter((_, idx) => !prerequisitesMet[idx])
          .map((c) => c.name),
        nextAction: `Complete ${course.prerequisites.map(c => c.name).join(', ')} first`,
      };
    }

    // Gate 2: Check success likelihood
    const prediction = await this.analyticsService.predictCourseSuccess(userId, courseId);

    if (prediction.likelihood < 0.4) {
      return {
        canEnroll: true,
        warning: 'HIGH_RISK',
        likelihood_of_success: prediction.likelihood,
        reason: 'Your profile suggests only 40% chance of passing',
        recommendations: [
          'Consider prerequisite review materials',
          'Schedule tutoring before enrollment',
          'Review peer success factors in course feedback',
        ],
      };
    }

    // Gate 3: Check workload capacity
    const currentWorkload = await this.analyticsService.getUserWorkload(userId);
    if (currentWorkload.hoursPerWeek > 20) {
      return {
        canEnroll: true,
        warning: 'OVERLOAD',
        currentWorkload: currentWorkload.hoursPerWeek,
        estimatedCourseHours: course.estimatedHours / (course.durationWeeks || 16),
        reason: 'Adding this course exceeds recommended study load',
        action: 'Consider deferring course or reducing other commitments',
      };
    }

    return { canEnroll: true, prediction, workload: currentWorkload };
  }

  // Enhanced: Ranking courses by success probability
  async getRankedCourseRecommendations(userId: string): Promise<RankedCourseDto[]> {
    const eligibleCourses = await this.coursesService.findAll({
      where: { status: 'published' },
    });

    // Rank each by success likelihood + relevance + engagement fit
    const rankedWithPredictions = await Promise.all(
      eligibleCourses.map(async (course) => {
        const gate = await this.validateEnrollmentGate(userId, course.id);
        const prediction = await this.analyticsService.predictCourseSuccess(userId, course.id);
        const relevance = await this.analyticsService.scoreRelevance(userId, course.id);

        return {
          ...course,
          enrollment_score: {
            canEnroll: gate.canEnroll,
            successLikelihood: prediction.likelihood,
            relevanceScore: relevance.score,
            workloadRisk: gate.workload?.hoursPerWeek ?? 0,
            finalScore: prediction.likelihood * 0.5 + relevance.score * 0.3 + 
                       (gate.canEnroll ? 1.0 : 0.0) * 0.2,
          },
          reasons: {
            success: prediction.explanation,
            relevance: relevance.explanation,
          },
        };
      }),
    );

    // Sort by enrollment_score.finalScore descending
    return rankedWithPredictions.sort((a, b) => 
      b.enrollment_score.finalScore - a.enrollment_score.finalScore
    );
  }
}
```

---

### 2. MATERIALS SERVICE – Currently: Passive content serving

**Current Implementation** (`materials.service.ts`, 1354 lines):

```typescript
// What it does:
async findOne(id: string): Promise<Material> {
  // Returns material metadata + file URL
  // No indication of: prerequisite knowledge, difficulty alignment, learning path fit
}

async trackView(id: string, userId: string, page?: number): Promise<void> {
  // Logs that user viewed the material
  // But: doesn't evaluate if material was *appropriate* for user's level
  // And: doesn't flag if user is struggling with prerequisites
}
```

**Current Gap:**
- ✅ Materials linked to Topics
- ✅ Materials have difficulty/type (lecture, video, quiz, case study)
- ✅ View tracking exists (MaterialViewEvent)
- ❌ **No prerequisite checking** — student sees material regardless of skill readiness
- ❌ **No adaptive sequencing** — materials shown in creation order, not learning order
- ❌ **No struggle detection** — if student views 10 minutes and leaves, no intervention

**Applied Pattern: Prescriptive Material Sequencing**

```typescript
// NEW: Add to materials.service.ts
@Injectable()
export class PrescriptiveMaterialService {
  constructor(
    private readonly materialsService: MaterialsService,
    private readonly analyticsService: LearningAnalyticsService,
    private readonly learningPathService: LearningPathsService,
  ) {}

  // Gate 1: Check prerequisite materials
  async validateMaterialReadiness(userId: string, materialId: string) {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      include: {
        topic: { include: { prerequisites: true } },
      },
    });

    // Check if prerequisites are satisfied
    const prerequisiteSkills = material.topic.prerequisites.map((p) => p.skillId);
    const userSkillStates = await this.analyticsService.getUserSkillStates(userId, prerequisiteSkills);

    const unreadySkills = userSkillStates.filter((s) => s.p_known < 0.6);

    if (unreadySkills.length > 0) {
      return {
        canAccess: false,
        reason: 'Prerequisites not satisfied',
        unreadySkills: unreadySkills.map((s) => ({
          skill: s.skillName,
          currentConfidence: s.p_known,
          requiredConfidence: 0.6,
          gapSize: 0.6 - s.p_known,
        })),
        recommendedNextSteps: [
          `Review materials for ${unreadySkills[0].skillName}`,
          'Take prerequisite quiz to build confidence',
          'Ask for tutoring support before proceeding',
        ],
      };
    }

    // Gate 2: Check difficulty match
    const userProfile = await this.analyticsService.getUserProfile(userId);
    const difficultyFit = this.evaluateDifficultyMatch(
      material.difficulty,
      userProfile.preferredDifficulty,
    );

    if (difficultyFit === 'TOO_HARD') {
      return {
        canAccess: true,
        warning: 'DIFFICULTY_MISMATCH',
        recommendation: 'This material is harder than your profile suggests. Start with an easier version first.',
        easierAlternatives: await this.findAlternativeMaterials(materialId, 'easier'),
      };
    }

    if (difficultyFit === 'TOO_EASY') {
      return {
        canAccess: true,
        suggestion: 'This material might be too easy. Consider a more challenging version.',
        harderAlternatives: await this.findAlternativeMaterials(materialId, 'harder'),
      };
    }

    return { canAccess: true, difficultyFit, recommendation: 'Perfect fit for your level' };
  }

  // Enhanced: Adaptive material sequencing
  async getAdaptiveMaterialSequence(userId: string, topicId: string): Promise<Material[]> {
    const allMaterials = await this.prisma.material.findMany({
      where: { topicId },
      include: { topic: true },
    });

    const userProfile = await this.analyticsService.getUserProfile(userId);
    const userSkillState = await this.analyticsService.getUserSkillState(userId, topicId);

    // Score each material by:
    // 1. Difficulty match (prefer materials closest to user's capability)
    // 2. Learning path position (prerequisites first)
    // 3. Format preference (if user learns better via video vs. text)
    // 4. Engagement likelihood (if user often skips certain formats)

    const scoredMaterials = allMaterials.map((material) => {
      const difficultyScore = 1 - Math.abs(
        this.normalizeScore(material.difficulty) - 
        this.normalizeScore(userProfile.preferredDifficulty)
      );

      const sequenceScore = material.sequenceOrder ? 
        (1 / material.sequenceOrder) : 0.5;  // Earlier in sequence = higher priority

      const formatScore = userProfile.preferredFormats?.includes(material.type) ? 1.0 : 0.5;

      const engagementScore = userProfile.engagementByFormat?.[material.type] ?? 0.5;

      const finalScore = 
        difficultyScore * 0.35 +
        sequenceScore * 0.30 +
        formatScore * 0.20 +
        engagementScore * 0.15;

      return { material, score: finalScore };
    });

    // Return sorted by score
    return scoredMaterials
      .sort((a, b) => b.score - a.score)
      .map((s) => s.material);
  }

  // Struggle detection: When student views but doesn't engage
  async detectAndRespondToStruggle(
    userId: string,
    materialId: string,
    engagementMetrics: {
      timeSpentSeconds: number;
      scrollPercentage: number;
      questionsAttempted: number;
      quizScorePctg: number;
    },
  ) {
    // Heuristic: If spent < 5 min on 20-min video, likely struggling
    const expectedEngagement = await this.estimateExpectedEngagement(materialId);
    const actualEngagement = engagementMetrics.timeSpentSeconds;

    const engagementGap = 1 - (actualEngagement / expectedEngagement.recommendedSeconds);

    if (engagementGap > 0.5) {  // Spent < 50% of expected time
      // TRIGGER: Struggle detected
      await this.notifyOfStruggle(userId, materialId, {
        recommendation: 'Offer alternative format',
        action: 'Flag for instructor review',
        escalation: true,
      });
    }

    if (engagementMetrics.quizScorePctg < 60) {
      // TRIGGER: Low comprehension
      await this.offerSupport(userId, {
        type: 'LOW_COMPREHENSION',
        material: materialId,
        actions: [
          'Suggest tutoring session',
          'Offer peer study group',
          'Provide supplemental materials',
        ],
      });
    }
  }

  private evaluateDifficultyMatch(
    materialDifficulty: string,
    userPreference: string,
  ): 'PERFECT' | 'TOO_EASY' | 'TOO_HARD' {
    const scale = { easy: 1, medium: 2, hard: 3 };
    const diff = Math.abs(scale[materialDifficulty] - scale[userPreference]);
    if (diff === 0) return 'PERFECT';
    if (materialDifficulty === 'easy') return 'TOO_EASY';
    return 'TOO_HARD';
  }

  private normalizeScore(difficulty: string): number {
    const scale = { easy: 0.33, medium: 0.66, hard: 1.0 };
    return scale[difficulty] ?? 0.66;
  }
}
```

---

### 3. LEARNING GOALS SERVICE – Status: Prescriptive Logic Implemented

**Current Implementation** (`learning-goals.service.ts`, 1066 lines):

```typescript
// What it does:
async create(createDto: CreateLearningGoalDto, userId: string): Promise<LearningGoal> {
  // Creates goal record (title, description, targetDate, priority)
  // No evaluation of: reasonableness, completability, conflict with other goals
}

async getAnalytics(userId: string): Promise<GoalAnalyticsData> {
  // Returns: {totalGoals, completedGoals, activeGoals, overdue}
  // But: doesn't explain *why* goals are failing (weak foundation, poor schedule, etc.)
}
```

**Current Gap:**
- ✅ Goals created with title, category, priority, deadline
- ✅ Goals linked to courses
- ✅ Goal progress tracked
- ✅ Smart suggestions exist (SMART analysis)
- ❌ **Goals never blocked** — impossible deadlines allowed
- ❌ **No conflict detection** — can create 10 goals all due Friday
- ❌ **No feasibility analysis** — no check if goal is achievable given skill state
- ❌ **Overdue goals ignored** — no escalation, just marked as "overdue"

**Applied Pattern: Prescriptive Goal Management**

```typescript
// NEW: Add to learning-goals.service.ts
@Injectable()
export class PrescriptiveGoalsService {
  constructor(
    private readonly goalsService: LearningGoalsService,
    private readonly analyticsService: LearningAnalyticsService,
    private readonly progressService: ProgressService,
  ) {}

  // Gate 1: Check goal feasibility
  async validateGoalFeasibility(userId: string, goal: CreateLearningGoalDto) {
    // Is the goal even possible given the user's foundation?
    const userProfile = await this.analyticsService.getUserProfile(userId);

    // Estimate required effort (in hours)
    const estimatedEffort = this.estimateGoalEffort(goal);

    // Get available study time
    const availableCapacity = await this.analyticsService.getUserCapacity(userId);

    if (estimatedEffort > availableCapacity.hoursAvailable) {
      return {
        canCreate: true,
        warning: 'CAPACITY_EXCEEDED',
        reason: `Goal requires ${estimatedEffort}h, but you only have ${availableCapacity.hoursAvailable}h/week available`,
        suggestion: 'Extend deadline or reduce scope',
      };
    }

    // Check skill prerequisite for goal
    if (goal.courseId) {
      const requiredSkills = await this.getGoalPrerequisiteSkills(goal.courseId);
      const userSkills = await this.analyticsService.getUserSkillStates(userId, requiredSkills);
      const readySkills = userSkills.filter((s) => s.p_known >= 0.5).length;

      if (readySkills < requiredSkills.length * 0.7) {  // < 70% prerequisites ready
        return {
          canCreate: true,
          warning: 'WEAK_FOUNDATION',
          reason: `Only ${readySkills}/${requiredSkills.length} prerequisite skills ready`,
          recommendations: [
            `Focus on foundational skills first`,
            `Review prerequisite materials: ${requiredSkills.filter((r, idx) => userSkills[idx].p_known < 0.5).map(r => r.name).join(', ')}`,
          ],
        };
      }
    }

    // Gate 2: Check deadline realism
    const daysTillDeadline = Math.floor(
      (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysTillDeadline < 7) {
      return {
        canCreate: true,
        warning: 'TIGHT_DEADLINE',
        reason: `Only ${daysTillDeadline} days until deadline`,
        estimatedWorkload: `${estimatedEffort / daysTillDeadline} hours/day required`,
        isRealistic: (estimatedEffort / daysTillDeadline) <= 3,  // Assume max 3 hrs/day on one goal
      };
    }

    return { canCreate: true, feasibility: 'HIGH', estimatedEffort, availableCapacity };
  }

  // Gate 2: Detect goal conflicts
  async detectGoalConflicts(userId: string, newGoal: CreateLearningGoalDto) {
    const existingGoals = await this.prisma.learningGoal.findMany({
      where: { userId, status: ProgressStatus.active },
      include: { course: true },
    });

    // Find goals with overlapping deadlines
    const newDeadline = new Date(newGoal.targetDate);
    const conflictingGoals = existingGoals.filter((g) => {
      const gDeadline = new Date(g.targetDate!);
      const daysBetween = Math.abs(
        (newDeadline.getTime() - gDeadline.getTime()) / (1000 * 60 * 60 * 24),
      );
      return daysBetween < 7;  // Both due within 7 days
    });

    if (conflictingGoals.length > 0) {
      return {
        hasConflict: true,
        conflictingGoals: conflictingGoals.map((g) => ({
          id: g.id,
          title: g.title,
          daysUntilDeadline: Math.floor(
            (new Date(g.targetDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
          ),
        })),
        recommendation: `You have ${conflictingGoals.length} other goals due around the same time. Consider staggering deadlines.`,
      };
    }

    return { hasConflict: false };
  }

  // Enhanced: Intelligent goal recommendations
  async getRecommendedGoals(userId: string): Promise<RecommendedGoalDto[]> {
    const userProfile = await this.analyticsService.getUserProfile(userId);

    // Recommend goals based on:
    // 1. Areas where user is weak (p_known < 0.5)
    // 2. Upcoming courses user is enrolled in
    // 3. Topics that have high exam weight but low user confidence

    const weakTopics = userProfile.weaknesses;
    const upcomingCourses = await this.getUpcomingCoursesForUser(userId);

    const recommendedGoals = await Promise.all([
      ...weakTopics.map((topic) =>
        this.generateGoalForTopic(userId, topic, 'REMEDIATION'),
      ),
      ...upcomingCourses.map((course) =>
        this.generateGoalForCourse(userId, course, 'PREPARATION'),
      ),
    ]);

    return recommendedGoals.filter(Boolean);
  }

  // Escalation: When goal becomes overdue
  async handleOverdueGoal(goalId: string, userId: string) {
    const goal = await this.prisma.learningGoal.findUnique({
      where: { id: goalId },
      include: { course: true },
    });

    if (!goal) return;

    const daysPastDue = Math.floor(
      (new Date().getTime() - new Date(goal.targetDate!).getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysPastDue === 1) {
      // Day 1: Gentle reminder
      await this.notificationService.send(userId, {
        type: 'GOAL_OVERDUE_REMINDER',
        title: `Goal overdue: ${goal.title}`,
        message: 'You can still work on this goal! Extend the deadline or complete it today.',
        action: 'update_goal',
      });
    } else if (daysPastDue === 7) {
      // Day 7: Escalate to instructor
      const goalInstructor = await this.getGoalInstructor(goal.courseId);
      if (goalInstructor) {
        await this.notificationService.sendToUser(goalInstructor.id, {
          type: 'STUDENT_GOAL_OVERDUE',
          title: `${goal.user.name} - Goal overdue: ${goal.title}`,
          message: `${goal.title} has been overdue for 7 days. Consider outreach.`,
          studentId: userId,
          goalId,
        });
      }
    } else if (daysPastDue > 30) {
      // After 30 days: Auto-archive
      await this.prisma.learningGoal.update({
        where: { id: goalId },
        data: {
          status: ProgressStatus.dropped,
          completedAt: new Date(),
        },
      });

      await this.notificationService.send(userId, {
        type: 'GOAL_ARCHIVED',
        title: `Goal archived: ${goal.title}`,
        message: 'This goal has been archived after being overdue for 30 days.',
      });
    }
  }

  private estimateGoalEffort(goal: CreateLearningGoalDto): number {
    // Rough estimate: multiply course hours by goal difficulty/scope
    // This should integrate with course structure
    const baseEffort = goal.courseId ? 40 : 10;  // 40h for course, 10h for general goal
    return baseEffort;
  }

  private async getGoalPrerequisiteSkills(courseId: string): Promise<string[]> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { units: { include: { topics: true } } },
    });
    return course?.units.flatMap((u) => u.topics).map((t) => t.id) ?? [];
  }

  private async getUpcomingCoursesForUser(userId: string): Promise<Course[]> {
    return this.prisma.course.findMany({
      where: {
        enrollments: { some: { userId, status: EnrollmentStatus.active } },
      },
      // Could add logic to filter by start date if available
    });
  }

  private async generateGoalForTopic(
    userId: string,
    topic: any,
    type: 'REMEDIATION' | 'ENRICHMENT',
  ): Promise<RecommendedGoalDto | null> {
    // Generate smart goal like "Improve pharmacology confidence from 40% to 70%"
    return {
      title: `${type === 'REMEDIATION' ? 'Improve' : 'Master'} ${topic.name}`,
      description: `Goal to increase confidence in ${topic.name} from ${(topic.p_known * 100).toFixed(0)}% to 70%`,
      category: topic.category,
      priority: type === 'REMEDIATION' ? 1 : 3,
      targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),  // 2 weeks
      source: GoalRecommendationSource.ANALYTICS,
      reason: type === 'REMEDIATION' ? 
        `Your performance in ${topic.name} is below mastery level` :
        `High exam weight in ${topic.name}`,
    };
  }

  private async generateGoalForCourse(
    userId: string,
    course: Course,
    type: 'PREPARATION' | 'ENRICHMENT',
  ): Promise<RecommendedGoalDto | null> {
    return {
      title: `${type === 'PREPARATION' ? 'Prepare for' : 'Explore'} ${course.name}`,
      description: `${type === 'PREPARATION' ? 'Complete prerequisite materials and assessments before' : 'Deep dive into topics covered in'} ${course.name}`,
      category: 'Course-Related',
      priority: type === 'PREPARATION' ? 1 : 2,
      targetDate: course.startDate ? new Date(course.startDate.getTime() - 7 * 24 * 60 * 60 * 1000) : undefined,
      courseId: course.id,
      source: GoalRecommendationSource.COURSE_RECOMMENDATION,
    };
  }
}
```

---

### 4. DASHBOARD & PROGRESS SERVICE – Status: Actionable Insights Implemented

**Current Implementation** (`progress.controller.ts`, 269 lines):

```typescript
// What it does:
async getDashboardData(@Param('userId') userId: string) {
  return Promise.all([
    overview,        // Overall progress %
    courses,         // Course list with completion %
    activities,      // Recent activity log
    achievements,    // Badges earned
    peerComparison,  // Benchmark vs peers
    streaks,         // Current study streak
    deadlines,       // Upcoming deadlines
    dueReviews,      // Materials for spaced repetition
  ]);
  // Result: Student sees 8 widgets showing current state
  // But: no guidance on *what to do next* based on analytics
}
```

**Current Gap:**
- ✅ Dashboard aggregates data from 8 sources
- ✅ Peer comparison shown
- ✅ Streaks tracked
- ✅ Deadlines visible
- ❌ **No recommended actions** — dashboard is informational only
- ❌ **No risk highlighting** — overdue goals treated same as on-track
- ❌ **No prioritization** — all widgets equal importance
- ❌ **No micro-interactions** — dashboard doesn't respond to student choices

**Applied Pattern: Prescriptive Dashboard with Action Prompts**

```typescript
// NEW: Add to progress.service.ts & dashboard controller
@Injectable()
export class PrescriptiveDashboardService {
  constructor(
    private readonly progressService: ProgressService,
    private readonly analyticsService: LearningAnalyticsService,
    private readonly prescriptiveAnalytics: PrescriptiveAnalyticsService,
  ) {}

  async getPrescriptiveDashboard(userId: string): Promise<EnhancedDashboardDto> {
    // Get base dashboard data
    const baseDashboard = await this.progressService.getDashboardData(userId);

    // Enhance with prescriptive widgets: priority, warnings, actions
    return {
      // WIDGET 1: At-Risk Indicator (Priority)
      atRisk: await this.diagnoseAtRiskSituation(userId),

      // WIDGET 2: Immediate Actions (Prescriptive)
      immediateActions: await this.getImmediateActions(userId),

      // WIDGET 3: Bottleneck Detection (Prescriptive)
      bottlenecks: await this.detectBottlenecks(userId),

      // WIDGET 4-8: Enhanced versions of base dashboard with flags
      overview: { ...baseDashboard.overview, flags: [] },
      courses: await this.rankCoursesByRisk(baseDashboard.courses),
      activities: baseDashboard.activities,
      achievements: baseDashboard.achievements,
      peerComparison: baseDashboard.peerComparison,
      streaks: { ...baseDashboard.streaks, sustainabilityRisk: await this.assessStreakSustainability(userId) },
      deadlines: await this.categorizeDeadlinesByRisk(baseDashboard.deadlines),
      dueReviews: await this.rankReviewsByUrgency(baseDashboard.dueReviews),
    };
  }

  // Diagnose overall risk situation
  private async diagnoseAtRiskSituation(userId: string): Promise<AtRiskDiagnosisDto> {
    const userProfile = await this.analyticsService.getUserProfile(userId);
    const coursePredictions = await this.analyticsService.getCoursePredictions(userId);

    // Risk factors: 1) Exam predictions < 0.6, 2) Multiple overdue goals, 3) Weak foundational skills
    const riskFactors: RiskFactor[] = [];

    // Check course predictions
    const failRiskCourses = coursePredictions.filter((c) => c.passLikelihood < 0.6);
    if (failRiskCourses.length > 0) {
      riskFactors.push({
        severity: 'HIGH',
        type: 'LOW_EXAM_PREDICTION',
        courses: failRiskCourses.map((c) => ({
          id: c.courseId,
          name: c.courseName,
          prediction: c.passLikelihood,
        })),
      });
    }

    // Check overdue items
    const overdueGoals = await this.getOverdueGoals(userId);
    if (overdueGoals.length > 0) {
      riskFactors.push({
        severity: overdueGoals.length > 3 ? 'HIGH' : 'MEDIUM',
        type: 'OVERDUE_GOALS',
        count: overdueGoals.length,
        daysOverdue: Math.max(...overdueGoals.map((g) => g.daysPastDue)),
      });
    }

    // Check foundational skill decay
    const decayingSkills = userProfile.strengths.filter((s) =>
      this.hasSkillDecayed(s),
    );
    if (decayingSkills.length > 0) {
      riskFactors.push({
        severity: 'MEDIUM',
        type: 'SKILL_DECAY',
        skills: decayingSkills,
        recommendation: 'Schedule review sessions for these topics',
      });
    }

    const overallRisk = this.calculateOverallRisk(riskFactors);

    return {
      overallRisk,  // 'LOW', 'MEDIUM', 'HIGH'
      riskFactors,
      recommendedAction: this.generateRiskMitigation(riskFactors),
    };
  }

  // Get immediate actions ranked by urgency
  private async getImmediateActions(userId: string): Promise<ImmediateActionDto[]> {
    const actions: ImmediateActionDto[] = [];

    // Action 1: Take upcoming overdue quiz
    const overdueQuizzes = await this.getOverdueQuizzes(userId);
    if (overdueQuizzes.length > 0) {
      actions.push({
        priority: 'URGENT',
        type: 'TAKE_QUIZ',
        title: `Complete overdue quiz: ${overdueQuizzes[0].title}`,
        description: `Quiz for ${overdueQuizzes[0].topicName} was due ${overdueQuizzes[0].daysPastDue} days ago`,
        estimatedTime: overdueQuizzes[0].timeLimit,
        action: { type: 'NAVIGATE', target: `quiz/${overdueQuizzes[0].id}` },
      });
    }

    // Action 2: Review weak topic before upcoming assessment
    const upcomingAssessments = await this.getUpcomingAssessments(userId);
    const weakTopicsInUpcoming = await Promise.all(
      upcomingAssessments.slice(0, 1).map(async (assessment) => {
        const weakSkills = await this.getWeakSkillsForAssessment(userId, assessment.id);
        return { assessment, weakSkills };
      }),
    );

    for (const { assessment, weakSkills } of weakTopicsInUpcoming) {
      if (weakSkills.length > 0) {
        actions.push({
          priority: 'HIGH',
          type: 'REVIEW_WEAK_TOPIC',
          title: `Review before ${assessment.name}`,
          description: `You're weak in: ${weakSkills.map((s) => s.name).join(', ')}`,
          daysTillAssessment: assessment.daysUntil,
          action: { type: 'NAVIGATE', target: `study/${weakSkills[0].id}` },
        });
      }
    }

    // Action 3: Continue unfinished study session
    const unfinishedSession = await this.getUnfinishedStudySession(userId);
    if (unfinishedSession) {
      actions.push({
        priority: 'MEDIUM',
        type: 'CONTINUE_SESSION',
        title: `Continue: ${unfinishedSession.topicName}`,
        description: `You left off ${unfinishedSession.hoursAgo}h ago, ${unfinishedSession.percentComplete}% through`,
        action: { type: 'NAVIGATE', target: `study/${unfinishedSession.id}` },
      });
    }

    return actions.sort((a, b) => this.priorityScore(b) - this.priorityScore(a));
  }

  // Detect learning bottlenecks blocking progress
  private async detectBottlenecks(userId: string): Promise<BottleneckDto[]> {
    const bottlenecks: BottleneckDto[] = [];

    // Bottleneck 1: Topic preventing unit completion
    const incompleteUnits = await this.getIncompleteUnits(userId);
    for (const unit of incompleteUnits) {
      const blockingTopics = await this.findBlockingTopics(userId, unit.id);
      if (blockingTopics.length > 0) {
        bottlenecks.push({
          type: 'BLOCKING_TOPIC',
          severity: 'HIGH',
          unit: unit.name,
          blockingTopics: blockingTopics.map((t) => ({
            name: t.name,
            p_known: t.p_known,
            requiredToPass: 0.7,
            actions: ['Retake quiz', 'Get tutoring', 'Review materials'],
          })),
          impactIfUnresolved: `Cannot unlock next unit (${unit.nextUnit?.name ?? 'final assessment'})`,
        });
      }
    }

    // Bottleneck 2: Skill decay blocking future topics
    const decayingCriticalSkills = await this.findDecayingCriticalSkills(userId);
    for (const skill of decayingCriticalSkills) {
      const dependentTopics = await this.findDependentTopics(skill.id);
      if (dependentTopics.length > 0) {
        bottlenecks.push({
          type: 'SKILL_DECAY',
          severity: 'MEDIUM',
          skill: skill.name,
          currentConfidence: skill.currentP_known,
          decayRate: skill.decayRate,
          dependentTopics: dependentTopics.map((t) => t.name),
          actions: ['Schedule refresh session', 'Request study group'],
        });
      }
    }

    // Bottleneck 3: Goal dependency chain
    const dependentGoals = await this.findDependentGoals(userId);
    for (const goalChain of dependentGoals) {
      const blockedGoal = goalChain.goals.find((g) => !g.completed);
      if (blockedGoal) {
        bottlenecks.push({
          type: 'GOAL_DEPENDENCY',
          severity: 'MEDIUM',
          blockedGoal: blockedGoal.title,
          prerequisiteGoal: goalChain.goals.find((g) => g.order === blockedGoal.order - 1)?.title,
          action: 'Complete prerequisites first',
        });
      }
    }

    return bottlenecks;
  }

  // Rank courses by risk (at-risk courses first)
  private async rankCoursesByRisk(courses: any[]): Promise<any[]> {
    const coursesWithRisk = await Promise.all(
      courses.map(async (course) => {
        const prediction = await this.analyticsService.predictCourseSuccess(course.userId, course.id);
        const bottleneck = await this.hasBlockingTopic(course.userId, course.id);
        const riskScore = (1 - prediction.likelihood) * 0.6 + (bottleneck ? 0.4 : 0);
        return { ...course, riskScore, prediction, bottleneck };
      }),
    );

    return coursesWithRisk.sort((a, b) => b.riskScore - a.riskScore);
  }

  // Categorize deadlines by risk level
  private async categorizeDeadlinesByRisk(deadlines: any[]): Promise<CategorizedDeadlinesDto> {
    const now = new Date();
    return {
      urgent: deadlines.filter((d) => {
        const daysTill = (d.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysTill < 3;
      }),
      thisWeek: deadlines.filter((d) => {
        const daysTill = (d.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysTill >= 3 && daysTill < 7;
      }),
      upcoming: deadlines.filter((d) => {
        const daysTill = (d.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysTill >= 7;
      }),
      overdue: deadlines.filter((d) => d.dueDate < now),
    };
  }

  // Rank spaced repetition reviews by forgetting urgency
  private async rankReviewsByUrgency(reviews: any[]): Promise<any[]> {
    return reviews.map((review) => ({
      ...review,
      forgettingProbability: this.estimateForgettingRisk(review.lastReviewedAt, review.topic),
    })).sort((a, b) => b.forgettingProbability - a.forgettingProbability);
  }

  private calculateOverallRisk(factors: RiskFactor[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const highCount = factors.filter((f) => f.severity === 'HIGH').length;
    if (highCount > 1) return 'HIGH';
    if (highCount === 1) return 'MEDIUM';
    return 'LOW';
  }

  private priorityScore(action: ImmediateActionDto): number {
    const scoreMap = { URGENT: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
    return scoreMap[action.priority] ?? 0;
  }

  private hasSkillDecayed(skill: any): boolean {
    const daysSinceReview = Math.floor(
      (new Date().getTime() - skill.lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    // Forgetting curve: decay accelerates after 14 days
    return daysSinceReview > 14;
  }

  private estimateForgettingRisk(lastReviewed: Date, topic: any): number {
    const daysSince = Math.floor(
      (new Date().getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24),
    );
    // Exponential forgetting: risk increases exponentially
    return Math.min(1, Math.exp(-daysSince / 7) * 0.5);  // Risk = 50% at 7 days
  }

  private async hasBlockingTopic(userId: string, courseId: string): Promise<boolean> {
    const units = await this.prisma.unit.findMany({
      where: { courseId },
      include: {
        topics: {
          include: { Progress: { where: { userId } } },
        },
      },
    });

    for (const unit of units) {
      const blockedTopics = unit.topics.filter((t) => {
        const progress = t.Progress[0];
        return progress?.masteryUnlocked === false && !progress?.skipped;
      });
      if (blockedTopics.length > 0) return true;
    }

    return false;
  }

  private generateRiskMitigation(factors: RiskFactor[]): string {
    const highRiskFactor = factors.find((f) => f.severity === 'HIGH');
    if (highRiskFactor?.type === 'LOW_EXAM_PREDICTION') {
      return `Your performance suggests risk of failing exams. Schedule tutor session immediately.`;
    }
    if (highRiskFactor?.type === 'OVERDUE_GOALS') {
      return `You have ${highRiskFactor.count} overdue goals. Start with the oldest one.`;
    }
    return `You have some risks to address. See bottlenecks section below.`;
  }

  private async getOverdueGoals(userId: string): Promise<any[]> {
    const now = new Date();
    return this.prisma.learningGoal.findMany({
      where: {
        userId,
        targetDate: { lt: now },
        status: ProgressStatus.active,
      },
      select: { id: true, title: true, targetDate: true },
    }).then((goals) =>
      goals.map((g) => ({
        ...g,
        daysPastDue: Math.floor((now.getTime() - g.targetDate.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    );
  }

  private async getOverdueQuizzes(userId: string): Promise<any[]> {
    // Similar logic: fetch quizzes that were due but not completed
    return [];
  }

  private async getUpcomingAssessments(userId: string, limit: number = 3): Promise<any[]> {
    // Fetch assessments scheduled for next 30 days
    return [];
  }

  private async getWeakSkillsForAssessment(userId: string, assessmentId: string): Promise<any[]> {
    // Get skills tested in assessment, filter by user's low p_known
    return [];
  }

  private async getUnfinishedStudySession(userId: string): Promise<any> {
    // Check StudySession table for uncompleted sessions from past 7 days
    return null;
  }

  private async getIncompleteUnits(userId: string): Promise<any[]> {
    return [];
  }

  private async findBlockingTopics(userId: string, unitId: string): Promise<any[]> {
    return [];
  }

  private async findDecayingCriticalSkills(userId: string): Promise<any[]> {
    return [];
  }

  private async findDependentTopics(skillId: string): Promise<any[]> {
    return [];
  }

  private async findDependentGoals(userId: string): Promise<any[]> {
    return [];
  }

  private async assessStreakSustainability(userId: string): Promise<any> {
    // Check if current streak pace is sustainable given user's capacity
    return null;
  }
}
```

---

## SYNTHESIS: Prescriptive Analytics Pattern Applied to All User-Facing Systems

Your codebase has a consistent architecture across four critical services:

| Service | Current Pattern | Gap | Prescriptive Enhancement |
|---------|-----------------|-----|--------------------------|
| **Courses** | Enroll → track → display | No gate checking, no risk prediction | Check prerequisites + predict success + warn on overload |
| **Materials** | Serve → view → track | No readiness check, no adaptive order | Check skill prerequisites + sequence by difficulty match + detect struggle |
| **Goals** | Create → track → display | No feasibility check, no conflict detection | Validate capacity + detect conflicts + auto-escalate overdue |
| **Dashboard** | Aggregate → display → static | No recommended actions, no prioritization | Diagnose at-risk, rank by urgency, surface bottlenecks |

**Common Pattern (Apply to All Four):**

```
Descriptive (Current):  Data collected → aggregated → displayed
Prescriptive (New):     Data collected → analyzed → action recommended → user guided → system enforces
```

---

## SYNTHESIS: The One Thing MedTrack Must Do Next

You've built an impressive system. Now **make it matter**.

**Your Rust analytics microservice is doing the hard work.** It calculates:
- ✅ BKT skill knowledge states (p_known per topic)
- ✅ Performance predictions (blended historical + trend)
- ✅ Recommendation scores (multi-factor algorithm)
- ✅ Weakness detection (topics with low p_known)
- ✅ Peer benchmarking (average p_known per skill)
- ✅ Prometheus observability (metrics exposed)

**The gap:** These insights **never close the loop**. They flow into dashboards but **never block actions**.

### Core Engine (Non-Negotiable)

```typescript
type StudentJourney = {
  // Step 1: Know what's weak
  skillAssessment: UserSkillState;  // BKT p_known (from Rust)
  
  // Step 2: Learn it
  learningMaterials: Material[];  // Targeted to weakness
  learningPath: LearningPath;      // Sequenced by dependency
  
  // Step 3: Prove you know it
  quiz: Quiz;  // Topic-specific, high validity
  score: number;
  
  // Step 4: UPDATE BKT & UNLOCK OR GATE
  if (score >= passingThreshold) {
    await rustAnalytics.updateBkt(userId, topicId, true);
    p_known = 0.8;  // (example)
    masteryUnlocked = true;
    nextTopic = unlocked;
  } else {
    await rustAnalytics.updateBkt(userId, topicId, false);
    p_known = 0.35;  // (example)
    // **NEW:** Check gate before allowing next
    gate = await prescriptiveAnalytics.evaluateGates(userId, topicId);
    if (!gate.canProceed) {
      interventionTriggered = true;
      instructor_notified = true;
      next_unlock_blocked = true;  // **KEY: BLOCKING ACTION**
    }
  }
  
  // Step 5: Remember it
  review: StudySession;  // Triggered by forgetting curve (BKT decay)
  longTermRetention: true;
};
```

### What Rust Analytics Provides (Today)

| Calculation | Source | Purpose | Current Use |
|-------------|--------|---------|------------|
| **BKT p_known** | UpdateBktUseCase | Know skill confidence | Dashboard display only |
| **Performance prediction** | PredictPerformanceUseCase | Likelihood of passing | Dashboard forecast |
| **Recommendation score** | RecommendationService | Which materials to suggest | Top-10 list for UI |
| **Weakness detection** | build_user_profile() | Identify gaps | Shown in analytics |
| **Peer benchmark** | update_bkt_skill_avg_metrics() | Compare to classmates | Leaderboard |

### What's Missing

| Need | Rust Provides | NestJS Must Add | UI Must Enforce |
|------|---------------|-----------------|-----------------|
| **Blocking gates** | p_known < 0.5 ✓ | IF p_known < 0.5 → DENY next unlock | Cannot click next |
| **Escalation** | None | Recommendation dismissed 3x → Notify instructor | Notification sent |
| **Support trigger** | Prediction < 60% ✓ | IF prediction < 0.6 → Offer tutoring | "Join study group?" |
| **Decay warning** | BKT state ✓ | IF days_since_review > threshold → Trigger review | "Time to refresh?" |

### What You Need to Formalize (Next 2 Sprints)

1. **SSOT definition** (Topic is canonical, others are aggregates)
2. **Completion semantics** (Binary → Probabilistic with decay)
3. **Analytics → Decisions** (Create PrescriptiveAnalyticsService in NestJS)
   - **Wire Rust outputs to blocking gates**
   - p_known < 0.5 → Cannot unlock next topic
   - Recommendation dismissed 3x → Instructor alert
   - Performance prediction < 60% → Support offer
4. **Feedback loops** (Student/instructor corrections propagate in < 1 hour)
5. **Outcome validation** (Prove each feature improves exam performance)

### Activating Rust Analytics in the Decision Loop

**Step 1: Wire Rust gRPC calls into NestJS validators**

```typescript
// education/quizzes/quiz-completion.controller.ts
@Post(':quizId/submit')
async submitQuiz(
  @Param('quizId') quizId: string,
  @Body() submission: SubmitQuizDto,
  @Request() req,
) {
  const userId = req.user.id;
  
  // Step 1: Process quiz submission
  const attempt = await this.quizService.submitQuiz(quizId, submission);
  
  // Step 2: Call Rust to update BKT
  const topicId = attempt.quiz.topicId;
  const isCorrect = attempt.isPassed;  // Simplified; actually score >= threshold
  
  await this.analyticsService.callRust('update_bkt', {
    user_id: userId,
    skill_id: topicId,  // skill_id maps to topic
    is_correct: isCorrect,
  });
  
  // Step 3: Get updated p_known
  const p_known = await this.analyticsService.callRust('get_skill_state', {
    user_id: userId,
    skill_id: topicId,
  });
  
  // Step 4: Check gate BEFORE unlocking next
  if (p_known < 0.5 && !topicId_is_optional) {
    return {
      success: true,
      attempt,
      gate: {
        canProceed: false,
        p_known,
        reason: 'Need 50%+ confidence to proceed',
        offer: 'Review materials or take practice quiz',
      },
    };
  }
  
  // Step 5: Unlock next topic if gate passes
  if (p_known >= 0.7) {
    await this.topicService.markMasteryUnlocked(userId, topicId);
    // Also unlock next topic in sequence
    const nextTopic = await this.unitService.getNextTopic(topicId);
    if (nextTopic) {
      await this.topicService.unlock(userId, nextTopic.id);
    }
  }
  
  return {
    success: true,
    attempt,
    p_known,
    gate: { canProceed: true },
    nextTopicUnlocked: true,
  };
}
```

**Step 2: Leverage Rust performance prediction for support**

```typescript
// engagement-communication/support-trigger.service.ts
@Injectable()
export class SupportTriggerService {
  async checkAndTriggerSupport(userId: string, topicId: string) {
    // Call Rust: predict likelihood of passing next assessment
    const prediction = await this.analyticsService.callRust('predict_performance', {
      user_id: userId,
      skill_id: topicId,
    });
    
    if (prediction.likelihood_of_pass < 0.6) {
      // Trigger support offer
      await this.notificationService.send(userId, {
        type: 'SUPPORT_OFFER',
        title: 'Need Help?',
        body: `You have 60% chance of passing. Would you like to join a study group or schedule tutoring?`,
        actions: [
          { label: 'Join Study Group', action: 'study_group' },
          { label: 'Schedule Tutor', action: 'tutoring' },
          { label: 'Review Materials', action: 'review' },
        ],
      });
    }
  }
}
```

**Step 3: Escalate ignored recommendations**

```typescript
// recommendations/recommendation-tracking.service.ts
async trackDismissal(userId: string, recommendationId: string) {
  const recommendation = await this.prisma.recommendation.findUnique({
    where: { id: recommendationId },
  });
  
  // Record dismissal
  await this.prisma.recommendationResponse.create({
    data: {
      userId,
      recommendationId,
      action: 'dismissed',
      respondedAt: new Date(),
    },
  });
  
  // Count dismissals of same type
  const dismissalCount = await this.prisma.recommendationResponse.count({
    where: {
      userId,
      action: 'dismissed',
      recommendation: { reason: { contains: 'weakness' } },
    },
  });
  
  if (dismissalCount >= 3) {
    // Escalate
    await this.notificationService.notifyInstructor(
      recommendation.recommendedUnit.courseId,
      {
        type: 'ESCALATED_DISMISSAL',
        severity: 'HIGH',
        message: `Student ${userId} dismissed remediation recommendations 3x. Requires instructor follow-up.`,
        studentId: userId,
        topicId: recommendation.recommendedUnit.id,
      }
    );
  }
}
```

**Step 4: Calculate topic decay (forgetting curve) from BKT**

```typescript
// education/topic-progress/topic-decay.service.ts
async checkDecay(userId: string, topicId: string) {
  // Get BKT state age
  const skillState = await this.prisma.userSkillState.findUnique({
    where: {
      userId_skillId: { userId, skillId: topicId },
    },
  });
  
  if (!skillState) return null;
  
  const daysSinceUpdate = Math.floor(
    (Date.now() - skillState.lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Exponential decay model (Ebbinghaus forgetting curve)
  const decayRate = 0.05; // 5% decay per day
  const currentConfidence = skillState.pKnown * Math.exp(-decayRate * daysSinceUpdate);
  
  if (currentConfidence < 0.6) {
    // Suggest refresh
    await this.notificationService.send(userId, {
      type: 'REFRESH_REMINDER',
      title: `Don't forget ${topic.name}!`,
      body: `You haven't reviewed this in ${daysSinceUpdate} days. Your confidence has likely dropped.`,
      action: 'review_quiz',
    });
  }
  
  return { currentConfidence, daysSinceUpdate, isFading: currentConfidence < 0.6 };
}
```

---

### What You Can Deprecate (Next 4 Sprints)

- Redundant progress tables (merge into one Progress model)
- Flashcards (unless you prove them via learning gains)
- Gamification (unless it correlates with exam success, likely removes it)
- Chat without outcomes (AI tutor is nice, not core)

### What This Buys You

✅ **Coherent learning engine** — every feature serves one goal: exam readiness  
✅ **Defensible decisions** — "skip this topic" backed by data, not whim  
✅ **Longitudinal magic** — "this Year 1 weakness caused Year 4 failure" is detected and prevented  
✅ **Ethical AI** — predictions come with uncertainty and actionable support  
✅ **Scalability** — simplified core = easier to maintain, faster to improve  

---

## Conclusion

Your architecture is **85% there**. You have:
- ✅ Strong data model (Prisma schema is well-designed)
- ✅ Microservices foundation (NestJS + Rust analytics)
- ✅ Assessment infrastructure (quizzes, clinical cases, rubrics)
- ✅ Personalization hooks (skill states, learning paths, recommendations)

Your gap is **15% conceptual clarity**:
- ❌ No agreed-upon SSOT
- ❌ No completion definition
- ❌ Analytics don't drive behavior
- ❌ Accessories outnumber core
- ❌ Outcomes unvalidated

**Next move:** Pick ONE course, ONE semester, fully formalize it end-to-end (SSOT → completion → analytics → outcome). Then replicate the pattern.

That's how serious platforms are forged.

---

## SECTION C: Operational Review Checklist – Deep-Dive Questions & Answers

This section provides detailed answers to operational questions that refine the prescriptive analytics system. Each category maps to the services documented in Section B.

---

### 1. COURSES & ENROLLMENT: Operational Questions

| Question | Current State | Answer | Implementation Priority |
|----------|---------------|--------|------------------------|
| Are **prerequisites and success predictions updated in real-time** when a student completes a unit or a course? | ❌ No. Prerequisites are static (defined in schema). Predictions recalculate on-demand, not reactively. | **Should be event-driven.** On `UnitCompletion` event, trigger: 1) Refresh `CourseEnrollment.prerequisitesMet` for all dependent courses, 2) Recalculate success predictions via Rust gRPC call. **Latency target:** <500ms from completion to updated prediction. | HIGH |
| How do we handle **courses with optional prerequisites** or alternative learning paths? | ❌ Not modeled. Schema has `prerequisites: Course[]` but no concept of "optional" or "OR" logic. | **Add prerequisite type:** `prerequisiteType: 'required' | 'optional' | 'recommended'`. For alternatives: `prerequisiteGroups: { groupId: string, type: 'all' | 'any' }[]`. Gate logic: `if type='any' → pass if ≥1 group member completed`. | MEDIUM |
| Are **workload warnings** personalized per student schedule (e.g., part-time vs full-time)? | ⚠️ Partial. `UserLearningAnalytics.studyHoursPerWeek` exists but not integrated into course enrollment gates. | **Yes, should be.** Add `User.enrollmentType: 'full_time' | 'part_time' | 'self_paced'`. Gate formula: `maxConcurrentCredits = enrollmentType === 'full_time' ? 18 : 9`. Warn if `currentCredits + newCourse.credits > limit`. | HIGH |
| What's the **fallback** if analytics predictions fail or data is sparse? | ❌ No fallback. If Rust service times out, request fails. If data sparse, prediction = p_init (0.4). | **Tiered fallback:** 1) If Rust unavailable → use cached prediction (≤24h old), 2) If no cache → use cohort average, 3) If no cohort data → show "insufficient data" warning, allow enrollment with instructor approval. | HIGH |
| Should we **auto-suggest bridging courses/materials** before high-risk enrollments? | ❌ Not implemented. Gap identified. | **Yes.** When `validateEnrollmentGate().warning === 'HIGH_RISK'`, query: "materials where topic ∈ weak skills AND difficulty = 'bridging'". Return as `suggestedPreparation[]` in gate response. | MEDIUM |

**Implementation Notes:**

```typescript
// Event-driven prerequisite refresh
@OnEvent('unit.completed')
async handleUnitCompletion(payload: UnitCompletedEvent) {
  const { userId, unitId, courseId } = payload;
  
  // 1. Find courses where this course is a prerequisite
  const dependentCourses = await this.prisma.course.findMany({
    where: { prerequisites: { some: { id: courseId } } },
  });
  
  // 2. Refresh predictions for all dependent courses
  await Promise.all(dependentCourses.map(async (course) => {
    const prediction = await this.rustAnalytics.predictCourseSuccess(userId, course.id);
    await this.cache.set(`prediction:${userId}:${course.id}`, prediction, 86400);
  }));
}
```

---

### 2. MATERIALS & LEARNING PATHS: Operational Questions

| Question | Current State | Answer | Implementation Priority |
|----------|---------------|--------|------------------------|
| How do we **measure engagement reliably**? Only time spent? Scroll depth? Quiz scores? | ⚠️ Partial. `MaterialProgress.progress` (0-1), `MaterialViewEvent.viewCount`, `StudySession.focusScore`. Quiz correlation missing. | **Multi-signal engagement score:** `engagementScore = (timeSpent/expectedTime * 0.3) + (scrollDepth * 0.2) + (quizScorePostMaterial/100 * 0.4) + (notesCreated > 0 ? 0.1 : 0)`. Store in new `MaterialEngagement` table per user+material. | HIGH |
| Should struggle detection trigger **instant interventions**, or **batched daily/weekly suggestions**? | ❌ Not implemented. Gap from Section B. | **Tiered:** 1) **Instant** for severe struggle (engagement < 30% AND quiz fail) → push notification within 5 min, 2) **Daily digest** for moderate struggle (engagement 30-50%) → email/app notification at 9 AM, 3) **Weekly review** for minor struggle → included in "Weekly Study Report" email. | HIGH |
| How do we handle **content updates**? Will past engagement/confidence scores be recalculated? | ❌ Not handled. Material versioning absent. | **Do not recalculate historical scores.** Add `Material.version` and `MaterialProgress.materialVersion`. When material updates: 1) Increment version, 2) Mark old MaterialProgress as `isStale: true`, 3) Show "Content updated since you viewed it" badge in UI. User must re-engage to update confidence. | MEDIUM |
| Are **format preferences adaptive**? (e.g., if student suddenly prefers video over text) | ⚠️ Partial. `UserLearningAnalytics.preferredFormats` exists but static. | **Yes, make adaptive.** Calculate rolling 30-day format engagement: `currentPreference = argmax(format → avg(engagementScore) over last 30 days)`. Update `preferredFormats[]` weekly via scheduled job. If preference shift detected (new format > old by 20%), show: "We noticed you learn better from video. Want us to prioritize video materials?" | MEDIUM |
| Should we allow **manual override** for access to materials flagged as too hard or low readiness? | Gate from Section B blocks access. | **Yes, with friction.** When `validateMaterialReadiness().canAccess === false`, UI shows: "This material may be too advanced. [View Anyway] [See Easier Options]". If "View Anyway" clicked → log `MaterialOverride` event → triggers analytics flag for instructor review if >3 overrides in 7 days. | MEDIUM |

**Engagement Score Calculation:**

```typescript
// materials/engagement-scorer.service.ts
calculateEngagementScore(metrics: EngagementMetrics): number {
  const { timeSpentSeconds, expectedSeconds, scrollDepth, quizScore, notesCreated } = metrics;
  
  const timeScore = Math.min(1, timeSpentSeconds / expectedSeconds);
  const scrollScore = scrollDepth; // 0-1
  const quizFactor = quizScore !== null ? quizScore / 100 : 0.5; // Default 0.5 if no quiz
  const noteBonus = notesCreated > 0 ? 0.1 : 0;
  
  return (
    timeScore * 0.3 +
    scrollScore * 0.2 +
    quizFactor * 0.4 +
    noteBonus
  );
}
```

---

### 3. GOALS & FEASIBILITY: Operational Questions

| Question | Current State | Answer | Implementation Priority |
|----------|---------------|--------|------------------------|
| How precise is the **effort estimation** for goals? Can it dynamically update based on actual progress? | ⚠️ Rough. `estimateGoalEffort()` returns fixed 40h for course goals. | **Dynamic estimation:** Initial estimate = `course.estimatedHours * (1 - currentProgress) * (1 + (1 - avgQuizScore/100) * 0.3)`. Update weekly: if actual pace slower than estimated, increase remaining effort. If faster, decrease. Show progress: "You're 20% faster than average!" | HIGH |
| How do we handle **overlapping goals** across multiple courses or topics? | ❌ Not handled. Goals are independent entities. | **Dependency awareness:** When creating goal for Course A and Course B, check if B.prerequisites includes A. If so, warn: "Goal for B depends on completing A first. Adjust deadlines?" Suggest staggered deadlines with A completing 1 week before B. | MEDIUM |
| Are **goal recommendations** sensitive to **high-stakes exams** vs minor topics? | ❌ No. Goal recommendations treat all topics equally. | **Weight by exam impact:** Query `ExamMapping` (proposed in Question 4) to get topic → exam correlation. Goals for high-correlation topics (>0.7) get `priority: 1`, medium (0.4-0.7) get `priority: 2`, low (<0.4) get `priority: 3`. UI shows: "🔥 High-stakes: USMLE Step 1" badge. | HIGH |
| How should **goal escalation** interact with notifications: push, email, or instructor alerts? | ⚠️ Partial. Notification service exists. Escalation logic from Section B not wired. | **Tiered escalation:** Day 1 overdue → push notification, Day 3 → email with extension offer, Day 7 → instructor email CC'd, Day 14 → in-app modal blocking other actions ("You have goals needing attention"), Day 30 → auto-archive with instructor summary. | HIGH |
| Should goals be **interconnected** (dependencies) so one overdue goal automatically adjusts related goals? | ❌ Not interconnected. Goals are silos. | **Yes, cascade delays.** Add `LearningGoal.dependsOnGoalId`. When parent goal extends deadline, auto-extend child by same duration. When parent fails (archived), mark children as "blocked". UI: "⚠️ This goal depends on 'Master Pharmacology I' which is overdue." | MEDIUM |

**Goal Dependency Tree:**

```prisma
model LearningGoal {
  // ... existing fields
  dependsOnGoalId  String?        @map("depends_on_goal_id")
  dependsOnGoal    LearningGoal?  @relation("GoalDependency", fields: [dependsOnGoalId], references: [id])
  dependentGoals   LearningGoal[] @relation("GoalDependency")
  
  status           ProgressStatus @default(active)
  blockedReason    String?        // "Dependent goal 'X' is overdue"
}
```

---

### 4. DASHBOARD & PROGRESS: Operational Questions

| Question | Current State | Answer | Implementation Priority |
|----------|---------------|--------|------------------------|
| Are **risk scores and recommended actions** intuitive to students, or do they need visual cues? | ⚠️ Scores calculated. UI displays raw numbers. | **Use traffic-light encoding:** `riskScore < 0.3` → 🟢 Green badge "On Track", `0.3-0.6` → 🟡 Yellow "Needs Attention", `> 0.6` → 🔴 Red "At Risk". Actions use imperative language: "Review Pharmacology now" instead of "Pharmacology review suggested". | HIGH |
| Should the **dashboard prioritize only high-risk items**, or show all widgets equally? | ❌ All widgets shown equally (8 widgets, no ranking). | **Dynamic prioritization:** 1) At-risk widget always top if `overallRisk !== 'LOW'`, 2) Immediate Actions widget second if `actions.length > 0`, 3) Other widgets sorted by recency of relevant activity. Allow user to pin favorites. | HIGH |
| How often are **prescriptive recommendations recalculated**? Real-time, daily, or weekly? | ⚠️ On-demand (when dashboard loads). | **Staggered:** 1) **Risk diagnosis:** Real-time on each dashboard load (cached 15 min), 2) **Immediate actions:** Real-time, 3) **Bottleneck detection:** Daily at 2 AM (heavy query), 4) **Course recommendations:** Weekly (Sunday night). Show "Last updated: 2h ago" timestamp. | MEDIUM |
| Are **bottlenecks and skills decay** represented in a way that encourages action rather than overwhelm? | ❌ Not implemented. Section B has code but not deployed. | **Limit visible bottlenecks:** Show top 2 bottlenecks only. Each has single clear action: "❌ Blocking: Pharmacokinetics → [Review Now]". Below fold: "See 3 more bottlenecks". Skills decay: Show only if decay > 20%: "📉 Fading: Anatomy (was 85% → now 68%) → [Quick Refresh Quiz]" | HIGH |
| Do we want **adaptive navigation** (dashboard buttons take users directly to corrective action)? | ⚠️ Partial. Buttons exist but navigate to generic pages. | **Deep links:** "Review Pharmacology" → `/study/topic/pharmacology-123?mode=remediation&source=dashboard`. Track source for analytics. Action buttons should include estimated time: "[Take Quiz (15 min)]". | MEDIUM |

**Dashboard Widget Prioritization:**

```typescript
// dashboard/widget-ranker.service.ts
async rankWidgets(userId: string): Promise<DashboardWidget[]> {
  const diagnosis = await this.diagnoseAtRiskSituation(userId);
  const actions = await this.getImmediateActions(userId);
  const widgets: DashboardWidget[] = [];
  
  // Priority 1: At-risk if not LOW
  if (diagnosis.overallRisk !== 'LOW') {
    widgets.push({ type: 'at-risk', priority: 100, data: diagnosis });
  }
  
  // Priority 2: Immediate actions if any
  if (actions.length > 0) {
    widgets.push({ type: 'immediate-actions', priority: 90, data: actions.slice(0, 3) });
  }
  
  // Priority 3-8: Other widgets by activity recency
  const otherWidgets = ['courses', 'deadlines', 'reviews', 'streaks', 'achievements', 'peers'];
  for (const widgetType of otherWidgets) {
    const lastActivity = await this.getLastActivityForWidget(userId, widgetType);
    const hoursSince = (Date.now() - lastActivity.getTime()) / 3600000;
    widgets.push({ type: widgetType, priority: Math.max(0, 80 - hoursSince * 2) });
  }
  
  return widgets.sort((a, b) => b.priority - a.priority);
}
```

---

### 5. ANALYTICS & INTEGRATION: Operational Questions

| Question | Current State | Answer | Implementation Priority |
|----------|---------------|--------|------------------------|
| How accurate are the **success predictions** (e.g., < 0.4 likelihood)? Are we validating with historical data? | ⚠️ Predictions exist. No validation pipeline. | **Add retrospective validation job:** Monthly, compare `prediction.likelihood` at enrollment time vs `actual_outcome` (passed/failed). Calculate: precision, recall, calibration curve. If accuracy < 70%, retrain model or adjust weights. Store in `PredictionValidation` table. | HIGH |
| How do we integrate **cross-service analytics**: courses ↔ materials ↔ goals ↔ dashboard? | ⚠️ Services exist in silos. Dashboard aggregates but doesn't synthesize. | **Unified analytics context:** Create `UserAnalyticsContext` service that hydrates once per request: `{ skillStates, courseProgress, activeGoals, bottlenecks }`. Pass to all prescriptive services. Avoids N+1 queries. Cache per user for 5 min. | HIGH |
| How do we handle **missing or noisy data** (e.g., skipped quizzes, untracked material views)? | ❌ No handling. Missing data = default fallback. | **Confidence-weighted predictions:** Each data point has `confidence` (0-1). Quiz score confidence = 1.0, inferred views = 0.5, missing = 0. Predictions weighted: `prediction = Σ(data_i * confidence_i) / Σ(confidence_i)`. If total confidence < 0.3, show: "⚠️ Limited data - prediction may be unreliable." | MEDIUM |
| Should predictions be **explained to the user** (e.g., "Low confidence in Topic X → 40% pass risk")? | ❌ Raw numbers only. | **Yes, always explain.** Every prediction includes `explanation: string[]`: e.g., ["Quiz scores: 45% average (below 70% threshold)", "Time spent: 50% of recommended", "Peer comparison: bottom quartile"]. UI shows expandable "Why this prediction?" section. | HIGH |

**Prediction Validation Pipeline:**

```typescript
// analytics/prediction-validator.service.ts
@Cron('0 3 1 * *') // Monthly at 3 AM on the 1st
async validatePredictions() {
  // Get predictions made 30-90 days ago (enough time for outcome)
  const predictions = await this.prisma.coursePrediction.findMany({
    where: {
      createdAt: { gte: sub(new Date(), { days: 90 }), lte: sub(new Date(), { days: 30 }) },
      outcome: { not: null },
    },
  });
  
  const validation = {
    total: predictions.length,
    truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 0,
    calibration: [] as { predicted: number, actual: number }[],
  };
  
  for (const p of predictions) {
    const predictedPass = p.likelihood >= 0.5;
    const actualPass = p.outcome === 'passed';
    
    if (predictedPass && actualPass) validation.truePositives++;
    if (predictedPass && !actualPass) validation.falsePositives++;
    if (!predictedPass && !actualPass) validation.trueNegatives++;
    if (!predictedPass && actualPass) validation.falseNegatives++;
    
    validation.calibration.push({ predicted: p.likelihood, actual: actualPass ? 1 : 0 });
  }
  
  const accuracy = (validation.truePositives + validation.trueNegatives) / validation.total;
  
  await this.prisma.predictionValidation.create({
    data: { validatedAt: new Date(), accuracy, details: validation },
  });
  
  if (accuracy < 0.7) {
    await this.alertService.notifyAdmin('Prediction accuracy below threshold', validation);
  }
}
```

---

### 6. OPERATIONAL & UX CONSIDERATIONS: Operational Questions

| Question | Current State | Answer | Implementation Priority |
|----------|---------------|--------|------------------------|
| How do we **balance prescriptive guidance vs student autonomy**? | ❌ All descriptive (no guidance forces action). | **Graduated autonomy:** 1) New students (< 1 month) → High guidance (more blocking gates), 2) Established students (1-6 months) → Medium (warnings, no blocks except critical), 3) Advanced (> 6 months) → Low (suggestions only). Allow user to adjust: "Give me more/less guidance" in settings. | HIGH |
| Do we need **severity levels** for recommendations to avoid overwhelming students? | ❌ All recommendations equal weight. | **Three tiers:** 1) 🔴 **Critical** (max 1/day): blocks next action, 2) 🟡 **Important** (max 3/day): prominent badge, 3) 🔵 **Suggestion** (unlimited): subtle indicator. Daily limit enforced in `NotificationThrottler`. | HIGH |
| How should **notifications vs dashboard prompts** be prioritized? | ⚠️ Both exist independently. No coordination. | **Notification = interrupt, Dashboard = context.** Rules: Push notification only for time-sensitive actions (quiz due in <24h, streak about to break). Dashboard for discoverable insights. Never duplicate: if push sent, dashboard widget says "Notification sent". | MEDIUM |
| What's the **error-handling strategy** if prescriptive checks fail (e.g., missing prerequisites, analytics crash)? | ❌ Fail silently or block completely. | **Graceful degradation:** 1) If Rust analytics timeout → allow action with warning: "We couldn't verify readiness. Proceed with caution?", 2) If prerequisite check fails → use cached result (≤ 1 hour), 3) If all systems down → disable gates, log incident, send admin alert. Never block user infinitely. | HIGH |
| How do we **measure success** of prescriptive interventions (improved pass rates, reduced struggle, goal completion)? | ❌ No measurement. | **A/B test framework:** Randomly assign users to control (descriptive only) vs treatment (prescriptive). Track: 1) Pass rate delta, 2) Time to completion, 3) Struggle incidents, 4) Goal completion rate, 5) User satisfaction (NPS). Quarterly review. Store in `InterventionExperiment` table. | HIGH |

**Graduated Autonomy Configuration:**

```typescript
// user/autonomy-level.service.ts
interface AutonomyConfig {
  level: 'high_guidance' | 'medium_guidance' | 'low_guidance';
  gates: {
    topicUnlockRequiresMastery: boolean;   // Block next topic if p_known < 0.5
    courseEnrollmentRequiresPrereq: boolean;
    goalCreationRequiresFeasibility: boolean;
  };
  notifications: {
    maxCriticalPerDay: number;
    maxImportantPerDay: number;
  };
}

getAutonomyConfig(user: User): AutonomyConfig {
  const monthsSinceJoin = differenceInMonths(new Date(), user.createdAt);
  const userPreference = user.settings.guidanceLevel; // null | 'more' | 'less'
  
  let baseLevel: AutonomyConfig['level'];
  if (monthsSinceJoin < 1) baseLevel = 'high_guidance';
  else if (monthsSinceJoin < 6) baseLevel = 'medium_guidance';
  else baseLevel = 'low_guidance';
  
  // Apply user preference shift
  if (userPreference === 'more' && baseLevel !== 'high_guidance') {
    baseLevel = baseLevel === 'low_guidance' ? 'medium_guidance' : 'high_guidance';
  }
  if (userPreference === 'less' && baseLevel !== 'low_guidance') {
    baseLevel = baseLevel === 'high_guidance' ? 'medium_guidance' : 'low_guidance';
  }
  
  return {
    level: baseLevel,
    gates: {
      topicUnlockRequiresMastery: baseLevel === 'high_guidance',
      courseEnrollmentRequiresPrereq: baseLevel !== 'low_guidance',
      goalCreationRequiresFeasibility: baseLevel === 'high_guidance',
    },
    notifications: {
      maxCriticalPerDay: baseLevel === 'high_guidance' ? 2 : 1,
      maxImportantPerDay: baseLevel === 'low_guidance' ? 2 : 3,
    },
  };
}
```

---

## SECTION D: Implementation Priority Matrix

Based on all 14 questions + operational considerations, here's the prioritized action plan:

### Sprint 1-2: Foundation (Critical Path)

| Action | Question | Impact | Effort |
|--------|----------|--------|--------|
| **Define Topic as SSOT** | Q1 | Eliminates data conflicts | Low |
| **Wire Rust BKT → NestJS gates** | Q7 | Enables blocking decisions | Medium |
| **Add graduated autonomy config** | Operational | Respects user experience | Medium |
| **Implement graceful degradation** | Operational | Prevents system lockouts | Medium |

### Sprint 3-4: Prescriptive Courses & Materials

| Action | Question | Impact | Effort |
|--------|----------|--------|--------|
| **Event-driven prerequisite refresh** | Courses Q1 | Real-time predictions | Medium |
| **Multi-signal engagement score** | Materials Q1 | Reliable struggle detection | High |
| **Tiered intervention triggers** | Materials Q2 | Right action at right time | Medium |

### Sprint 5-6: Prescriptive Goals & Dashboard

| Action | Question | Impact | Effort |
|--------|----------|--------|--------|
| **Dynamic effort estimation** | Goals Q1 | Accurate feasibility | Medium |
| **Goal dependency chains** | Goals Q5 | Intelligent scheduling | Medium |
| **Dashboard widget prioritization** | Dashboard Q2 | Focus on what matters | Low |
| **Prediction explainability** | Analytics Q4 | User trust | Medium |

### Sprint 7-8: Validation & Refinement

| Action | Question | Impact | Effort |
|--------|----------|--------|--------|
| **Prediction validation pipeline** | Analytics Q1 | Model accuracy | High |
| **A/B test framework** | Operational Q5 | Prove interventions work | High |
| **Longitudinal skill trajectory** | Q12 | Chronic weakness detection | High |

---

## Executive Summary: Answers to All Questions

### The 14 System-Defining Questions → Resolved

1. **SSOT:** Topic is canonical. Others aggregate.
2. **Notes:** Notes are structured knowledge objects with decay.
3. **Boundaries:** If you can't fail/pass it, it's not a unit.
4. **Quiz Authority:** Questions must be mapped, calibrated, and statistically validated.
5. **Completion:** Probabilistic with decay, not binary checkboxes.
6. **Sessions:** Outcome-based (learning gain), not time-based.
7. **Analytics:** Prescriptive > Descriptive. Analytics must block actions.
8. **Recommendations:** Authority depends on type (blocking/strong/soft).
9. **Personalization:** Preserve exam alignment. Never skip mandatory topics.
10. **Offline:** Server wins for quizzes. Merge by timestamp for progress.
11. **Feedback:** Fast correction loops (<1 hour to affect recommendations).
12. **Longitudinal:** Track skill trajectories. Detect chronic weaknesses.
13. **Ethics:** Show uncertainty + support. Never predict failure without path to success.
14. **Core:** Materials + adaptive quizzes + personalized paths = core. Everything else = accessory.

### The Operational Questions → Action Items

- **Courses:** Event-driven predictions, optional prerequisites, workload personalization.
- **Materials:** Multi-signal engagement, tiered interventions, adaptive format preferences.
- **Goals:** Dynamic effort, conflict detection, cascading dependencies.
- **Dashboard:** Risk visualization, widget prioritization, deep-linked actions.
- **Analytics:** Prediction validation, cross-service context, confidence-weighted data.
- **UX:** Graduated autonomy, severity tiers, graceful degradation, A/B testing.

---

**This document is now your blueprint for transforming MedTrack Hub from a feature museum into a coherent learning engine.**
