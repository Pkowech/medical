#!/usr/bin/env node

/**
 * Setup script to copy PDF.js worker file to public directory
 * This ensures the worker is available for client-side PDF rendering
 */

const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const dstDir = path.join(__dirname, '../public/pdfjs');
const dstFile = path.join(dstDir, 'pdf.worker.min.mjs');

try {
  // Create directory if it doesn't exist
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
    console.log(`✓ Created directory: ${dstDir}`);
  }

  // Check if source file exists
  if (!fs.existsSync(srcFile)) {
    console.error(`✗ Source file not found: ${srcFile}`);
    process.exit(1);
  }

  // Copy the worker file
  fs.copyFileSync(srcFile, dstFile);
  console.log(`✓ Copied PDF.js worker to: ${dstFile}`);

  // Verify the copy
  if (fs.existsSync(dstFile)) {
    const stats = fs.statSync(dstFile);
    console.log(`✓ Verified (${stats.size} bytes)`);
  }
} catch (error) {
  console.error('✗ Failed to setup PDF.js worker:');
  console.error(error.message);
  process.exit(1);
}
