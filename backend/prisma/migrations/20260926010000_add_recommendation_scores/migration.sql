CREATE TABLE "recommendation_scores" (
    "item_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_scores_pkey" PRIMARY KEY ("item_id"),
    CONSTRAINT "recommendation_scores_item_id_fkey"
        FOREIGN KEY ("item_id") REFERENCES "materials"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);