const http = require('http');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const API_BASE = 'http://localhost:3002/v1';

async function makeMultipartRequest(url, formFields, filePath, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const urlObj = new URL(url);

    let body = '';
    for (const [key, value] of Object.entries(formFields)) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      body += `${value}\r\n`;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (extension === '.pdf') contentType = 'application/pdf';
    if (extension === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (extension === '.ppt' || extension === '.pptx') contentType = 'application/vnd.ms-powerpoint';

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
    body += `Content-Type: ${contentType}\r\n\r\n`;

    const bodyStart = Buffer.from(body);
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fullBody = Buffer.concat([bodyStart, fileBuffer, bodyEnd]);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
        Authorization: `Bearer ${token}`,
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

async function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: 'aaronrono427@gmail.com',
      password: 'AU110s/6081/2021MTH'
    });

    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.data?.accessToken || parsed.accessToken);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('📤 Starting Material Upload to R2...');

  const token = await login();
  if (!token) {
    console.error('❌ Login failed');
    return;
  }
  console.log('✅ Authenticated');

  const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const _adapter = new PrismaPg(_pool);
  const prisma = new PrismaClient({ adapter: _adapter });

  const course = await prisma.course.findUnique({
    where: { code: 'PPB422' },
    include: { units: true }
  });

  if (!course) {
    console.error('❌ Course PPB420 not found');
    return;
  }

  const baseDir = 'C:\\Users\\user\\PHARMACY\\LEVEL 4\\LEVEL  4.2\\PPB 420\\PPB 422';
  const filesToUpload = [
    { name: 'Course Outline PPB 422-DERMATOLOGY AND OCULAR DISEASES MARCH-JUNE 2026.docx', unitOrder: 1, type: 'notes' },
    { name: 'PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt', unitOrder: 10, type: 'slide' },
    { name: 'PPB 422 CAT 1 OCT 2022 MARKING SCHEME.pdf', unitOrder: 12, type: 'pdf' }
  ];

  for (const f of filesToUpload) {
    const filePath = path.join(baseDir, f.name);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${f.name}`);
      continue;
    }

    const unit = course.units.find(u => u.order === f.unitOrder);
    if (!unit) {
      console.warn(`⚠️ Unit with order ${f.unitOrder} not found`);
      continue;
    }

    console.log(`📤 Uploading ${f.name} to unit ${unit.title}...`);
    const result = await makeMultipartRequest(
      `${API_BASE}/materials/upload`,
      {
        unitId: unit.id,
        courseId: course.id,
        title: f.name.replace(/\.[^/.]+$/, ""),
        type: f.type,
        description: `Material for ${unit.title}`
      },
      filePath,
      token
    );

    if (result.status === 201 || result.status === 200) {
      console.log(`✅ Uploaded: ${f.name}`);
    } else {
      console.error(`❌ Failed to upload ${f.name}:`, result.data);
    }
  }

  await prisma.$disconnect();
  await _pool.end();
  console.log('✅ Material upload complete!');
}

main().catch(console.error);
