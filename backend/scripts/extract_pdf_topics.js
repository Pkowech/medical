/**
 * Simple PDF heading extractor to create a skeleton JSON for seed data.
 * Usage: node extract_pdf_topics.js <path-to-pdf> <output-json>
 * 
 * Heuristic-based parsing: Looks for 'Unit' / 'Chapter' lines and numbering like 1.1, 2.1.
 */
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function extract(pdfPath, outPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);
  const text = data.text;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const units = [];
  let currentUnit = null;
  let currentTopic = null;

  const unitRegex = /^\s*(Unit|Chapter|CHAPTER|UNIT)\s+\d+[:\-.–]?\s*(.*)$/i;
  const topicRegex = /^\s*\d+(?:\.\d+)+\s+(.*)$/i; // 1.1, 2.3.1 etc.

  function isUppercaseHeading(line) {
    // Heuristic: mostly uppercase letters, limited length
    const lettersOnly = line.replace(/[^A-Za-z]/g, '');
    if (lettersOnly.length < 4 || line.length > 80) return false;
    return lettersOnly.length > 0 && lettersOnly === lettersOnly.toUpperCase();
  }

  for (const line of lines) {
    const uMatch = unitRegex.exec(line);
    if (uMatch) {
      currentUnit = { name: uMatch[2].toLowerCase().replace(/\s+/g, '-'), title: uMatch[2], topics: [] };
      units.push(currentUnit);
      currentTopic = null;
      continue;
    }

    // If not a classic 'Chapter' line, try uppercase heading detection as a unit
    if (!uMatch && isUppercaseHeading(line)) {
      currentUnit = { name: line.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''), title: line, topics: [] };
      units.push(currentUnit);
      currentTopic = null;
      continue;
    }

    const tMatch = topicRegex.exec(line);
    if (tMatch && currentUnit) {
      currentTopic = { name: tMatch[1].toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''), title: tMatch[1] };
      currentUnit.topics.push(currentTopic);
      continue;
    }

    // Also detect topic lines that look like 'A. Biochemistry of ...' or '1) Topic' and short lines
    const alphaNumTopic = /^\s*[A-Za-z0-9]{1,2}[\.)]\s+(.*)$/i.exec(line);
    if (alphaNumTopic && currentUnit) {
      currentTopic = { name: alphaNumTopic[1].toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''), title: alphaNumTopic[1] };
      currentUnit.topics.push(currentTopic);
      continue;
    }
    // Else, skip.
  }

  fs.writeFileSync(outPath, JSON.stringify({ units }, null, 2));
  console.log('Wrote extract JSON to', outPath);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node extract_pdf_topics.js <input.pdf> <output.json>');
    process.exit(1);
  }
  extract(args[0], args[1]).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { extract };
