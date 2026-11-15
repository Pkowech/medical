from ts_runtime import run_typescript


def test_outbox_poll_error_logs_prisma_code_and_operation():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const {
  LoginAuditOutboxProcessor,
} = require('./src/modules/auth/services/login-audit-outbox.processor.ts');

const error = new Error('relation login_audit_outbox is unavailable');
error.name = 'PrismaClientKnownRequestError';
error.code = 'P2021';
const messages = [];
let transactions = 0;
const service = Object.create(LoginAuditOutboxProcessor.prototype);
service.prisma = {
  $transaction: async callback => {
    transactions += 1;
    return callback({
      $queryRaw: async () => { throw error; },
    }, { maxWait: 10_000 });
  },
};
service.auditLogService = {};
service.logger = {
  error: message => messages.push(message),
  warn: () => undefined,
};

(async () => {
  await service.processPendingEvents();
  assert.equal(transactions, 1);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].includes('P2028'), false);
  assert.match(messages[0], /poll/);
  assert.match(messages[0], /P2021/);
  assert.match(messages[0], /login_audit_outbox is unavailable/);
  assert.match(messages[0], /event unknown/);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_outbox_poll_transaction_contention_is_deferred_to_next_tick():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const {
  LoginAuditOutboxProcessor,
} = require('./src/modules/auth/services/login-audit-outbox.processor.ts');

const error = new Error('Unable to start a transaction in the given time');
error.name = 'PrismaClientKnownRequestError';
error.code = 'P2028';
const errors = [];
const warnings = [];
const service = Object.create(LoginAuditOutboxProcessor.prototype);
service.prisma = {
  $transaction: async (callback, options) => {
    assert.equal(options.maxWait, 10_000);
    return callback({
      $queryRaw: async () => { throw error; },
    });
  },
};
service.auditLogService = {};
service.logger = {
  error: message => errors.push(message),
  warn: message => warnings.push(message),
};

(async () => {
  await service.processPendingEvents();
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /P2028/);
  assert.match(warnings[0], /next scheduled poll will retry/);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
