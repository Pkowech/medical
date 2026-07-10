-- Migration: add missing analytics columns and user_activity table
-- Created: 2025-11-25

BEGIN;

-- Add total_units to course_progress if it doesn't exist
ALTER TABLE IF EXISTS course_progress
    ADD COLUMN IF NOT EXISTS total_units integer DEFAULT 0;

-- Add level column to courses if missing
ALTER TABLE IF EXISTS courses
    ADD COLUMN IF NOT EXISTS level text;

-- Create user_activity table if missing
CREATE TABLE IF NOT EXISTS user_activity (
    id text PRIMARY KEY,
    user_id text NOT NULL,
    type text,
    description text,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

-- Add progress_percentage to learning_path_progress if missing
ALTER TABLE IF EXISTS learning_path_progress
    ADD COLUMN IF NOT EXISTS progress_percentage integer;

COMMIT;
