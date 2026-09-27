ALTER TABLE "questions"
    DROP COLUMN "is_multiple_choice",
    DROP COLUMN "discrimination_index",
    DROP COLUMN "guessing_parameter";

ALTER TABLE "quiz_attempts"
    DROP COLUMN "time_spent";

ALTER TABLE "user_responses"
    DROP COLUMN "time_spent";