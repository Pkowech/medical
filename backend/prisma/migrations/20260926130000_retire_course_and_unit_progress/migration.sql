BEGIN;

INSERT INTO "course_enrollments" (
    "id",
    "user_id",
    "course_id",
    "status",
    "enrolled_at",
    "completed_at",
    "total_units",
    "completed_units",
    "progress_percentage",
    "last_accessed"
)
SELECT
    gen_random_uuid()::text,
    cp."user_id",
    cp."course_id",
    CASE cp."status"::text
        WHEN 'completed' THEN 'completed'::"EnrollmentStatus"
        WHEN 'dropped' THEN 'dropped'::"EnrollmentStatus"
        WHEN 'suspended' THEN 'suspended'::"EnrollmentStatus"
        ELSE 'active'::"EnrollmentStatus"
    END,
    COALESCE(cp."started_at", cp."created_at"),
    cp."completed_at",
    (SELECT COUNT(*)::integer FROM "units" u WHERE u."course_id" = cp."course_id"),
    cp."completed_units",
    cp."progress_percentage"::double precision,
    cp."last_accessed_at"
FROM "course_progress" cp
WHERE NOT EXISTS (
    SELECT 1
    FROM "course_enrollments" ce
    WHERE ce."user_id" = cp."user_id" AND ce."course_id" = cp."course_id"
);

UPDATE "course_enrollments" ce
SET
    "status" = CASE cp."status"::text
        WHEN 'completed' THEN 'completed'::"EnrollmentStatus"
        WHEN 'dropped' THEN 'dropped'::"EnrollmentStatus"
        WHEN 'suspended' THEN 'suspended'::"EnrollmentStatus"
        ELSE ce."status"
    END,
    "enrolled_at" = COALESCE(cp."started_at", ce."enrolled_at"),
    "completed_at" = COALESCE(cp."completed_at", ce."completed_at"),
    "total_units" = (SELECT COUNT(*)::integer FROM "units" u WHERE u."course_id" = cp."course_id"),
    "completed_units" = cp."completed_units",
    "progress_percentage" = cp."progress_percentage"::double precision,
    "last_accessed" = cp."last_accessed_at"
FROM "course_progress" cp
WHERE ce."user_id" = cp."user_id"
  AND ce."course_id" = cp."course_id"
  AND cp."last_accessed_at" > COALESCE(ce."last_accessed", ce."enrolled_at");

UPDATE "topic_progress" tp
SET
    "status" = up."status",
    "progress_percentage" = up."progress_percentage",
    "completion_percentage" = up."progress_percentage",
    "time_spent" = up."time_spent",
    "is_completed" = (up."status"::text = 'completed'),
    "started_at" = COALESCE(up."started_at", tp."started_at"),
    "completed_at" = COALESCE(up."completed_at", tp."completed_at"),
    "last_accessed_at" = up."last_accessed_at",
    "updated_at" = up."updated_at",
    "last_updated" = GREATEST(tp."last_updated", up."last_updated")
FROM "unit_progress" up
JOIN "units" u ON u."id" = up."unit_id"
WHERE tp."user_id" = up."user_id"
  AND tp."unit_id" = up."unit_id"
  AND tp."course_id" = u."course_id"
  AND tp."topic_id" IS NULL
  AND tp."material_id" IS NULL
  AND up."updated_at" > tp."updated_at";

INSERT INTO "topic_progress" (
    "id",
    "user_id",
    "unit_id",
    "course_id",
    "status",
    "progress_percentage",
    "completion_percentage",
    "time_spent",
    "is_completed",
    "started_at",
    "completed_at",
    "last_accessed_at",
    "created_at",
    "updated_at",
    "last_updated"
)
SELECT
    gen_random_uuid()::text,
    up."user_id",
    up."unit_id",
    u."course_id",
    up."status",
    up."progress_percentage",
    up."progress_percentage",
    up."time_spent",
    (up."status"::text = 'completed'),
    up."started_at",
    up."completed_at",
    up."last_accessed_at",
    up."created_at",
    up."updated_at",
    up."last_updated"
FROM "unit_progress" up
JOIN "units" u ON u."id" = up."unit_id"
WHERE NOT EXISTS (
    SELECT 1
    FROM "topic_progress" tp
    WHERE tp."user_id" = up."user_id"
      AND tp."unit_id" = up."unit_id"
      AND tp."course_id" = u."course_id"
      AND tp."topic_id" IS NULL
      AND tp."material_id" IS NULL
);

DROP TABLE "course_progress";
DROP TABLE "unit_progress";

COMMIT;