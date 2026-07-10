-- Populate `total_units` on existing `course_progress` rows
-- Sets `total_units` to the count of units for the related course
BEGIN;

UPDATE course_progress
SET total_units = COALESCE(
    (SELECT COUNT(*) FROM units WHERE units.course_id = course_progress.course_id),
    0
);

COMMIT;

-- Note: This is safe if you have a `units` table with `course_id`.
-- If your schema uses a different name for the unit table or relationship,
-- update the query accordingly before running `sqlx migrate run`.
