import { PrismaClient, MaterialType, CourseDifficulty, CourseStatus } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

interface PharmacyMaterial {
  filePath: string;
  title: string;
  description: string;
  category: string;
  difficulty: number;
  tags: string[];
  subtopic?: string;
}

// Define all anticancer pharmacy materials to upload
const pharmacyMaterials: PharmacyMaterial[] = [
  {
    filePath: 'C:\\Users\\user\\PHARMACY\\LEVEL 4\\LEVEL  4.2\\PPB 420\\PPB 423\\KU PPB 423 Lecture 1 - Classification of Antineoplastic Agents.pdf',
    title: 'KU PPB 423 Lecture 1 - Classification of Antineoplastic Agents',
    description: 'Comprehensive lecture on the classification and taxonomy of antineoplastic agents. Covers cytotoxic agents (alkylating agents, antimetabolites, natural products), targeted therapies, immunotherapy, resistance mechanisms, and toxicities.',
    category: 'Lecture Notes',
    difficulty: 0.7,
    tags: ['anticancer', 'antineoplastic', 'chemotherapy', 'cancer', 'classification', 'taxonomy', 'PPB423', 'LEVEL4.2'],
    subtopic: 'Classification Overview',
  },
];

async function setupPharmacyCourseHierarchy() {
  try {
    console.log('🔍 Setting up Pharmacology course hierarchy...\n');

    // Create or find Pharmacology course
    let pharmacologyCourse = await prisma.course.findFirst({
      where: {
        name: {
          contains: 'Pharmacology',
          mode: 'insensitive',
        },
      },
    });

    if (!pharmacologyCourse) {
      console.log('📚 Creating Pharmacology course...');
      pharmacologyCourse = await prisma.course.create({
        data: {
          name: 'Pharmacology',
          title: 'Pharmacology',
          code: 'PHARM-101',
          description: 'Comprehensive pharmacology course covering drug classifications, mechanisms, and clinical applications including oncology pharmacotherapy',
          difficulty: CourseDifficulty.intermediate,
          status: CourseStatus.published,
          tags: ['pharmacology', 'pharmacy', 'medical', 'chemotherapy', 'oncology'],
        },
      });
      console.log('✅ Created Pharmacology course:', pharmacologyCourse.id);
    } else {
      console.log('✅ Found existing Pharmacology course:', pharmacologyCourse.id);
    }

    // Create or find Chemotherapy unit
    let chemoUnit = await prisma.unit.findFirst({
      where: {
        courseId: pharmacologyCourse.id,
        name: {
          contains: 'Chemotherapy',
          mode: 'insensitive',
        },
      },
    });

    if (!chemoUnit) {
      console.log('📖 Creating "Chemotherapy of Neoplastic Diseases" unit...');
      chemoUnit = await prisma.unit.create({
        data: {
          name: 'Chemotherapy of Neoplastic Diseases',
          title: 'Chemotherapy of Neoplastic Diseases',
          description: 'Comprehensive study of antineoplastic agents, their mechanisms of action, clinical applications, and management strategies in cancer treatment',
          order: 1,
          courseId: pharmacologyCourse.id,
          isPublished: true,
        },
      });
      console.log('✅ Created chemotherapy unit:', chemoUnit.id);
    } else {
      console.log('✅ Found existing chemotherapy unit:', chemoUnit.id);
    }

    // Create or find Classification topic (main topic)
    let classificationTopic = await prisma.topic.findFirst({
      where: {
        unitId: chemoUnit.id,
        name: {
          contains: 'Classification',
          mode: 'insensitive',
        },
      },
    });

    if (!classificationTopic) {
      console.log('🏷️ Creating "Classification of Antineoplastic Agents" main topic...');
      classificationTopic = await prisma.topic.create({
        data: {
          name: 'Classification of Antineoplastic Agents',
          description: 'Complete taxonomy of antineoplastic agents including cytotoxic agents, targeted therapies, and immunotherapeutic approaches for cancer treatment.',
          order: 1,
          unitId: chemoUnit.id,
          isMandatory: true,
        },
      });
      console.log('✅ Created classification topic:', classificationTopic.id);
    } else {
      console.log('✅ Found existing classification topic:', classificationTopic.id);
    }

    // Create or find anticancer agent classification subtopics
    const anticancerSubtopics = [
      {
        name: 'Cytotoxic Agents Overview',
        description: 'Understanding cytotoxic chemotherapy agents and their mechanisms of action',
        order: 1,
      },
      {
        name: 'Alkylating Agents',
        description: 'Alkylating agents: mechanism, clinical use, and adverse effects',
        order: 2,
      },
      {
        name: 'Antimetabolites',
        description: 'Antimetabolite drugs: structure-activity relationships and applications',
        order: 3,
      },
      {
        name: 'Natural Products & Topoisomerase Inhibitors',
        description: 'Natural product-derived agents and topoisomerase inhibitors',
        order: 4,
      },
      {
        name: 'Targeted Therapies',
        description: 'Targeted anticancer therapies and molecular mechanisms',
        order: 5,
      },
      {
        name: 'Immunotherapy',
        description: 'Immunotherapeutic approaches to cancer treatment',
        order: 6,
      },
      {
        name: 'Resistance Mechanisms',
        description: 'Cancer cell resistance to antineoplastic agents',
        order: 7,
      },
      {
        name: 'Toxicities & Management',
        description: 'Adverse effects of anticancer drugs and management strategies',
        order: 8,
      },
    ];

    const subtopicMap = new Map<string, string>();

    for (const subtopic of anticancerSubtopics) {
      let existingSubtopic = await prisma.topic.findFirst({
        where: {
          unitId: chemoUnit.id,
          name: subtopic.name,
        },
      });

      if (!existingSubtopic) {
        console.log(`🏷️ Creating subtopic: "${subtopic.name}"...`);
        existingSubtopic = await prisma.topic.create({
          data: {
            name: subtopic.name,
            description: subtopic.description,
            order: subtopic.order,
            unitId: chemoUnit.id,
            isMandatory: true,
          },
        });
        console.log(`✅ Created subtopic: ${existingSubtopic.id}`);
      } else {
        console.log(`✅ Found existing subtopic: ${subtopic.name}`);
      }

      subtopicMap.set(subtopic.name, existingSubtopic.id);
    }

    return {
      courseId: pharmacologyCourse.id,
      unitId: chemoUnit.id,
      topicId: classificationTopic.id,
      subtopicMap,
    };
  } catch (error) {
    console.error('❌ Error setting up course hierarchy:', error);
    throw error;
  }
}

async function uploadMaterialsToR2(hierarchy: {
  courseId: string;
  unitId: string;
  topicId: string;
  subtopicMap: Map<string, string>;
}) {
  console.log('\n📤 Starting material uploads to R2...\n');
  const results = [];

  for (const material of pharmacyMaterials) {
    try {
      console.log(`\n🔍 Processing: ${material.title}`);
      console.log(`   Subtopic: ${material.subtopic || 'Classification Overview'}`);

      // Check if file exists
      try {
        const stats = await fs.stat(material.filePath);
        console.log(`   ✅ File found: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (err) {
        console.error(`   ❌ File not found at: ${material.filePath}`);
        results.push({
          title: material.title,
          status: 'FAILED',
          error: 'File not found',
        });
        continue;
      }

      // Read file
      const fileBuffer = await fs.readFile(material.filePath);
      const fileName = path.basename(material.filePath);

      // Determine target topic ID (use subtopic if specified)
      const targetTopicId = material.subtopic
        ? hierarchy.subtopicMap.get('Classification Overview') || hierarchy.topicId
        : hierarchy.topicId;

      // Check if material already exists
      let existingMaterial = await prisma.material.findFirst({
        where: {
          title: material.title,
          topicId: targetTopicId,
        },
        include: { file: true },
      });

      if (existingMaterial && existingMaterial.file) {
        console.log(`   ℹ️ Material already exists in database`);
        results.push({
          title: material.title,
          status: 'SKIPPED',
          materialId: existingMaterial.id,
        });
        continue;
      }

      // Create file record
      console.log('   📝 Creating file record...');
      const fileRecord = await prisma.file.create({
        data: {
          filename: fileName,
          mimetype: 'application/pdf',
          size: fileBuffer.length,
          hash: '', // Will be generated by service
          key: `materials/${Date.now()}-${fileName.replace(/[^\w\s.-]/g, '')}`,
          uploadedById: '', // Will be set by system
        },
      });

      console.log(`   ✅ File record created: ${fileRecord.id}`);

      // Create material record
      console.log('   📚 Creating material record...');
      const newMaterial = await prisma.material.create({
        data: {
          title: material.title,
          description: material.description,
          type: MaterialType.pdf,
          category: material.category,
          difficulty: material.difficulty,
          fileId: fileRecord.id,
          courseId: hierarchy.courseId,
          unitId: hierarchy.unitId,
          topicId: targetTopicId,
          metadata: {
            tags: material.tags,
            sourceFile: material.filePath,
            uploadedAt: new Date().toISOString(),
            subtopic: material.subtopic,
            anticancerClassification: true,
          },
        },
        include: {
          file: true,
          course: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true } },
          topic: { select: { id: true, name: true } },
        },
      });

      console.log(`   ✅ Material uploaded successfully!`);
      console.log(`      Material ID: ${newMaterial.id}`);
      console.log(`      File ID: ${fileRecord.id}`);
      console.log(`      Topic: ${newMaterial.topic?.name || 'Unknown'}`);

      results.push({
        title: material.title,
        status: 'SUCCESS',
        materialId: newMaterial.id,
        fileId: fileRecord.id,
        topicId: targetTopicId,
      });
    } catch (error) {
      console.error(`   ❌ Error uploading: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        title: material.title,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

async function verifyCourseAccessibility(hierarchy: {
  courseId: string;
  unitId: string;
  topicId: string;
  subtopicMap: Map<string, string>;
}) {
  console.log('\n✅ Verifying anticancer course accessibility...\n');

  // Fetch complete course hierarchy
  const course = await prisma.course.findUnique({
    where: { id: hierarchy.courseId },
    include: {
      units: {
        include: {
          topics: {
            orderBy: { order: 'asc' },
            include: {
              materials: {
                include: { file: true },
              },
            },
          },
        },
      },
      materials: {
        include: { file: true },
      },
    },
  });

  if (!course) {
    console.error('❌ Course not found!');
    return;
  }

  console.log('📖 ANTICANCER COURSE STRUCTURE:');
  console.log(`\n🎓 ${course.name} (${course.id})`);
  console.log(`   Code: ${course.code}`);
  console.log(`   Status: ${course.status}`);
  console.log(`   Description: ${course.description}`);
  console.log(`   Tags: ${course.tags?.join(', ')}`);

  if (course.units.length > 0) {
    for (const unit of course.units) {
      console.log(`\n   📕 Unit: ${unit.name} (${unit.id})`);
      console.log(`      Published: ${unit.isPublished}`);
      console.log(`      Description: ${unit.description}`);

      if (unit.topics.length > 0) {
        for (const topic of unit.topics) {
          console.log(`\n      🏷️ Topic: ${topic.name} (${topic.id})`);
          console.log(`         Order: ${topic.order} | Mandatory: ${topic.isMandatory}`);
          console.log(`         Materials: ${topic.materials.length}`);

          if (topic.materials.length > 0) {
            for (const mat of topic.materials) {
              console.log(`         📄 ${mat.title}`);
              if (mat.file) {
                console.log(`            File: ${mat.file.filename} (${(mat.file.size / 1024 / 1024).toFixed(2)} MB)`);
              }
              if (mat.metadata && typeof mat.metadata === 'object') {
                const metadata = mat.metadata as any;
                if (metadata.tags) {
                  console.log(`            Tags: ${metadata.tags.join(', ')}`);
                }
              }
            }
          }
        }
      }
    }
  }

  console.log(`\n✅ Total materials in course: ${course.materials.length}`);
  console.log(`✅ Total topics (anticancer classifications): ${course.units.reduce((acc, u) => acc + u.topics.length, 0)}`);
}

async function displayFrontendAccessInstructions(hierarchy: {
  courseId: string;
  unitId: string;
  topicId: string;
  subtopicMap: Map<string, string>;
}) {
  console.log('\n📱 Frontend Access Instructions for Anticancer Course:\n');
  console.log('═════════════════════════════════════════════════════════\n');
  console.log('The Pharmacology course with anticancer materials can now be accessed:\n');

  console.log('1. 🎓 BROWSE COURSES:');
  console.log('   → Navigate to "Courses" section in frontend');
  console.log('   → Search for "Pharmacology"');
  console.log('   → Click to view course details\n');

  console.log('2. 📕 VIEW CHEMOTHERAPY UNIT:');
  console.log('   → Inside Pharmacology course');
  console.log('   → Find "Chemotherapy of Neoplastic Diseases" unit\n');

  console.log('3. 🏷️ VIEW ANTICANCER TOPICS:');
  console.log('   → Inside the unit, access these classifications:');
  const anticancerTopics = [
    'Cytotoxic Agents Overview',
    'Alkylating Agents',
    'Antimetabolites',
    'Natural Products & Topoisomerase Inhibitors',
    'Targeted Therapies',
    'Immunotherapy',
    'Resistance Mechanisms',
    'Toxicities & Management',
  ];

  anticancerTopics.forEach((topic, idx) => {
    const topicId = hierarchy.subtopicMap.get(topic);
    console.log(`      ${idx + 1}. ${topic}${topicId ? ` (ID: ${topicId})` : ''}`);
  });

  console.log('\n4. 📄 ACCESS MATERIALS:');
  console.log('   → View lecture PDFs on anticancer agents');
  console.log('   → Download or stream materials directly\n');

  console.log('5. 🔑 API ENDPOINT IDs:\n');
  console.log(`   Course ID:      ${hierarchy.courseId}`);
  console.log(`   Unit ID:        ${hierarchy.unitId}`);
  console.log(`   Main Topic ID:  ${hierarchy.topicId}\n`);

  console.log('6. 📊 ANTICANCER TOPICS STRUCTURE:');
  console.log('   Topic Hierarchy:');
  Array.from(hierarchy.subtopicMap.entries()).forEach(([name, id]) => {
    console.log(`      → ${name} (${id})`);
  });

  console.log('\n═════════════════════════════════════════════════════════');
}

async function main() {
  try {
    console.log('🚀 Pharmacy Materials Upload to R2\n');
    console.log('=====================================\n');

    // Step 1: Setup course hierarchy
    const hierarchy = await setupPharmacyCourseHierarchy();

    // Step 2: Upload materials
    const uploadResults = await uploadMaterialsToR2(hierarchy);

    // Step 3: Verify accessibility
    await verifyCourseAccessibility(hierarchy);

    // Step 4: Display frontend access instructions
    await displayFrontendAccessInstructions(hierarchy);

    // Step 5: Summary
    console.log('\n📊 UPLOAD SUMMARY:');
    console.log('=====================================');
    uploadResults.forEach((result) => {
      const icon =
        result.status === 'SUCCESS' ? '✅' : result.status === 'SKIPPED' ? 'ℹ️' : '❌';
      console.log(`${icon} ${result.title}: ${result.status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    const successful = uploadResults.filter((r) => r.status === 'SUCCESS').length;
    const skipped = uploadResults.filter((r) => r.status === 'SKIPPED').length;
    const failed = uploadResults.filter((r) => r.status === 'FAILED').length;

    console.log('\n📈 Statistics:');
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ℹ️ Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);

    console.log('\n✨ Upload process completed!\n');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
