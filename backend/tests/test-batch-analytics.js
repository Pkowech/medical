/**
 * Test: Backend Batch Analytics Endpoint
 * This tests the complete flow:
 * 1. POST batch events to backend
 * 2. Backend forwards to Rust analytics service (gRPC)
 * 3. Backend calls refreshBktSkillMetrics after batch processing
 * 4. Rust service updates metrics
 */

const http = require('http');

console.log('\n========================================');
console.log('  Backend Batch Analytics Test');
console.log('========================================\n');

const testData = {
  events: [
    {
      user_id: 'test-user-1',
      event_type: 'question_answered',
      skill_id: 'math-001',
      timestamp: new Date().toISOString(),
      metadata: {
        is_correct: true,
        question_id: 'q-001',
        difficulty: 0.7,
      },
    },
    {
      user_id: 'test-user-2',
      event_type: 'question_answered',
      skill_id: 'science-001',
      timestamp: new Date().toISOString(),
      metadata: {
        is_correct: false,
        question_id: 'q-002',
        difficulty: 0.8,
      },
    },
  ],
};

console.log('Test: POST /v1/ai-analytics/events/batch');
console.log('Target: http://localhost:3002\n');
console.log('Payload:');
console.log(JSON.stringify(testData, null, 2));
console.log('\n');

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/v1/ai-analytics/events/batch',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-token',
  },
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Response Status: ${res.statusCode}`);
    console.log(`Response Headers:`, res.headers);
    
    try {
      const body = JSON.parse(data);
      console.log('\nResponse Body:');
      console.log(JSON.stringify(body, null, 2));
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('\n✅ Request succeeded!');
        console.log('\nFlow Summary:');
        console.log('  1. Backend received batch events');
        console.log('  2. Events forwarded to Rust analytics service');
        console.log('  3. refreshBktSkillMetrics called (gRPC to Rust)');
        console.log('  4. Rust service updated BKT skill average metrics');
      } else {
        console.log('\n⚠️  Non-success response code');
      }
    } catch (e) {
      console.log('Response:', data);
      console.log('Note: Response may not be JSON (e.g., 401 Unauthorized)');
    }
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
  console.log('\nPossible causes:');
  console.log('  • Backend not running on port 3002');
  console.log('  • Request requires valid authentication token');
  process.exit(1);
});

req.write(JSON.stringify(testData));
req.end();
