from ts_runtime import run_typescript


def test_catalogue_import_requires_stable_slugs_and_unique_parent_orders():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { CourseDifficulty } = require('@prisma/client');
const { validateCatalogue } = require('./scripts/import-catalogue.ts');

const validCatalogue = {
  schemaVersion: 1,
  courses: [{
    code: 'MED-101',
    name: 'medical-foundations',
    title: 'Medical Foundations',
    description: 'Core medical foundations.',
    difficulty: CourseDifficulty.beginner,
    units: [{
      slug: 'anatomy-basics',
      name: 'Anatomy Basics',
      title: 'Anatomy Basics',
      description: 'Introductory anatomy.',
      order: 1,
      estimatedMinutes: 45,
      topics: [{
        slug: 'anatomical-planes',
        name: 'Anatomical planes',
        description: 'Reference planes and directions.',
        order: 1,
        estimatedMinutes: 15,
      }],
    }],
  }],
};

assert.deepEqual(validateCatalogue(validCatalogue), validCatalogue);

const duplicatedOrder = structuredClone(validCatalogue);
duplicatedOrder.courses[0].units[0].topics.push({
  ...duplicatedOrder.courses[0].units[0].topics[0],
  slug: 'body-regions',
  name: 'Body regions',
});
assert.throws(
  () => validateCatalogue(duplicatedOrder),
  /topics.order values must be unique/,
);

const missingSlug = structuredClone(validCatalogue);
delete missingSlug.courses[0].units[0].topics[0].slug;
assert.throws(
  () => validateCatalogue(missingSlug),
  /topics\[0\].slug must be a non-empty string/,
);
"""
    )
