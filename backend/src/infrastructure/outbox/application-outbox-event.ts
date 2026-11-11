import { Prisma } from '@prisma/client';

type OutboxTransaction = Pick<
  Prisma.TransactionClient,
  'applicationOutboxEvent'
>;

export async function writeApplicationOutboxEvent(
  transaction: OutboxTransaction,
  event: {
    eventType: string;
    aggregateId?: string;
    dedupeKey: string;
    payload: Prisma.InputJsonObject;
  },
): Promise<void> {
  await transaction.applicationOutboxEvent.upsert({
    where: { dedupeKey: event.dedupeKey },
    create: {
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      dedupeKey: event.dedupeKey,
      payload: event.payload,
    },
    update: {},
  });
}
