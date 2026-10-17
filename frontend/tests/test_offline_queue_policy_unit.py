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
