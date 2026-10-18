import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

const endpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error(
    'Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY before running this check.',
  );
}

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

async function run() {
  try {
    const data = await s3.send(new ListBucketsCommand({}));
    console.log('Buckets:', data.Buckets?.map(bucket => bucket.Name));
    console.log('Success: R2 is reachable!');
  } catch (error) {
    console.error(
      'R2 connectivity check failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    process.exitCode = 1;
  } finally {
    s3.destroy();
  }
}

void run();
