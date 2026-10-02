CREATE TABLE "direct_conversations" (
    "id" TEXT NOT NULL,
    "pair_key" VARCHAR(73) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "direct_conversation_participants" (
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_conversation_participants_pkey" PRIMARY KEY ("conversation_id", "user_id")
);

CREATE TABLE "direct_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "direct_conversations_pair_key_key" ON "direct_conversations"("pair_key");
CREATE INDEX "direct_conversations_updated_at_idx" ON "direct_conversations"("updated_at");
CREATE INDEX "direct_conversation_participants_user_id_idx" ON "direct_conversation_participants"("user_id");
CREATE INDEX "direct_messages_conversation_id_created_at_idx" ON "direct_messages"("conversation_id", "created_at");
CREATE INDEX "direct_messages_sender_id_idx" ON "direct_messages"("sender_id");

ALTER TABLE "direct_conversation_participants"
ADD CONSTRAINT "direct_conversation_participants_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "direct_conversation_participants"
ADD CONSTRAINT "direct_conversation_participants_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "direct_messages"
ADD CONSTRAINT "direct_messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "direct_messages"
ADD CONSTRAINT "direct_messages_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
