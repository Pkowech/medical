import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// Configuration
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('❌ Missing R2 environment variables. Please check your .env file.');
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

function slugify(input: string) {
  return input
    .toString()
    .toLowerCase()
    .replace(/[\s\t\n\r]+/g, '-')
    .replace(/[^a-z0-9\-\.]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^\-|\-$/g, '');
}

async function getFilesRecursively(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFilesRecursively(res) : res;
    })
  );
  return Array.prototype.concat(...files);
}

async function uploadFile(filePath: string, bucket: string, rootDir: string) {
  const relativePath = path.relative(rootDir, filePath);
  // Create a key structure like: textbooks/category/filename.pdf
  // Using forward slashes for S3 keys regardless of OS
  const key = 'textbooks/' + relativePath.split(path.sep).map(p => slugify(p)).join('/');
  
  const fileBuffer = await fs.readFile(filePath);
  const contentType = filePath.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';

  // Check if exists (optional optimization, but good for large uploads)
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`⏭️  Skipping existing: ${key}`);
  } catch (e) {
    // Doesn't exist, upload it
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }));
    console.log(`⬆️  Uploaded: ${key}`);
  }

  // Construct Public/Presigned ready info
  // For R2, the public URL might depend on custom domain, but we mainly need the Key for the backend to sign URLs.
  // We'll store the key and a theoretical S3 URL.
  return {
    key,
    s3Url: `${R2_ENDPOINT}/${bucket}/${key}`, // This is technical, not necessarily the public access URL
    originalPath: filePath
  };
}

async function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0] || 'C:\\Users\\user\\PHARMACY\\TEXTBOOKS'; // Default path

  console.log(`🚀 Starting upload to R2 Bucket: ${R2_BUCKET_NAME}`);
  console.log(`📂 Scanning directory: ${targetDir}`);

  try {
    await fs.access(targetDir);
  } catch {
    console.error(`❌ Directory not found: ${targetDir}`);
    process.exit(1);
  }

  const allFiles = await getFilesRecursively(targetDir);
  const pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));

  console.log(`Found ${pdfFiles.length} PDF files to process.`);

  const mapping: Record<string, { s3Url: string; key: string; fileId: string }> = {};

  // Process in chunks to avoid overwhelming network/memory
  const CHUNK_SIZE = 5;
  for (let i = 0; i < pdfFiles.length; i += CHUNK_SIZE) {
    const chunk = pdfFiles.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (filePath) => {
        try {
            const result = await uploadFile(filePath, R2_BUCKET_NAME!, targetDir);
            const filename = path.basename(filePath);
            const fileId = `file-${slugify(filename.replace('.pdf', ''))}`;
            
            mapping[filePath] = { 
                s3Url: result.s3Url, 
                key: result.key, 
                fileId 
            };
            // Also map by filename for looser matching
            mapping[filename] = { 
                s3Url: result.s3Url, 
                key: result.key, 
                fileId 
            };
        } catch (err) {
            console.error(`❌ Failed to upload ${filePath}:`, err);
        }
    }));
  }

  // Write mapping to seeds folder
  const outPath = path.join(process.cwd(), 'prisma', 'seeds', 'file-mappings.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(mapping, null, 2));
  console.log(`\n✅ Upload complete. Mappings written to: ${outPath}`);
}

main().catch(console.error);
