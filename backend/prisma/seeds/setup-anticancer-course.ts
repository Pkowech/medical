import 'dotenv/config';
import { PrismaClient, CourseDifficulty, CourseStatus, MaterialType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

// Create a Postgres pool + Prisma adapter for running seeds directly with tsx
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface TopicConfig {
  name: string;
  description: string;
  order: number;
  subtopics?: TopicConfig[];
}

// Define the complete anticancer hierarchy from the diagram
const anticancerHierarchy: TopicConfig[] = [
  {
    name: 'Cytotoxic Agents',
    description: 'Traditional chemotherapy agents that directly kill cancer cells through various mechanisms',
    order: 1,
    subtopics: [
      {
        name: 'Alkylating Agents',
        description: 'Agents that form covalent bonds with DNA, causing crosslinking and cell death. Include nitrogen mustards, nitrosoureas, and platinum compounds.',
        order: 1,
      },
      {
        name: 'Antimetabolites',
        description: 'Drugs that interfere with nucleotide synthesis and DNA/RNA metabolism. Include pyrimidine and purine analogs.',
        order: 2,
      },
      {
        name: 'Natural Products',
        description: 'Natural product-derived agents including vinca alkaloids, taxanes, epipodophyllotoxins, and topoisomerase inhibitors.',
        order: 3,
      },
    ],
  },
  {
    name: 'Targeted Therapies',
    description: 'Drugs designed to target specific molecular abnormalities and pathways in cancer cells',
    order: 2,
    subtopics: [
      {
        name: 'Growth Factor & Receptor Inhibitors',
        description: 'Inhibitors of growth factor receptors including EGFR, HER2, and VEGFR. Target extracellular ligand-receptor interactions.',
        order: 1,
      },
      {
        name: 'Intracellular Kinase Inhibitors',
        description: 'Inhibitors of intracellular signaling kinases including BRAF, JAK, mTOR, and BCR-ABL. Target downstream signaling pathways.',
        order: 2,
      },
      {
        name: 'Cell Behaviour & Other Targets',
        description: 'Agents targeting cell cycle checkpoints, apoptosis pathways, proteasome, histone deacetylases, and other cellular mechanisms.',
        order: 3,
      },
    ],
  },
  {
    name: 'Immunotherapy',
    description: 'Immunological approaches to cancer treatment including checkpoint inhibitors, cancer vaccines, and adoptive cell therapy',
    order: 3,
  },
  {
    name: 'Resistance Mechanisms',
    description: 'Understanding how cancer cells develop resistance to antineoplastic agents through genetic and epigenetic alterations',
    order: 4,
  },
  {
    name: 'Toxicities',
    description: 'Adverse effects of anticancer drugs including bone marrow suppression, cardiotoxicity, nephrotoxicity, and management strategies',
    order: 5,
  },
];

async function createTopicHierarchy(
  unitId: string,
  topics: TopicConfig[],
  parentTopicId?: string,
  startOrder: number = 1
): Promise<{ topicMap: Map<string, string>; nextOrder: number }> {
  const topicMap = new Map<string, string>();
  let currentOrder = startOrder;

  for (const topicConfig of topics) {
    console.log(`\n🏷️  Creating topic: "${topicConfig.name}"`);

    let topic = await prisma.topic.findFirst({
      where: {
        unitId: unitId,
        name: topicConfig.name,
      },
    });

    if (!topic) {
      topic = await prisma.topic.create({
        data: {
          name: topicConfig.name,
          description: topicConfig.description,
          order: currentOrder,
          unitId: unitId,
          isMandatory: true,
        },
      });
      console.log(`✅ Created topic: ${topic.id}`);
    } else {
      console.log(`✅ Found existing topic: ${topic.id}`);
    }

    currentOrder++;
    topicMap.set(topicConfig.name, topic.id);

    // Recursively create subtopics
    if (topicConfig.subtopics && topicConfig.subtopics.length > 0) {
      const subtopicResult = await createTopicHierarchy(
        unitId,
        topicConfig.subtopics,
        topic.id,
        currentOrder
      );
      
      currentOrder = subtopicResult.nextOrder;
      
      for (const [subtopicName, subtopicId] of subtopicResult.topicMap.entries()) {
        topicMap.set(`${topicConfig.name} > ${subtopicName}`, subtopicId);
      }
    }
  }

  return { topicMap, nextOrder: currentOrder };
}

async function setupAnticancerCourse() {
  try {
    console.log('\n╔═════════════════════════════════════════════════════════╗');
    console.log('║  🚀 Setting up Anticancer Pharmacy Course Hierarchy    ║');
    console.log('╚═════════════════════════════════════════════════════════╝\n');

    // Create or find Pharmacology course
    console.log('📚 Setting up course...');
    let pharmacologyCourse = await prisma.course.findFirst({
      where: {
        name: {
          contains: 'Pharmacology',
          mode: 'insensitive',
        },
      },
    });

    if (!pharmacologyCourse) {
      console.log('Creating new Pharmacology course...');
      pharmacologyCourse = await prisma.course.create({
        data: {
          name: 'Pharmacology',
          title: 'Pharmacology',
          code: 'PHARM-101',
          description: 'Comprehensive pharmacology course covering drug classifications, mechanisms, and clinical applications including anticancer agents',
          difficulty: CourseDifficulty.intermediate,
          status: CourseStatus.published,
          tags: ['pharmacology', 'pharmacy', 'medical', 'anticancer', 'chemotherapy', 'oncology'],
        },
      });
      console.log('✅ Created Pharmacology course:', pharmacologyCourse.id);
    } else {
      console.log('✅ Found existing Pharmacology course:', pharmacologyCourse.id);
    }

    // Create or find Chemotherapy unit
    console.log('\n📖 Setting up unit...');
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
      // Find the next available order number
      const existingUnits = await prisma.unit.findMany({
        where: { courseId: pharmacologyCourse.id },
        orderBy: { order: 'desc' },
        take: 1,
      });

      const nextOrder = (existingUnits[0]?.order ?? 0) + 1;

      console.log('Creating "Chemotherapy of Neoplastic Diseases" unit...');
      chemoUnit = await prisma.unit.create({
        data: {
          name: 'Chemotherapy of Neoplastic Diseases',
          title: 'Chemotherapy of Neoplastic Diseases',
          description: 'Comprehensive study of antineoplastic agents, their classification, mechanisms of action, and clinical applications in cancer treatment',
          order: nextOrder,
          courseId: pharmacologyCourse.id,
          isPublished: true,
        },
      });
      console.log('✅ Created chemotherapy unit:', chemoUnit.id);
    } else {
      console.log('✅ Found existing chemotherapy unit:', chemoUnit.id);
    }

    // Create all anticancer topics and subtopics
    console.log('\n🏷️  Setting up anticancer topic hierarchy...\n');
    console.log('═══════════════════════════════════════════════════════');
    const { topicMap } = await createTopicHierarchy(chemoUnit.id, anticancerHierarchy);
    console.log('═══════════════════════════════════════════════════════\n');

    // Upload the PDF material
    const pdfPath = 'C:\\Users\\user\\PHARMACY\\LEVEL 4\\LEVEL  4.2\\PPB 420\\PPB 423\\KU PPB 423 Lecture 1 - Classification of Antineoplastic Agents.pdf';
    
    console.log('📤 Processing material...');
    try {
      const stats = await fs.stat(pdfPath);
      console.log(`✅ Found PDF file: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      // Check if material already exists
      let existingMaterial = await prisma.material.findFirst({
        where: {
          title: {
            contains: 'Classification of Antineoplastic Agents',
            mode: 'insensitive',
          },
          courseId: pharmacologyCourse.id,
        },
      });

      if (!existingMaterial) {
        console.log('📝 Creating material record...');
        
        // Use the main Cytotoxic Agents topic as default
        const mainTopicId = topicMap.get('Cytotoxic Agents') || '';

        const material = await prisma.material.create({
          data: {
            title: 'KU PPB 423 Lecture 1 - Classification of Antineoplastic Agents',
            description: 'Comprehensive lecture covering the complete taxonomy and classification of anticancer drugs including cytotoxic agents, targeted therapies, immunotherapy, and resistance mechanisms',
            type: MaterialType.pdf,
            category: 'Lecture Notes',
            difficulty: 0.7,
            topicId: mainTopicId,
            unitId: chemoUnit.id,
            courseId: pharmacologyCourse.id,
            metadata: {
              originalPath: pdfPath,
              fileName: path.basename(pdfPath),
              sourceLevel: 'LEVEL 4.2',
              sourceCourse: 'PPB 423',
              anticancerClassification: 'comprehensive',
              tags: ['antineoplastic', 'anticancer', 'chemotherapy', 'classification', 'taxonomy'],
            },
          },
        });

        console.log('✅ Created material record:', material.id);
      } else {
        console.log('ℹ️ Material already exists:', existingMaterial.id);
      }
    } catch (fileError) {
      console.warn('⚠️  PDF file not found, but course hierarchy created');
      console.warn(`   Path checked: ${pdfPath}`);
    }

    // Display the complete hierarchy
    console.log('\n╔═════════════════════════════════════════════════════════╗');
    console.log('║           📊 ANTICANCER COURSE HIERARCHY                 ║');
    console.log('╚═════════════════════════════════════════════════════════╝\n');
    
    console.log(`🎓 COURSE: Pharmacology (${pharmacologyCourse.id})`);
    console.log(`   📕 UNIT: Chemotherapy of Neoplastic Diseases (${chemoUnit.id})\n`);
    console.log(`   🏷️  ANTICANCER TOPICS:\n`);
    
    for (const [topicName, topicId] of topicMap.entries()) {
      if (!topicName.includes('>')) {
        console.log(`       ├─ ${topicName}`);
        console.log(`       │  ID: ${topicId}\n`);
        
        // Show subtopics
        const subtopics = Array.from(topicMap.entries()).filter(
          ([subName]) => subName.startsWith(topicName + ' >')
        );
        
        if (subtopics.length > 0) {
          subtopics.forEach(([subName, subId], idx) => {
            const cleanSubName = subName.replace(`${topicName} > `, '');
            const isLast = idx === subtopics.length - 1;
            console.log(`       │  ${isLast ? '└─' : '├─'} ${cleanSubName}`);
            console.log(`       │     ID: ${subId}`);
          });
          console.log('');
        }
      }
    }

    console.log('\n╔═════════════════════════════════════════════════════════╗');
    console.log('║              ✅ SETUP COMPLETE!                        ║');
    console.log('╚═════════════════════════════════════════════════════════╝\n');
    
    console.log('📱 The anticancer pharmacy course is now ready for frontend access:');
    console.log('   • Navigate to Courses → Pharmacology');
    console.log('   • View "Chemotherapy of Neoplastic Diseases" unit');
    console.log('   • Access all anticancer agent classifications and materials\n');

    console.log('🔗 COURSE IDs FOR API REFERENCE:');
    console.log(`   Course ID: ${pharmacologyCourse.id}`);
    console.log(`   Unit ID: ${chemoUnit.id}\n`);

  } catch (error) {
    console.error('❌ Error setting up course:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Run the setup
setupAnticancerCourse().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
