ALTER TABLE "learning_goals"
ADD COLUMN "source_key" TEXT;

CREATE UNIQUE INDEX "learning_goals_source_key_key"
ON "learning_goals"("source_key");

ALTER TABLE "user_activities"
ADD COLUMN "source_key" TEXT;

CREATE UNIQUE INDEX "user_activities_source_key_key"
ON "user_activities"("source_key");

CREATE TABLE "application_outbox_events" (
  "id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "aggregate_id" TEXT,
  "dedupe_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "locked_at" TIMESTAMP(3),
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "application_outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "application_outbox_events_dedupe_key_key"
ON "application_outbox_events"("dedupe_key");

CREATE INDEX "application_outbox_events_processed_at_available_at_created_at_idx"
ON "application_outbox_events"("processed_at", "available_at", "created_at");
