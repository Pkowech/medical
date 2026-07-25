-- ============================================================
-- Full-text search triggers for medtrack
-- Covers: courses, units, topics, materials, questions, quizzes,
--         users, clinical_cases, global_search_index
-- Each trigger recomputes `fts` on INSERT/UPDATE using weighted
-- tsvector fields matching the weight comments already in schema.prisma.
-- ============================================================

-- ---------- courses ----------
-- title(A), name(A), description(B), tags(C)
CREATE OR REPLACE FUNCTION courses_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS courses_fts_update ON courses;
CREATE TRIGGER courses_fts_update
  BEFORE INSERT OR UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION courses_fts_trigger();

-- ---------- units ----------
-- title(A), name(A), description(B), content(C)
CREATE OR REPLACE FUNCTION units_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS units_fts_update ON units;
CREATE TRIGGER units_fts_update
  BEFORE INSERT OR UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION units_fts_trigger();

-- ---------- topics ----------
-- name(A), description(B)
CREATE OR REPLACE FUNCTION topics_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS topics_fts_update ON topics;
CREATE TRIGGER topics_fts_update
  BEFORE INSERT OR UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION topics_fts_trigger();

-- ---------- materials ----------
-- title(A), description(B), content(C)
CREATE OR REPLACE FUNCTION materials_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS materials_fts_update ON materials;
CREATE TRIGGER materials_fts_update
  BEFORE INSERT OR UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION materials_fts_trigger();

-- ---------- questions ----------
-- text(A), explanation(B), tags(C), concepts_covered(C)
CREATE OR REPLACE FUNCTION questions_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.text, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.explanation, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'C') ||
    setweight(to_tsvector('english', array_to_string(NEW.concepts_covered, ' ')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- NOTE: `questions` table has no `fts` column in the schema you shared
-- (only Quiz/User/Course/Unit/Topic/Material/ClinicalCase/GlobalSearchIndex do).
-- If you want question-level search, add `fts Unsupported("tsvector")?` +
-- `@@index([fts], type: Gin)` to the Question model first, then run
-- `prisma migrate dev --create-only` again to pick up the new column
-- before this trigger will work. Commented out until that column exists:
--
-- DROP TRIGGER IF EXISTS questions_fts_update ON questions;
-- CREATE TRIGGER questions_fts_update
--   BEFORE INSERT OR UPDATE ON questions
--   FOR EACH ROW EXECUTE FUNCTION questions_fts_trigger();

-- ---------- quizzes ----------
-- title(A)
CREATE OR REPLACE FUNCTION quizzes_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts := setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quizzes_fts_update ON quizzes;
CREATE TRIGGER quizzes_fts_update
  BEFORE INSERT OR UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION quizzes_fts_trigger();

-- ---------- users ----------
-- first_name(A), last_name(A), username(A), bio(B)
CREATE OR REPLACE FUNCTION users_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.first_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.last_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.username, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.bio, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_fts_update ON users;
CREATE TRIGGER users_fts_update
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION users_fts_trigger();

-- ---------- clinical_cases ----------
-- title(A), description(B)
CREATE OR REPLACE FUNCTION clinical_cases_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clinical_cases_fts_update ON clinical_cases;
CREATE TRIGGER clinical_cases_fts_update
  BEFORE INSERT OR UPDATE ON clinical_cases
  FOR EACH ROW EXECUTE FUNCTION clinical_cases_fts_trigger();

-- ---------- global_search_index ----------
-- title(A), description(B), content(C), tags(C)
-- This is your cross-entity search table (denormalized from the above).
CREATE OR REPLACE FUNCTION global_search_index_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS global_search_index_fts_update ON global_search_index;
CREATE TRIGGER global_search_index_fts_update
  BEFORE INSERT OR UPDATE ON global_search_index
  FOR EACH ROW EXECUTE FUNCTION global_search_index_fts_trigger();

-- ============================================================
-- Backfill: force triggers to run on all existing rows so `fts`
-- gets populated for data inserted before these triggers existed.
-- Safe to run repeatedly; only touches rows already present.
-- ============================================================
UPDATE courses SET id = id;
UPDATE units SET id = id;
UPDATE topics SET id = id;
UPDATE materials SET id = id;
UPDATE quizzes SET id = id;
UPDATE users SET id = id;
UPDATE clinical_cases SET id = id;
UPDATE global_search_index SET id = id;

-- ============================================================
-- Trigram support for fuzzy/typo-tolerant matching (autocomplete),
-- complementing tsvector full-text search above.
-- pg_trgm extension already declared in your datasource block.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_courses_title_trgm ON courses USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_courses_name_trgm ON courses USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_units_title_trgm ON units USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_topics_name_trgm ON topics USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_materials_title_trgm ON materials USING gin (title gin_trgm_ops);