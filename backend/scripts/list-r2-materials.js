require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('❌ Missing R2 environment variables');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function listR2Materials() {
  try {
    console.log(`🔍 Listing materials in R2 bucket: ${R2_BUCKET_NAME}\n`);
    
    let continuationToken;
    let pageNum = 1;
    const allObjects = [];

    do {
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await s3Client.send(command);
      
      if (response.Contents) {
        allObjects.push(...response.Contents);
        console.log(`📄 Page ${pageNum}: Found ${response.Contents.length} objects`);
      }

      continuationToken = response.NextContinuationToken;
      pageNum++;
    } while (continuationToken);

    // Group by prefix/category
    const grouped = {};
    allObjects.forEach(obj => {
      if (obj.Key) {
        const parts = obj.Key.split('/');
        const category = parts[1] || 'root';
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(obj);
      }
    });

    console.log('\n📊 Materials by Category:\n');
    Object.entries(grouped).forEach(([category, items]) => {
      console.log(`\n📂 ${category.toUpperCase()}: ${items.length} items`);
      items.slice(0, 5).forEach(obj => {
        const size = obj.Size ? `(${(obj.Size / 1024 / 1024).toFixed(2)} MB)` : '';
        console.log(`   - ${obj.Key} ${size}`);
      });
      if (items.length > 5) {
        console.log(`   ... and ${items.length - 5} more`);
      }
    });

    console.log(`\n✅ Total objects in R2: ${allObjects.length}\n`);
    
    // Output specific keys for dermatology/ophthalmology materials
    console.log('🔍 Searching for relevant materials:\n');
    const relevant = [];
    allObjects.forEach(obj => {
      if (obj.Key) {
        const lower = obj.Key.toLowerCase();
        if (lower.includes('derma') || lower.includes('skin') || lower.includes('eye') || 
            lower.includes('ocular') || lower.includes('ophthal')) {
          relevant.push(obj.Key);
          console.log(`✨ ${obj.Key}`);
        }
      }
    });
    
    if (relevant.length === 0) {
      console.log('   (No specific dermatology/ophthalmology materials found)');
    }

  } catch (error) {
    console.error('❌ Error listing R2 materials:', error.message);
    process.exit(1);
  }
}

listR2Materials();
