#!/usr/bin/env node
/**
 * Generate JWT token using the exact same algorithm as Rust jsonwebtoken crate
 * Uses HMAC-SHA256 with raw string bytes (not base64)
 */

const crypto = require('crypto');

// Use the JWT_SECRET as a raw string (UTF-8 bytes)
const secret = 'r91t0ofaB1PoLXM5NNGQWOWkie5FDZ1p6aMhLl3an24=';
const algorithm = 'HS256';
const expiryDate = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year from now

// Header
const header = {
    alg: algorithm,
    typ: 'JWT'
};

// Payload
const payload = {
    sub: 'c7cd5aef-fe8a-4158-a735-24414694571a',
    exp: expiryDate,
    iat: Math.floor(Date.now() / 1000)
};

// Base64url encode without padding
function base64urlEscape(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Create token
const headerEncoded = base64urlEscape(JSON.stringify(header));
const payloadEncoded = base64urlEscape(JSON.stringify(payload));
const message = `${headerEncoded}.${payloadEncoded}`;

console.log('=== Token Generation Debug ===');
console.log('Secret (as string):', secret);
console.log('Secret (as bytes):', Buffer.from(secret).toString('hex'));
console.log('Header:', header);
console.log('Payload:', payload);
console.log('');

// Sign with JWT_SECRET
const hmac = crypto.createHmac('sha256', secret);
hmac.update(message);
const signature = base64urlEscape(hmac.digest('base64'));
const token = `${message}.${signature}`;

console.log('generated JWT with JWT_SECRET:');
console.log(token);
console.log('');

// Sign with NEXTAUTH_SECRET
const nextAuthSecret = 'qF+4oB5BjGI5a6DKt7OK7jt16P3G1HDx5wAseOVre38=';
const hmac2 = crypto.createHmac('sha256', nextAuthSecret);
hmac2.update(message);
const signature2 = base64urlEscape(hmac2.digest('base64'));
const token2 = `${message}.${signature2}`;

console.log('generated JWT with NEXTAUTH_SECRET:');
console.log(token2);
console.log('');

// Sign with fallback secret
const fallbackSecret = 'fallback_secret_for_dev';
const hmac3 = crypto.createHmac('sha256', fallbackSecret);
hmac3.update(message);
const signature3 = base64urlEscape(hmac3.digest('base64'));
const token3 = `${message}.${signature3}`;

console.log('generated JWT with FALLBACK_SECRET:');
console.log(token3);
console.log('');

