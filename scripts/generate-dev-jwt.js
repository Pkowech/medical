#!/usr/bin/env node
/**
 * Dev helper: generate a HS256 JWT using backend/.env JWT_SECRET (or fallback)
 * Usage: node scripts/generate-dev-jwt.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readEnv(envPath) {
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) {
        let val = m[2];
        // strip optional surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[m[1]] = val;
      }
    }
    return env;
  } catch (err) {
    return {};
  }
}

const envPath = path.resolve(__dirname, '..', 'backend', '.env');
const env = readEnv(envPath);
const secret = env.JWT_SECRET || env.SESSION_SECRET || 'dev-secret';

const header = { alg: 'HS256', typ: 'JWT' };
const now = Math.floor(Date.now() / 1000);
const payload = {
  sub: env.DEV_TEST_USER_ID || 'dev-user',
  iat: now,
  exp: now + 60 * 60 * 24 * 365, // 1 year
};

const headerEncoded = base64url(JSON.stringify(header));
const payloadEncoded = base64url(JSON.stringify(payload));
const message = `${headerEncoded}.${payloadEncoded}`;

const signature = crypto.createHmac('sha256', secret).update(message).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = `${message}.${signature}`;

console.log('\nGenerated dev JWT token (HS256):\n');
console.log(token + '\n');
console.log('If this token does not authenticate, ensure backend/.env JWT_SECRET matches the server configuration.');
console.log('\nExample curl:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3002/v1/materials/paginated?page=1&limit=5`);
