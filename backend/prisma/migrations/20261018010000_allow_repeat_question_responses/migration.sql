DROP INDEX IF EXISTS "user_responses_user_id_question_id_key";

CREATE INDEX "user_responses_user_id_question_id_created_at_idx"
ON "user_responses"("user_id", "question_id", "created_at");
