UPDATE "notifications"
SET "priority" = CASE LOWER("severity")
    WHEN 'critical' THEN 'urgent'::"NotificationPriority"
    WHEN 'important' THEN 'high'::"NotificationPriority"
    WHEN 'suggestion' THEN 'low'::"NotificationPriority"
    WHEN 'low' THEN 'low'::"NotificationPriority"
    WHEN 'medium' THEN 'medium'::"NotificationPriority"
    WHEN 'high' THEN 'high'::"NotificationPriority"
    ELSE "priority"
END
WHERE "severity" IS NOT NULL;

ALTER TABLE "notifications" DROP COLUMN "severity";
