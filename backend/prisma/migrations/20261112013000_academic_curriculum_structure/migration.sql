BEGIN;

CREATE TYPE "CurriculumStatus" AS ENUM ('draft', 'under_review', 'published', 'retired');
CREATE TYPE "AcademicContentStatus" AS ENUM ('draft', 'under_review', 'published', 'archived', 'withdrawn');
CREATE TYPE "AcademicContentEntityType" AS ENUM ('course', 'unit', 'topic', 'material');
CREATE TYPE "AcademicReviewDecision" AS ENUM ('approved', 'changes_requested', 'rejected');
CREATE TYPE "AcademicReportStatus" AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

ALTER TABLE "courses"
  ADD COLUMN "content_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "units"
  ADD COLUMN "content_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "topics"
  ADD COLUMN "learning_objectives" JSONB,
  ADD COLUMN "content_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "status" "AcademicContentStatus" NOT NULL DEFAULT 'published',
  ADD COLUMN "parent_topic_id" TEXT;

ALTER TABLE "materials"
  ADD COLUMN "status" "AcademicContentStatus" NOT NULL DEFAULT 'published',
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "learning_objectives" JSONB,
  ADD COLUMN "source_citation" TEXT,
  ADD COLUMN "copyright_holder" TEXT,
  ADD COLUMN "copyright_license" TEXT,
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "withdrawn_at" TIMESTAMP(3);

CREATE TABLE "institutions" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "country" VARCHAR(100),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_programmes" (
  "id" TEXT NOT NULL,
  "institution_id" TEXT NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "code" VARCHAR(50),
  "slug" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_programmes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "programme_curricula" (
  "id" TEXT NOT NULL,
  "programme_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "status" "CurriculumStatus" NOT NULL DEFAULT 'draft',
  "effective_from" DATE,
  "effective_to" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "programme_curricula_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_years" (
  "id" TEXT NOT NULL,
  "curriculum_id" TEXT NOT NULL,
  "year_number" INTEGER NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "curriculum_courses" (
  "id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "term" VARCHAR(100),
  "order" INTEGER NOT NULL,
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "curriculum_courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "curriculum_course_prerequisites" (
  "curriculum_course_id" TEXT NOT NULL,
  "prerequisite_curriculum_course_id" TEXT NOT NULL,
  "type" "PrerequisiteType" NOT NULL DEFAULT 'required',
  CONSTRAINT "curriculum_course_prerequisites_pkey" PRIMARY KEY ("curriculum_course_id", "prerequisite_curriculum_course_id"),
  CONSTRAINT "curriculum_course_prerequisites_not_self_check" CHECK ("curriculum_course_id" <> "prerequisite_curriculum_course_id")
);

CREATE TABLE "academic_content_versions" (
  "id" TEXT NOT NULL,
  "entity_type" "AcademicContentEntityType" NOT NULL,
  "entity_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academic_content_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_content_reviews" (
  "id" TEXT NOT NULL,
  "entity_type" "AcademicContentEntityType" NOT NULL,
  "entity_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "decision" "AcademicReviewDecision" NOT NULL,
  "feedback" TEXT,
  "reviewer_id" TEXT NOT NULL,
  "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academic_content_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_content_reports" (
  "id" TEXT NOT NULL,
  "entity_type" "AcademicContentEntityType" NOT NULL,
  "entity_id" TEXT NOT NULL,
  "material_id" TEXT,
  "reporter_id" TEXT NOT NULL,
  "moderator_id" TEXT,
  "reason" VARCHAR(100) NOT NULL,
  "details" TEXT,
  "status" "AcademicReportStatus" NOT NULL DEFAULT 'open',
  "resolution" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_content_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "academic_content_reports_material_target_check" CHECK (
    "material_id" IS NULL OR ("entity_type" = 'material' AND "entity_id" = "material_id")
  )
);

CREATE UNIQUE INDEX "institutions_slug_key" ON "institutions"("slug");
CREATE UNIQUE INDEX "academic_programmes_institution_id_slug_key" ON "academic_programmes"("institution_id", "slug");
CREATE UNIQUE INDEX "academic_programmes_institution_id_code_key" ON "academic_programmes"("institution_id", "code");
CREATE INDEX "academic_programmes_institution_id_idx" ON "academic_programmes"("institution_id");
CREATE UNIQUE INDEX "programme_curricula_programme_id_version_key" ON "programme_curricula"("programme_id", "version");
CREATE INDEX "programme_curricula_programme_id_status_idx" ON "programme_curricula"("programme_id", "status");
CREATE UNIQUE INDEX "academic_years_curriculum_id_year_number_key" ON "academic_years"("curriculum_id", "year_number");
CREATE INDEX "academic_years_curriculum_id_idx" ON "academic_years"("curriculum_id");
CREATE UNIQUE INDEX "curriculum_courses_academic_year_id_course_id_key" ON "curriculum_courses"("academic_year_id", "course_id");
CREATE UNIQUE INDEX "curriculum_courses_academic_year_id_order_key" ON "curriculum_courses"("academic_year_id", "order");
CREATE INDEX "curriculum_courses_course_id_idx" ON "curriculum_courses"("course_id");
CREATE INDEX "curriculum_course_prerequisites_prerequisite_curriculum_course_id_idx" ON "curriculum_course_prerequisites"("prerequisite_curriculum_course_id");
CREATE UNIQUE INDEX "academic_content_versions_entity_type_entity_id_version_key" ON "academic_content_versions"("entity_type", "entity_id", "version");
CREATE INDEX "academic_content_versions_entity_type_entity_id_created_at_idx" ON "academic_content_versions"("entity_type", "entity_id", "created_at");
CREATE INDEX "academic_content_reviews_entity_type_entity_id_version_idx" ON "academic_content_reviews"("entity_type", "entity_id", "version");
CREATE INDEX "academic_content_reviews_reviewer_id_reviewed_at_idx" ON "academic_content_reviews"("reviewer_id", "reviewed_at");
CREATE INDEX "academic_content_reports_entity_type_entity_id_status_idx" ON "academic_content_reports"("entity_type", "entity_id", "status");
CREATE INDEX "academic_content_reports_reporter_id_created_at_idx" ON "academic_content_reports"("reporter_id", "created_at");
CREATE INDEX "topics_parent_topic_id_idx" ON "topics"("parent_topic_id");

ALTER TABLE "academic_programmes"
  ADD CONSTRAINT "academic_programmes_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "programme_curricula"
  ADD CONSTRAINT "programme_curricula_programme_id_fkey"
  FOREIGN KEY ("programme_id") REFERENCES "academic_programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_years"
  ADD CONSTRAINT "academic_years_curriculum_id_fkey"
  FOREIGN KEY ("curriculum_id") REFERENCES "programme_curricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curriculum_courses"
  ADD CONSTRAINT "curriculum_courses_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "curriculum_courses_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curriculum_course_prerequisites"
  ADD CONSTRAINT "curriculum_course_prerequisites_curriculum_course_id_fkey"
  FOREIGN KEY ("curriculum_course_id") REFERENCES "curriculum_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "curriculum_course_prerequisites_prerequisite_curriculum_course_id_fkey"
  FOREIGN KEY ("prerequisite_curriculum_course_id") REFERENCES "curriculum_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_content_reviews"
  ADD CONSTRAINT "academic_content_reviews_reviewer_id_fkey"
  FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_content_reports"
  ADD CONSTRAINT "academic_content_reports_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "academic_content_reports_reporter_id_fkey"
  FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "academic_content_reports_moderator_id_fkey"
  FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "topics"
  ADD CONSTRAINT "topics_parent_topic_id_fkey"
  FOREIGN KEY ("parent_topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "academic_content_versions" ("id", "entity_type", "entity_id", "version", "snapshot", "created_by_id")
SELECT gen_random_uuid()::text, 'course', c."id", c."content_version",
       jsonb_build_object('code', c."code", 'name', c."name", 'title', c."title", 'description', c."description", 'status', c."status"),
       c."created_by_id"
FROM "courses" c;

INSERT INTO "academic_content_versions" ("id", "entity_type", "entity_id", "version", "snapshot")
SELECT gen_random_uuid()::text, 'unit', u."id", u."content_version",
       jsonb_build_object('courseId', u."course_id", 'name', u."name", 'title', u."title", 'description', u."description", 'order', u."order", 'content', u."content", 'learningObjectives', u."learning_objectives", 'isPublished', u."is_published", 'slug', u."slug")
FROM "units" u;

INSERT INTO "academic_content_versions" ("id", "entity_type", "entity_id", "version", "snapshot")
SELECT gen_random_uuid()::text, 'topic', t."id", t."content_version",
       jsonb_build_object('unitId', t."unit_id", 'name', t."name", 'description', t."description", 'order', t."order", 'learningObjectives', t."learning_objectives", 'status', t."status", 'parentTopicId', t."parent_topic_id", 'slug', t."slug", 'isMandatory', t."is_mandatory")
FROM "topics" t;

INSERT INTO "academic_content_versions" ("id", "entity_type", "entity_id", "version", "snapshot", "created_by_id")
SELECT gen_random_uuid()::text, 'material', m."id", m."version",
       jsonb_build_object('title', m."title", 'type', m."type", 'fileId', m."file_id", 'previewFileId', m."preview_file_id", 'content', m."content", 'description', m."description", 'category', m."category", 'version', m."version", 'status', m."status", 'tags', m."tags", 'learningObjectives', m."learning_objectives", 'sourceCitation', m."source_citation", 'copyrightHolder', m."copyright_holder", 'copyrightLicense', m."copyright_license"),
       m."user_id"
FROM "materials" m;

COMMIT;
