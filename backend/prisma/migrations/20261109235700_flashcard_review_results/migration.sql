CREATE TABLE "flashcard_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "flashcard_id" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flashcard_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "flashcard_results_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "flashcard_results_flashcard_id_fkey"
        FOREIGN KEY ("flashcard_id") REFERENCES "flashcards"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "flashcard_results_user_id_attempted_at_idx"
    ON "flashcard_results"("user_id", "attempted_at");

CREATE INDEX "flashcard_results_user_id_flashcard_id_attempted_at_idx"
    ON "flashcard_results"("user_id", "flashcard_id", "attempted_at");
