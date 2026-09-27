ALTER TABLE "topic_progress"
    DROP COLUMN "ease_factor",
    DROP COLUMN "interval",
    DROP COLUMN "next_review_date",
    DROP COLUMN "last_reviewed_at";

DROP TABLE "spaced_repetition_cards";
