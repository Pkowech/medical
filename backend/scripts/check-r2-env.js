require('dotenv').config();

console.log('🔍 Checking R2 Environment Variables:\n');
console.log('R2_ENDPOINT:', process.env.R2_ENDPOINT ? '✅ Set' : '❌ Missing');
console.log('R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
console.log('R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing');
console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME ? `✅ Set (${process.env.R2_BUCKET_NAME})` : '❌ Missing');

console.log('\n📦 Checking aws-sdk imports...\n');

try {
  const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
  console.log('✅ @aws-sdk/client-s3 loaded successfully');
  console.log('   - S3Client:', typeof S3Client);
  console.log('   - ListObjectsV2Command:', typeof ListObjectsV2Command);
  
  // Test creating client
  const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  console.log('\n✅ S3Client created successfully');
  console.log('   Endpoint:', process.env.R2_ENDPOINT);
  console.log('   Bucket:', process.env.R2_BUCKET_NAME);
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
}

console.log('\n✅ Script completed');
