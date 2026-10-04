CREATE TABLE "offline_practice_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "validated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_practice_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "offline_practice_attempts_user_id_created_at_idx"
ON "offline_practice_attempts"("user_id", "created_at");

CREATE INDEX "offline_practice_attempts_topic_id_idx"
ON "offline_practice_attempts"("topic_id");

ALTER TABLE "offline_practice_attempts"
ADD CONSTRAINT "offline_practice_attempts_topic_id_fkey"
FOREIGN KEY ("topic_id") REFERENCES "topics"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "offline_practice_attempts"
ADD CONSTRAINT "offline_practice_attempts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
