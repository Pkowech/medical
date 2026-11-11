BEGIN;

CREATE TABLE "processed_bkt_updates" (
  "event_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_bkt_updates_pkey" PRIMARY KEY ("event_id")
);

COMMIT;
