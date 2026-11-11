ALTER TABLE "learning_paths"
ADD COLUMN "target_career_stages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "learning_paths"
SET "target_career_stages" = ARRAY['student']::TEXT[]
WHERE "id" IN (
  'path-bpharm-iv-clerkship',
  'path-bpharm-iv-pharmacotherapy',
  'path-bsc-nursing-critical-care',
  'path-mbchb-internal-medicine'
);
