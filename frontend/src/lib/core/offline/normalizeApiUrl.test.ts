import { normalizeApiUrl } from './normalizeApiUrl';

describe('normalizeApiUrl', () => {
  const origin = 'https://app.example.test';

  it('routes backend-relative paths through the same-origin proxy', () => {
    expect(normalizeApiUrl('/courses?page=2', origin)).toBe(
      '/api/backend/courses?page=2',
    );
  });

  it('removes a legacy v1 prefix from absolute backend URLs', () => {
    expect(
      normalizeApiUrl('https://backend.example.test/v1/progress/sync?userId=123', origin),
    ).toBe('/api/backend/progress/sync?userId=123');
  });

  it('does not add a duplicate proxy prefix', () => {
    expect(normalizeApiUrl('/api/backend/quizzes/submit?type=full', origin)).toBe(
      '/api/backend/quizzes/submit?type=full',
    );
  });
});
