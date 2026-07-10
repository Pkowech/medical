#!/usr/bin/env node
/**
 * JWT Token Generator for Rust Analytics Service
 * Generates a valid HS256 JWT token using the shared JWT_SECRET
 */

const crypto = require('crypto');

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
    sub: 'user123',
    exp: expiryDate,
    iat: Math.floor(Date.now() / 1000)
};

// Encode to base64url
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

// Sign with HMAC-SHA256
const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'base64'))
    .update(message)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

const token = `${message}.${signature}`;

console.log('Generated JWT Token:');
console.log(token);
console.log('');
console.log('Token Details:');
console.log('  Algorithm:', algorithm);
console.log('  Secret:', secret);
console.log('  Subject:', payload.sub);
console.log('  Issued At:', new Date(payload.iat * 1000).toISOString());
console.log('  Expires At:', new Date(payload.exp * 1000).toISOString());
console.log('');
console.log('Usage:');
console.log('  curl -H "Authorization: Bearer ' + token + '" http://127.0.0.1:8000/health');
