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

  it.each([
    '/study/session/session-1/end',
    '/api/backend/study/session/session-1/end',
    '/v1/study/session/session-1/end',
  ])('allows offline study-session completion at %s', url => {
    expect(isOfflineQueueableRequest('PUT', url)).toBe(true);
  });

  it('does not queue unrelated or malformed study-session writes', () => {
    expect(isOfflineQueueableRequest('PUT', '/study/session/session-1')).toBe(false);
    expect(isOfflineQueueableRequest('POST', '/study/session/session-1/end')).toBe(false);
    expect(isOfflineQueueableRequest('PUT', '/study/session/session-1/end/extra')).toBe(false);
  });
});
