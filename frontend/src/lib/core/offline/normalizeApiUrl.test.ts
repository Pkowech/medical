import { normalizeApiUrl } from './normalizeApiUrl';

describe('normalizeApiUrl', () => {
  const origin = 'http://localhost:3000';

  it.each([
    ['/progress/log', '/api/backend/progress/sync'],
    ['/api/backend/progress/log', '/api/backend/progress/sync'],
    ['/v1/progress/log', '/api/backend/progress/sync'],
    ['/api/backend/progress/log?source=offline', '/api/backend/progress/sync?source=offline'],
    ['/progress/sync', '/api/backend/progress/sync'],
  ])('normalizes %s to %s', (url, expected) => {
    expect(normalizeApiUrl(url, origin)).toBe(expected);
  });
});
