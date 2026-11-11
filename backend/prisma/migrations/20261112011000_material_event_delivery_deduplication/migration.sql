BEGIN;

CREATE TABLE "material_event_deliveries" (
  "event_id" TEXT NOT NULL,
  "material_event_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "material_event_deliveries_pkey" PRIMARY KEY ("event_id")
);

CREATE INDEX "material_event_deliveries_material_event_id_created_at_idx"
  ON "material_event_deliveries"("material_event_id", "created_at");

ALTER TABLE "material_event_deliveries"
  ADD CONSTRAINT "material_event_deliveries_material_event_id_fkey"
  FOREIGN KEY ("material_event_id") REFERENCES "material_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
