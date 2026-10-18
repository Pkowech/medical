ALTER TABLE "quizzes"
ADD COLUMN "topic_practice_for_id" TEXT;

CREATE UNIQUE INDEX "quizzes_topic_practice_for_id_key"
ON "quizzes"("topic_practice_for_id");

ALTER TABLE "quizzes"
ADD CONSTRAINT "quizzes_topic_practice_for_id_fkey"
FOREIGN KEY ("topic_practice_for_id") REFERENCES "topics"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "quizzes" (
    "id",
    "title",
    "description",
    "unit_id",
    "topic_id",
    "topic_practice_for_id",
    "created_by",
    "is_published",
    "published_at",
    "question_count",
    "passing_score",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    t."name" || ' Practice Quiz',
    'Practice questions for ' || t."name",
    t."unit_id",
    t."id",
    t."id",
    'system-topic-practice',
    true,
    CURRENT_TIMESTAMP,
    COUNT(q."id")::integer,
    70,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "topics" t
JOIN (
    SELECT DISTINCT "topic_id"
    FROM "topic_quiz_attempts"
) legacy ON legacy."topic_id" = t."id"
LEFT JOIN "questions" q
    ON t."id" = ANY(q."topic_ids")
    AND q."is_active" = true
GROUP BY t."id", t."name", t."unit_id"
ON CONFLICT ("topic_practice_for_id") DO NOTHING;

INSERT INTO "quiz_questions" (
    "id",
    "quiz_id",
    "question_id",
    "order",
    "points",
    "is_required"
)
SELECT
    gen_random_uuid()::text,
    quiz."id",
    q."id",
    (
        ROW_NUMBER() OVER (PARTITION BY quiz."id" ORDER BY q."created_at", q."id") - 1
    )::integer,
    q."points",
    true
FROM "quizzes" quiz
JOIN "questions" q ON quiz."topic_practice_for_id" = ANY(q."topic_ids")
WHERE quiz."topic_practice_for_id" IS NOT NULL
  AND q."is_active" = true
ON CONFLICT ("quiz_id", "question_id") DO NOTHING;

INSERT INTO "quiz_attempts" (
    "id",
    "user_id",
    "quiz_id",
    "started_at",
    "completed_at",
    "score",
    "max_score",
    "percentage",
    "is_passed",
    "correct_answers",
    "total_questions",
    "answers",
    "created_at"
)
SELECT
    'legacy-topic-' || legacy."id",
    legacy."user_id",
    quiz."id",
    legacy."created_at",
    legacy."created_at",
    legacy."score",
    100,
    legacy."score",
    legacy."score" >= COALESCE(quiz."passing_score", 70),
    legacy."correct_answers",
    legacy."question_count",
    legacy."responses",
    legacy."created_at"
FROM "topic_quiz_attempts" legacy
JOIN "quizzes" quiz ON quiz."topic_practice_for_id" = legacy."topic_id"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "user_responses" (
    "id",
    "user_id",
    "question_id",
    "attempt_id",
    "answer",
    "is_correct",
    "score",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    legacy."user_id",
    question."id",
    'legacy-topic-' || legacy."id",
    COALESCE(response.value -> 'selectedAnswers', '[]'::jsonb),
    COALESCE((response.value ->> 'isCorrect')::boolean, false),
    CASE
        WHEN COALESCE((response.value ->> 'isCorrect')::boolean, false)
            THEN question."points"
        ELSE 0
    END,
    legacy."created_at",
    legacy."created_at"
FROM "topic_quiz_attempts" legacy
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(legacy."responses") = 'array' THEN legacy."responses"
        ELSE '[]'::jsonb
    END
) AS response(value)
JOIN "questions" question ON question."id" = (response.value ->> 'questionId');

DROP TABLE "topic_quiz_attempts";
