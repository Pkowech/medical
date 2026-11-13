ALTER TABLE "deadlines"
ADD COLUMN "source_key" TEXT,
ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "deadlines_source_key_key"
ON "deadlines"("source_key");

ALTER TABLE "notifications"
ADD COLUMN "source_key" TEXT;

CREATE UNIQUE INDEX "notifications_source_key_key"
ON "notifications"("source_key");
