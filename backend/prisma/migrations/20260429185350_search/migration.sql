-- CreateTable
CREATE TABLE "global_search_index" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fts" tsvector,

    CONSTRAINT "global_search_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_synonyms" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "synonyms" TEXT[],
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "global_search_index_entity_id_idx" ON "global_search_index"("entity_id");

-- CreateIndex
CREATE INDEX "global_search_index_entity_type_idx" ON "global_search_index"("entity_type");

-- CreateIndex
CREATE INDEX "global_search_index_fts_idx" ON "global_search_index" USING GIN ("fts");

-- CreateIndex
CREATE UNIQUE INDEX "medical_synonyms_term_key" ON "medical_synonyms"("term");

-- CreateIndex
CREATE INDEX "medical_synonyms_term_idx" ON "medical_synonyms"("term");
