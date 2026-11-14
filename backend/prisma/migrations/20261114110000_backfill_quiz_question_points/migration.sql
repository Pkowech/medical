UPDATE "quiz_questions" AS quiz_question
SET "points" = question."points"
FROM "questions" AS question
WHERE quiz_question."question_id" = question."id";
