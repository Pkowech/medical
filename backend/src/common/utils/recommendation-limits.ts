const MAX_RECOMMENDATION_LIMIT = 50;
const MAX_CANDIDATE_LIMIT = 100;
const CANDIDATE_MULTIPLIER = 5;

export function getRecommendationWindow(
  limit: number,
  defaultLimit: number,
): { resultLimit: number; candidateLimit: number } {
  const requestedLimit = Number.isFinite(limit)
    ? Math.floor(limit)
    : defaultLimit;
  const resultLimit = Math.min(
    Math.max(requestedLimit, 1),
    MAX_RECOMMENDATION_LIMIT,
  );

  return {
    resultLimit,
    candidateLimit: Math.min(
      resultLimit * CANDIDATE_MULTIPLIER,
      MAX_CANDIDATE_LIMIT,
    ),
  };
}
