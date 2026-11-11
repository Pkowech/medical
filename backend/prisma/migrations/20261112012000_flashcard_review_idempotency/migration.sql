BEGIN;

ALTER TABLE "flashcard_results"
  ADD COLUMN "source_key" TEXT;

CREATE UNIQUE INDEX "flashcard_results_source_key_key"
  ON "flashcard_results"("source_key");

COMMIT;
