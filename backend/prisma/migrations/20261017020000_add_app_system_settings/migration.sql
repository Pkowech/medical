CREATE TABLE "app_system_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "settings" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_system_settings_pkey" PRIMARY KEY ("id")
);
