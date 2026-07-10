#!/bin/bash

BASE_URL="http://localhost:3002"
RUST_URL="http://localhost:8000"
TOKEN="your_test_token_here"

echo "Testing Backend Endpoints..."

# Test 1: Get recommendations
echo -n "GET /ai-analytics/recommendations/user123: "
curl -s -w "%{http_code}" -X GET "${BASE_URL}/ai-analytics/recommendations/user123" \
  -H "Authorization: Bearer ${TOKEN}" || echo "FAILED"

# Test 2: Track event
echo -n "POST /ai-analytics/events: "
curl -s -w "%{http_code}" -X POST "${BASE_URL}/ai-analytics/events" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "eventType": "quiz_attempt",
    "timestamp": "2025-11-22T10:00:00Z",
    "data": {"score": 85}
  }' || echo "FAILED"

# Test 3: Get user analytics
echo -n "GET /ai-analytics/users/user123: "
curl -s -w "%{http_code}" -X GET "${BASE_URL}/ai-analytics/users/user123" \
  -H "Authorization: Bearer ${TOKEN}" || echo "FAILED"

echo ""
echo "Testing Rust Endpoints..."

# Test 4: Health check
echo -n "GET /health: "
curl -s -w "%{http_code}" -X GET "${RUST_URL}/health" || echo "FAILED"

# Test 5: Get recommendations (Rust)
echo -n "POST /recommendations/get_recommendations_ai: "
curl -s -w "%{http_code}" -X POST "${RUST_URL}/recommendations/get_recommendations_ai" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}' || echo "FAILED"

# Test 6: Learning patterns (Rust)
echo -n "POST /engagement/learning_patterns: "
curl -s -w "%{http_code}" -X POST "${RUST_URL}/engagement/learning_patterns" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}' || echo "FAILED"

echo ""
echo "All tests complete"
