from ts_runtime import run_typescript


def test_security_event_listener_enqueues_event_without_materializing_it_inline():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const {
  AuditLogService,
} = require('./src/modules/auth/services/audit-log.service.ts');

const payload = {
  eventType: 'tokenRevoked',
  userId: 'user-1',
  ipAddress: 'unknown',
  userAgent: 'unknown',
  eventData: { success: true },
};
let insertedPayload;
let transactionOptions;
const service = Object.create(AuditLogService.prototype);
service.prisma = {
  $transaction: async (callback, options) => {
    transactionOptions = options;
    return callback({
      $executeRaw: async (query, ...values) => {
        assert.match(query.join(''), /INSERT INTO "login_audit_outbox"/);
        insertedPayload = JSON.parse(values[1]);
        return 1;
      },
    });
  },
};
service.logger = { error: () => undefined };

(async () => {
  await service.handleSecurityEvent(payload);
  assert.equal(transactionOptions.maxWait, 10_000);
  assert.deepEqual(insertedPayload, payload);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
