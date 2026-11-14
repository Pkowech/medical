CREATE TYPE "QuestionModerationStatus" AS ENUM ('open', 'in_review', 'resolved', 'dismissed');

CREATE TABLE "question_moderation_cases" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "status" "QuestionModerationStatus" NOT NULL DEFAULT 'open',
    "assigned_moderator_id" TEXT,
    "resolution" VARCHAR(50),
    "resolution_note" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "question_moderation_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "question_moderation_events" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" VARCHAR(30) NOT NULL,
    "from_status" "QuestionModerationStatus",
    "to_status" "QuestionModerationStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "question_moderation_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "question_moderation_cases_question_id_key"
    ON "question_moderation_cases"("question_id");
CREATE INDEX "question_moderation_cases_status_updated_at_idx"
    ON "question_moderation_cases"("status", "updated_at");
CREATE INDEX "question_moderation_cases_assigned_moderator_id_status_idx"
    ON "question_moderation_cases"("assigned_moderator_id", "status");
CREATE INDEX "question_moderation_events_case_id_created_at_idx"
    ON "question_moderation_events"("case_id", "created_at");
CREATE INDEX "question_moderation_events_actor_id_created_at_idx"
    ON "question_moderation_events"("actor_id", "created_at");

ALTER TABLE "question_moderation_cases"
    ADD CONSTRAINT "question_moderation_cases_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_moderation_cases"
    ADD CONSTRAINT "question_moderation_cases_assigned_moderator_id_fkey"
    FOREIGN KEY ("assigned_moderator_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_moderation_events"
    ADD CONSTRAINT "question_moderation_events_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "question_moderation_cases"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_moderation_events"
    ADD CONSTRAINT "question_moderation_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "question_moderation_cases" (
    "id", "question_id", "status", "opened_at", "created_at", "updated_at"
)
SELECT
    gen_random_uuid()::text,
    "question_id",
    'open',
    MIN("created_at"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "question_flags"
GROUP BY "question_id";

INSERT INTO "question_moderation_events" (
    "id", "case_id", "action", "to_status", "reason", "created_at"
)
SELECT
    gen_random_uuid()::text,
    "id",
    'backfilled',
    "status",
    'Case created from existing learner reports.',
    "opened_at"
FROM "question_moderation_cases";
