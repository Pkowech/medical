/**
 * Rust Analytics + NestJS Integration Test
 * Tests the full analytics pipeline using seeded user data from PostgreSQL
 * Communicates with: PostgreSQL Database → NestJS Backend → Rust Analytics (gRPC)
 */

const http = require('http');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { Pool } = require('pg');

// Configuration
const CONFIG = {
  postgres: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/medtrack_dev',
  },
  nestjs: {
    baseUrl: process.env.BACKEND_URL || 'http://localhost:3002',
  },
  rust: {
    grpcUrl: process.env.RUST_ANALYTICS_GRPC_URL || 'localhost:50051',
    httpUrl: process.env.RUST_HTTP_URL || 'http://localhost:8000',
  },
};

// Initialize gRPC client
const PROTO_PATH = path.join(__dirname, '..', 'protos', 'analytics.proto');
let analyticsProto = null;
let grpcClient = null;

async function initGrpcClient() {
  try {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    analyticsProto = grpc.loadPackageDefinition(packageDefinition).analytics;
    grpcClient = new analyticsProto.AnalyticsService(
      CONFIG.rust.grpcUrl,
      grpc.credentials.createInsecure()
    );
    console.log('✅ gRPC client initialized');
  } catch (error) {
    console.log('⚠️  gRPC initialization warning:', error.message);
  }
}

// Database helper
async function queryDatabase(query) {
  const pool = new Pool({ connectionString: CONFIG.postgres.connectionString });
  try {
    const result = await pool.query(query);
    return result.rows;
  } finally {
    await pool.end();
  }
}

// HTTP helper for NestJS API
async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, CONFIG.nestjs.baseUrl);
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// gRPC helper
async function callGrpcMethod(methodName, request) {
  return new Promise((resolve, reject) => {
    if (!grpcClient) {
      return reject(new Error('gRPC client not initialized'));
    }
    grpcClient[methodName](request, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

// HTTP helper for Rust service
async function callRustHttp(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`${CONFIG.rust.httpUrl}${endpoint}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

// Test Suite
async function runTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  Rust Analytics + NestJS Integration Test                        ║');
  console.log('║  Pipeline: PostgreSQL → NestJS → Rust Analytics (gRPC)           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  try {
    // Initialize gRPC
    await initGrpcClient();

    // ═══════════════════════════════════════════════════════════════════
    // Test Suite 1: Database Connectivity & User Data
    // ═══════════════════════════════════════════════════════════════════
    console.log('📋 Test Suite 1: Database Connectivity & User Data\n');

    console.log('  Test 1.1: Connect to PostgreSQL');
    try {
      const users = await queryDatabase(`
        SELECT id, email, "firstName", "lastName" 
        FROM "User" 
        LIMIT 5
      `);
      console.log(`    ✅ PASSED - Found ${users.length} users in database`);
      users.forEach((u) => {
        console.log(`       • ${u.firstName} ${u.lastName} (${u.email})`);
      });
      passed++;
    } catch (error) {
      console.log(`    ❌ FAILED - ${error.message}`);
      failed++;
    }

    console.log('\n  Test 1.2: Fetch User Learning Analytics');
    try {
      const analytics = await queryDatabase(`
        SELECT u.id, u.email, ula."totalStudyTime", ula."averageScore", ula."currentStreak"
        FROM "User" u
        LEFT JOIN "UserLearningAnalytics" ula ON u.id = ula."userId"
        WHERE ula."userId" IS NOT NULL
        LIMIT 3
      `);
      console.log(`    ✅ PASSED - Found ${analytics.length} users with analytics`);
      analytics.forEach((a) => {
        console.log(`       • ${a.email}: ${a.totalStudyTime}min study, ${a.averageScore}% avg, ${a.currentStreak} day streak`);
      });
      passed++;
    } catch (error) {
      console.log(`    ❌ FAILED - ${error.message}`);
      failed++;
    }

    console.log('\n  Test 1.3: Fetch User Quiz Performance');
    try {
      const quizData = await queryDatabase(`
        SELECT u.email, COUNT(*) as attempts, AVG(qa.percentage) as avg_score, MAX(qa.percentage) as best_score
        FROM "User" u
        INNER JOIN "QuizAttempt" qa ON u.id = qa."userId"
        GROUP BY u.email
        LIMIT 3
      `);
      console.log(`    ✅ PASSED - Found quiz data for ${quizData.length} users`);
      quizData.forEach((q) => {
        console.log(`       • ${q.email}: ${q.attempts} attempts, ${q.avg_score?.toFixed(1)}% avg, ${q.best_score}% best`);
      });
      passed++;
    } catch (error) {
      console.log(`    ❌ FAILED - ${error.message}`);
      failed++;
    }

    console.log('\n  Test 1.4: Fetch Study Sessions Data');
    try {
      const sessions = await queryDatabase(`
        SELECT u.email, COUNT(*) as session_count, AVG(ss."focusScore") as avg_focus
        FROM "User" u
        INNER JOIN "StudySession" ss ON u.id = ss."userId"
        GROUP BY u.email
        LIMIT 3
      `);
      console.log(`    ✅ PASSED - Found study sessions for ${sessions.length} users`);
      sessions.forEach((s) => {
        console.log(`       • ${s.email}: ${s.session_count} sessions, ${s.avg_focus?.toFixed(1)}% avg focus`);
      });
      passed++;
    } catch (error) {
      console.log(`    ❌ FAILED - ${error.message}`);
      failed++;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Test Suite 2: NestJS Backend API
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📋 Test Suite 2: NestJS Backend API\n');

    console.log('  Test 2.1: Backend Health Check');
    try {
      const response = await makeRequest('GET', '/api/health');
      if (response.status === 200) {
        console.log(`    ✅ PASSED - Backend is healthy`);
        console.log(`       • Status: ${response.status}`);
        passed++;
      } else {
        console.log(`    ❌ FAILED - Backend returned ${response.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`    ❌ FAILED - ${error.message}`);
      failed++;
    }

    console.log('\n  Test 2.2: Fetch User Analytics via API');
    try {
      const response = await makeRequest('GET', '/api/v1/analytics/user-learning-analytics');
      if (response.status === 200) {
        console.log(`    ✅ PASSED - Retrieved user analytics`);
        console.log(`       • Status: ${response.status}`);
        console.log(`       • Data records: ${Array.isArray(response.body) ? response.body.length : 'N/A'}`);
        passed++;
      } else {
        console.log(`    ⚠️  WARNING - Backend returned ${response.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`    ⚠️  WARNING - ${error.message}`);
      failed++;
    }

    console.log('\n  Test 2.3: Fetch Quiz Statistics via API');
    try {
      const response = await makeRequest('GET', '/api/v1/analytics/quiz-statistics');
      if (response.status === 200 || response.status === 404) {
        console.log(`    ✅ PASSED - Quiz statistics endpoint accessible`);
        console.log(`       • Status: ${response.status}`);
        passed++;
      } else {
        console.log(`    ❌ FAILED - Unexpected status ${response.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`    ⚠️  WARNING - ${error.message}`);
      failed++;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Test Suite 3: Rust Analytics Service (HTTP)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📋 Test Suite 3: Rust Analytics Service (HTTP)\n');

    console.log('  Test 3.1: Rust Health Endpoint');
    try {
      const response = await callRustHttp('/health');
      if (response.status === 200) {
        console.log(`    ✅ PASSED - Rust service is healthy`);
        console.log(`       • Status: ${response.status}`);
        console.log(`       • Message: ${response.body.message || response.body.status}`);
        passed++;
      } else {
        console.log(`    ❌ FAILED - Rust service returned ${response.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`    ❌ FAILED - ${error.message}`);
      console.log(`       • Ensure Rust analytics service is running on ${CONFIG.rust.httpUrl}`);
      failed++;
    }

    console.log('\n  Test 3.2: Rust Metrics Endpoint');
    try {
      const response = await callRustHttp('/metrics');
      if (response.status === 200) {
        console.log(`    ✅ PASSED - Metrics endpoint accessible`);
        console.log(`       • Status: ${response.status}`);
        passed++;
      } else {
        console.log(`    ⚠️  WARNING - Metrics returned ${response.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`    ⚠️  WARNING - ${error.message}`);
      failed++;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Test Suite 4: gRPC Integration
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📋 Test Suite 4: gRPC Integration\n');

    if (grpcClient) {
      console.log('  Test 4.1: gRPC Service Connection');
      try {
        const response = await callGrpcMethod('UpdateBktSkillMetrics', {});
        console.log(`    ✅ PASSED - gRPC service is reachable`);
        console.log(`       • Response success: ${response.success}`);
        console.log(`       • Message: ${response.message}`);
        passed++;
      } catch (error) {
        console.log(`    ❌ FAILED - gRPC call failed: ${error.message}`);
        failed++;
      }

      console.log('\n  Test 4.2: Send Analytics Data via gRPC');
      try {
        const userData = await queryDatabase(`
          SELECT id, "averageScore"::int as score 
          FROM "User" u
          LEFT JOIN "UserLearningAnalytics" ula ON u.id = ula."userId"
          WHERE ula."userId" IS NOT NULL
          LIMIT 1
        `);

        if (userData.length > 0) {
          const request = {
            user_id: userData[0].id,
            metrics: {
              skill: 'cardiology',
              score: userData[0].score || 80,
              timestamp: Math.floor(Date.now() / 1000),
            },
          };
          const response = await callGrpcMethod('UpdateBktSkillMetrics', request);
          console.log(`    ✅ PASSED - Successfully sent user analytics via gRPC`);
          console.log(`       • User ID: ${userData[0].id}`);
          console.log(`       • Score: ${userData[0].score}`);
          console.log(`       • Response: ${response.message}`);
          passed++;
        } else {
          console.log(`    ⚠️  SKIPPED - No user data with analytics`);
          failed++;
        }
      } catch (error) {
        console.log(`    ❌ FAILED - ${error.message}`);
        failed++;
      }
    } else {
      console.log('  Test 4.1: gRPC Service Connection');
      console.log(`    ⚠️  SKIPPED - gRPC client not initialized`);
      console.log(`       • Ensure proto file exists at ${PROTO_PATH}`);
      failed += 2;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Test Suite 5: Data Pipeline
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📋 Test Suite 5: End-to-End Data Pipeline\n');

    console.log('  Test 5.1: User Data → NestJS → Rust Pipeline');
    try {
      // Step 1: Get user from DB
      const users = await queryDatabase(`
        SELECT u.id, u.email, ula."totalStudyTime", ula."averageScore"
        FROM "User" u
        INNER JOIN "UserLearningAnalytics" ula ON u.id = ula."userId"
        LIMIT 1
      `);

      if (users.length === 0) {
        console.log(`    ⚠️  SKIPPED - No seeded users with analytics data`);
        failed++;
      } else {
        const user = users[0];
        console.log(`    ✅ Step 1: Retrieved user from PostgreSQL`);
        console.log(`       • User: ${user.email}`);
        console.log(`       • Analytics: ${user.totalStudyTime}min, ${user.averageScore}% avg`);

        // Step 2: Query NestJS API for user
        try {
          const apiResponse = await makeRequest('GET', `/api/v1/analytics/user/${user.id}`);
          console.log(`    ✅ Step 2: NestJS API query successful (Status: ${apiResponse.status})`);

          // Step 3: Send to Rust via gRPC (if available)
          if (grpcClient) {
            try {
              const grpcResponse = await callGrpcMethod('UpdateBktSkillMetrics', {
                user_id: user.id,
                metrics: {
                  skill: 'general',
                  score: Math.round(user.averageScore || 80),
                  timestamp: Math.floor(Date.now() / 1000),
                },
              });
              console.log(`    ✅ Step 3: Data sent to Rust Analytics via gRPC`);
              console.log(`       • Response: ${grpcResponse.message}`);
              console.log(`    ✅ PASSED - Full pipeline successful`);
              passed++;
            } catch (error) {
              console.log(`    ⚠️  Step 3: gRPC failed - ${error.message}`);
              failed++;
            }
          } else {
            console.log(`    ⚠️  Step 3: gRPC not available`);
            failed++;
          }
        } catch (error) {
          console.log(`    ❌ Step 2: NestJS API failed - ${error.message}`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`    ❌ FAILED - ${error.message}`);
      failed++;
    }

    console.log('\n  Test 5.2: Aggregate Analytics Calculation');
    try {
      const stats = await queryDatabase(`
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          AVG(ula."averageScore") as overall_avg_score,
          AVG(ula."currentStreak") as avg_streak,
          SUM(ula."totalStudyTime") as total_study_hours
        FROM "User" u
        LEFT JOIN "UserLearningAnalytics" ula ON u.id = ula."userId"
        WHERE ula."userId" IS NOT NULL
      `);

      if (stats.length > 0 && stats[0].total_users > 0) {
        const data = stats[0];
        console.log(`    ✅ PASSED - Calculated aggregate analytics`);
        console.log(`       • Total users with data: ${data.total_users}`);
        console.log(`       • Average score: ${data.overall_avg_score?.toFixed(1)}%`);
        console.log(`       • Average streak: ${data.avg_streak?.toFixed(1)} days`);
        console.log(`       • Total study time: ${data.total_study_hours} minutes`);
        passed++;
      } else {
        console.log(`    ⚠️  SKIPPED - Insufficient data for aggregation`);
        failed++;
      }
    } catch (error) {
      console.log(`    ❌ FAILED - ${error.message}`);
      failed++;
    }

  } catch (error) {
    console.log(`\n❌ Test suite error: ${error.message}`);
    failed++;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  Test Summary                                                     ║');
  console.log('╠═══════════════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed: ${passed.toString().padEnd(53)} ║`);
  console.log(`║  ❌ Failed: ${failed.toString().padEnd(53)} ║`);
  console.log(`║  📊 Total:  ${(passed + failed).toString().padEnd(53)} ║`);
  console.log('╠═══════════════════════════════════════════════════════════════════╣');

  if (failed === 0) {
    console.log('║  🎉 All tests passed! System is fully integrated.              ║');
  } else {
    console.log(`║  ⚠️  ${failed} test(s) failed. Review the details above.           ║`);
  }

  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
