-- CreateTable
CREATE TABLE "auto_generated_quizzes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "weakness_topic_id" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "risk_level" TEXT NOT NULL,
    "score_improvement" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_generated_quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auto_generated_quizzes_user_id_idx" ON "auto_generated_quizzes"("user_id");

-- CreateIndex
CREATE INDEX "auto_generated_quizzes_detected_at_idx" ON "auto_generated_quizzes"("detected_at");

-- CreateIndex
CREATE INDEX "auto_generated_quizzes_completed_at_idx" ON "auto_generated_quizzes"("completed_at");

-- CreateIndex
CREATE INDEX "auto_generated_quizzes_risk_level_idx" ON "auto_generated_quizzes"("risk_level");

-- CreateIndex
CREATE UNIQUE INDEX "auto_generated_quizzes_user_id_quiz_id_key" ON "auto_generated_quizzes"("user_id", "quiz_id");

-- AddForeignKey
ALTER TABLE "auto_generated_quizzes" ADD CONSTRAINT "auto_generated_quizzes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_generated_quizzes" ADD CONSTRAINT "auto_generated_quizzes_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_generated_quizzes" ADD CONSTRAINT "auto_generated_quizzes_weakness_topic_id_fkey" FOREIGN KEY ("weakness_topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
