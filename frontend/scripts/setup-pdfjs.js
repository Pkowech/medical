#!/usr/bin/env node

/**
 * Setup script to copy PDF.js worker file to public directory
 * This ensures the worker is available for client-side PDF rendering
 */

const fs = require('fs');
const path = require('path');

const reactPdfEntry = require.resolve('react-pdf');
const srcFile = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs', {
  paths: [path.dirname(reactPdfEntry)],
});
const pdfjsDir = path.dirname(path.dirname(srcFile));
const dstDir = path.join(__dirname, '../public/pdfjs');
const dstFile = path.join(dstDir, 'pdf.worker.min.mjs');

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

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
  const pdfjsVersion = require(path.join(pdfjsDir, 'package.json')).version;
  console.log(`✓ Copied PDF.js ${pdfjsVersion} worker to: ${dstFile}`);

  for (const assetDirectory of ['cmaps', 'standard_fonts']) {
    const sourceDirectory = path.join(pdfjsDir, assetDirectory);
    if (!fs.existsSync(sourceDirectory)) {
      throw new Error(`PDF.js asset directory not found: ${sourceDirectory}`);
    }
    copyDirectory(sourceDirectory, path.join(dstDir, assetDirectory));
  }

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
