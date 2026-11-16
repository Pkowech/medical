CREATE TABLE "quiz_attempt_question_snapshots" (
    "attempt_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quiz_attempt_question_snapshots_pkey" PRIMARY KEY ("attempt_id")
);

ALTER TABLE "quiz_attempt_question_snapshots"
    ADD CONSTRAINT "quiz_attempt_question_snapshots_attempt_id_fkey"
    FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "quiz_attempts" AS attempt
SET "answers" = COALESCE((
    SELECT jsonb_agg(
        jsonb_build_object(
            'questionId', quiz_question."question_id",
            'selectedOption', NULL
        )
        ORDER BY quiz_question."order", quiz_question."question_id"
    )
    FROM "quiz_questions" AS quiz_question
    WHERE quiz_question."quiz_id" = attempt."quiz_id"
), '[]'::jsonb)
WHERE attempt."completed_at" IS NULL
    AND CASE
        WHEN jsonb_typeof(attempt."answers") = 'array'
            THEN jsonb_array_length(attempt."answers") = 0
        ELSE TRUE
    END
    AND EXISTS (
        SELECT 1
        FROM "quiz_questions" AS quiz_question
        WHERE quiz_question."quiz_id" = attempt."quiz_id"
    );

WITH active_attempt_snapshots AS (
    SELECT
        attempt."id",
        attempt."quiz_id",
        quiz."passing_score",
        jsonb_agg(
            jsonb_build_object(
                'questionId', quiz_question."question_id",
                'order', answer.ordinality - 1,
                'points', quiz_question."points",
                'isRequired', quiz_question."is_required",
                'question', jsonb_build_object(
                    'id', question."id",
                    'text', question."text",
                    'type', question."type",
                    'points', question."points",
                    'topicIds', to_jsonb(question."topic_ids"),
                    'options', COALESCE((
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', question_option."id",
                                'text', question_option."text",
                                'isCorrect', question_option."is_correct",
                                'order', question_option."order"
                            )
                            ORDER BY question_option."order", question_option."id"
                        )
                        FROM "question_options" AS question_option
                        WHERE question_option."question_id" = question."id"
                    ), '[]'::jsonb)
                )
            )
            ORDER BY answer.ordinality
        ) AS "questions",
        COUNT(*) AS "question_count",
        COUNT(DISTINCT quiz_question."question_id") AS "unique_question_count",
        CASE
            WHEN jsonb_typeof(attempt."answers") = 'array'
                THEN jsonb_array_length(attempt."answers")
            ELSE 0
        END AS "answer_count"
    FROM "quiz_attempts" AS attempt
    JOIN "quizzes" AS quiz ON quiz."id" = attempt."quiz_id"
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(attempt."answers") = 'array'
                THEN attempt."answers"
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS answer(value, ordinality)
    JOIN "quiz_questions" AS quiz_question
        ON quiz_question."quiz_id" = attempt."quiz_id"
        AND quiz_question."question_id" = answer.value->>'questionId'
    JOIN "questions" AS question
        ON question."id" = quiz_question."question_id"
    WHERE attempt."completed_at" IS NULL
    GROUP BY attempt."id", attempt."quiz_id", quiz."passing_score", attempt."answers"
)
INSERT INTO "quiz_attempt_question_snapshots" (
    "attempt_id",
    "snapshot"
)
SELECT
    "id",
    jsonb_build_object(
        'version', 1,
        'quizId', "quiz_id",
        'passingScore', "passing_score",
        'questions', "questions"
    )
FROM active_attempt_snapshots
WHERE "question_count" = "answer_count"
    AND "unique_question_count" = "answer_count";
