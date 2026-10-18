CREATE TABLE "topic_quiz_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "question_count" INTEGER NOT NULL,
    "correct_answers" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "topic_quiz_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "topic_quiz_attempts_user_id_topic_id_created_at_idx"
ON "topic_quiz_attempts"("user_id", "topic_id", "created_at");

ALTER TABLE "topic_quiz_attempts"
ADD CONSTRAINT "topic_quiz_attempts_topic_id_fkey"
FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topic_quiz_attempts"
ADD CONSTRAINT "topic_quiz_attempts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
