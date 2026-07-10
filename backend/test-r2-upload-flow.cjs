// Test script using real seed data credentials - Fixed response parsing
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3002/v1';

async function makeRequest(method, url, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          // Handle wrapped responses {success: true, data: {...}}
          if (parsed.success && parsed.data) {
            resolve({ status: res.statusCode, data: parsed.data });
          } else {
            resolve({ status: res.statusCode, data: parsed });
          }
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

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
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
    body += `Content-Type: application/pdf\r\n\r\n`;

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

async function testR2UploadFlow() {
  console.log('🔄 Testing Frontend-to-R2 Upload Flow...\n');

  // Step 1: Login with SEED DATA credentials
  console.log('📋 Step 1: Authenticating...');
  
  const result = await makeRequest('POST', `${API_BASE}/auth/login`, {
    email: 'aaronrono427@gmail.com',
    password: 'AU110s/6081/2021MTH'
  });

  if (!result.data?.accessToken) {
    console.log('  ❌ Login failed:', result.data);
    return;
  }
  
  const token = result.data.accessToken;
  console.log('  ✅ Logged in as: aaronrono427@gmail.com');

  // Step 2: Get units
  console.log('\n📋 Step 2: Getting available units...');
  const unitsResult = await makeRequest('GET', `${API_BASE}/units`, null, {
    Authorization: `Bearer ${token}`,
  });

  let unitId;
  const units = Array.isArray(unitsResult.data) ? unitsResult.data : [];
  
  if (units.length > 0) {
    unitId = units[0].id;
    console.log(`  ✅ Found ${units.length} units. Using: ${units[0].title || unitId}`);
  } else {
    // Fallback to searching courses -> units
    console.log('  ⚠️  No units found directly. Trying via courses...');
    const coursesResult = await makeRequest('GET', `${API_BASE}/courses`, null, {
      Authorization: `Bearer ${token}`,
    });
    
    const courses = Array.isArray(coursesResult.data) ? coursesResult.data : [];
     if (courses.length > 0) {
      console.log(`  Found ${courses.length} courses.`);
      const course = courses[0];
      
      const courseUnitsResult = await makeRequest('GET', `${API_BASE}/courses/${course.id}/units`, null, {
        Authorization: `Bearer ${token}`,
      });
      const courseUnits = Array.isArray(courseUnitsResult.data) ? courseUnitsResult.data : [];
      
      if (courseUnits.length > 0) {
         unitId = courseUnits[0].id;
         console.log(`  ✅ Found unit via course: ${courseUnits[0].title || unitId}`);
      } else {
         console.log('  ❌ Course has no units.');
         return;
      }
    } else {
      console.log('  ❌ No courses found even after seeding.');
      return;
    }
  }

  // Step 3: Create test PDF
  console.log('\n📋 Step 3: Creating test PDF...');
  const testPdfPath = path.join(__dirname, 'test-upload.pdf');
  const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
178
%%EOF`;
  fs.writeFileSync(testPdfPath, pdfContent);
  console.log(`  ✅ Created test PDF (${pdfContent.length} bytes)`);

  // Step 4: Upload
  console.log('\n📋 Step 4: Uploading file via /materials/upload...');
  try {
    const uploadResult = await makeMultipartRequest(
      `${API_BASE}/materials/upload`,
      {
        unitId,
        title: 'R2 Test Upload ' + new Date().toISOString(),
        description: 'Testing R2 connectivity',
        type: 'pdf',
      },
      testPdfPath,
      token
    );

    console.log('  Response status:', uploadResult.status);
    
    if (uploadResult.status === 201 || uploadResult.status === 200) {
      console.log('  ✅ UPLOAD SUCCESS!');
      console.log('  Material ID:', uploadResult.data?.id);
      
      if (uploadResult.data?.file?.key) {
        console.log('  Storage Key:', uploadResult.data.file.key);
        console.log('\n🎉 FILE UPLOADED TO R2 SUCCESSFULLY!');
      } else {
        console.log('  Response data:', JSON.stringify(uploadResult.data, null, 2));
      }
    } else {
      console.log('  ❌ Upload failed');
      console.log('  Response:', JSON.stringify(uploadResult.data, null, 2));
    }
  } catch (error) {
    console.log('  ❌ Upload ERROR:', error.message);
  }

  // Cleanup
  try { fs.unlinkSync(testPdfPath); } catch {}
}

testR2UploadFlow().catch(console.error);
