from ts_runtime import run_typescript


def test_offline_queue_policy_allows_only_safe_learning_mutations():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { isOfflineQueueableRequest } =
  require('./src/lib/core/offline/offlineQueuePolicy.ts');

for (const url of [
  '/quizzes/topic/topic-1/offline-attempts',
  '/api/backend/quizzes/topic/topic-1/offline-attempts',
  '/v1/quizzes/topic/topic-1/offline-attempts',
]) assert.equal(isOfflineQueueableRequest('POST', url), true);

assert.equal(isOfflineQueueableRequest('POST', '/quizzes/topic/topic-1/submit'), false);
assert.equal(isOfflineQueueableRequest('GET', '/quizzes/topic/topic-1/offline-attempts'), false);

for (const url of [
  '/study/session/session-1/end',
  '/api/backend/study/session/session-1/end',
  '/v1/study/session/session-1/end',
]) assert.equal(isOfflineQueueableRequest('PUT', url), true);

assert.equal(isOfflineQueueableRequest('PUT', '/study/session/session-1'), false);
assert.equal(isOfflineQueueableRequest('POST', '/study/session/session-1/end'), false);
assert.equal(isOfflineQueueableRequest('PUT', '/study/session/session-1/end/extra'), false);
"""
    )


def test_sync_retry_policy_keeps_transient_failures_retryable_with_bounded_backoff():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { getSyncRetryDelay } = require('./src/lib/core/offline/syncRetryPolicy.ts');

assert.equal(getSyncRetryDelay(1), 5000);
assert.equal(getSyncRetryDelay(2), 10000);
assert.equal(getSyncRetryDelay(30), 300000);
assert.equal(getSyncRetryDelay(1, '30'), 30000);
assert.equal(getSyncRetryDelay(1, 'Sun, 06 Nov 1994 08:49:37 GMT', 0), 1000);
assert.equal(getSyncRetryDelay(1, 'not a retry delay'), 5000);
"""
    )
