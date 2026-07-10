import fs from 'fs/promises';
import path from 'path';

// Simple slugify helper to create stable names used by seeds
function slugify(input: string) {
  return input
    .toString()
    .toLowerCase()
    .replace(/[\s\t\n\r]+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^\-|\-$/g, '');
}

async function convertExtractToSeed(inPath: string, outPath?: string) {
  const resolvedIn = path.resolve(inPath);
  const resolvedOut = outPath ? path.resolve(outPath) : path.join(path.dirname(resolvedIn), path.basename(resolvedIn, '.json') + '.converted.json');

  const raw = await fs.readFile(resolvedIn, 'utf-8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.units)) {
    throw new Error('Input must be an object with a top-level array `units`');
  }

  // Clean and convert to the UnitData + TopicData shape used in the seed
  const cleanedUnits = [] as any[];
  let unitOrder = 0;
  for (const unit of parsed.units) {
    const title = (unit.title || unit.name || '').trim();
    const hasValidTitle = title.length > 3 && /[a-z0-9]/i.test(title);
    const hasTopics = Array.isArray(unit.topics) && unit.topics.length > 0;

    if (!hasValidTitle && !hasTopics) continue; // drop blank entries

    unitOrder++;
    const unitName = slugify(title || `unit-${unitOrder}`);
    const topics = [] as any[];

    let topicOrder = 0;
    for (const t of (unit.topics || [])) {
      const tTitle = (t.title || t.name || '').trim();
      if (!tTitle || tTitle.length < 2) continue;
      topicOrder++;
      topics.push({
        name: slugify(tTitle),
        description: tTitle,
        order: topicOrder,
        duration: 10,
      });
    }

    // If there were no topics but the unit has a meaningful heading, create an Overview topic
    if (!topics.length) {
      topics.push({ name: 'overview', description: `${title} — Overview`, order: 1, duration: 18 });
    }

    cleanedUnits.push({
      name: unitName,
      title: title || unitName,
      description: title || '',
      order: unitOrder,
      duration: topics.reduce((acc, t) => acc + (t.duration || 10), 0),
      topics,
    });
  }

  const output = { units: cleanedUnits };
  await fs.writeFile(resolvedOut, JSON.stringify(output, null, 2));
  return resolvedOut;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Usage: ts-node convert_extract_to_seed.ts <extract.json> [<out.json>]');
    process.exit(1);
  }
  try {
    const out = await convertExtractToSeed(args[0], args[1]);
    console.log('Converted extract to seed units JSON:', out);
  } catch (err) {
    console.error('Error converting extract:', err);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}
