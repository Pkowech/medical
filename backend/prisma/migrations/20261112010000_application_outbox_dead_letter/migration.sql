BEGIN;

ALTER TABLE "application_outbox_events"
  ADD COLUMN "failed_at" TIMESTAMP(3);

UPDATE "application_outbox_events"
SET "failed_at" = CURRENT_TIMESTAMP
WHERE "processed_at" IS NULL
  AND "attempts" >= 8;

CREATE INDEX "application_outbox_events_failed_at_processed_at_available_at_idx"
  ON "application_outbox_events"("failed_at", "processed_at", "available_at");

COMMIT;
