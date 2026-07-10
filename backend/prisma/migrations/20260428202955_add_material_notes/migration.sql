-- CreateTable
CREATE TABLE "material_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "page_number" INTEGER,
    "position" JSONB,
    "color" TEXT DEFAULT '#FFFF00',
    "is_private" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_notes_user_id_idx" ON "material_notes"("user_id");

-- CreateIndex
CREATE INDEX "material_notes_material_id_idx" ON "material_notes"("material_id");

-- AddForeignKey
ALTER TABLE "material_notes" ADD CONSTRAINT "material_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_notes" ADD CONSTRAINT "material_notes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
