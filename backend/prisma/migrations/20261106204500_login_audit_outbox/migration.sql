CREATE TABLE "login_audit_outbox" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "login_audit_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_audit_outbox_available_at_created_at_idx"
    ON "login_audit_outbox"("available_at", "created_at");
