import { isOfflineQueueableRequest } from './offlineQueuePolicy';

describe('isOfflineQueueableRequest', () => {
  it.each([
    '/quizzes/topic/topic-1/offline-attempts',
    '/api/backend/quizzes/topic/topic-1/offline-attempts',
    '/v1/quizzes/topic/topic-1/offline-attempts',
  ])('allows idempotent offline practice sync at %s', url => {
    expect(isOfflineQueueableRequest('POST', url)).toBe(true);
  });

  it('does not queue topic assessment submissions or other methods', () => {
    expect(isOfflineQueueableRequest('POST', '/quizzes/topic/topic-1/submit')).toBe(false);
    expect(isOfflineQueueableRequest('GET', '/quizzes/topic/topic-1/offline-attempts')).toBe(false);
  });
});
