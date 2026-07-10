const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Load proto
const PROTO_PATH = path.join(__dirname, '..', 'protos', 'analytics.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const analyticsProto = grpc.loadPackageDefinition(packageDefinition).analytics;

// Connect to gRPC server
const client = new analyticsProto.AnalyticsService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

console.log('Testing UpdateBktSkillMetrics gRPC call...');
console.log('Server: localhost:50051');

// Test the new UpdateBktSkillMetrics method
client.UpdateBktSkillMetrics({}, (err, response) => {
  if (err) {
    console.error('❌ gRPC Error:', err.message);
    process.exit(1);
  }
  console.log('✅ gRPC Response:', response);
  console.log(`   Success: ${response.success}`);
  console.log(`   Message: ${response.message}`);
  process.exit(0);
});
