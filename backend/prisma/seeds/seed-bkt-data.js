/**
 * Seed Script: Populate Database with BKT Analytics Test Data
 * 
 * This script:
 * 1. Finds existing users in the database
 * 2. Creates skills/topics if needed
 * 3. Seeds user_skill_states with BKT data
 * 4. Creates analytics events for testing
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  BKT Analytics Seed Data Script                ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Get existing users
    console.log('📋 Step 1: Fetching existing users from database...');
    const users = await prisma.user.findMany({
      take: 5, // Limit to first 5 users
      select: {
        id: true,
        email: true,
        firstName: true,
      },
    });

    if (users.length === 0) {
      console.log('  ⚠️  No users found in database');
      console.log('  Create some users first via /v1/auth/register');
      process.exit(0);
    }

    console.log(`  ✅ Found ${users.length} users:`);
    users.forEach((u, i) => {
      console.log(`     ${i + 1}. ${u.firstName || u.email} (${u.id})`);
    });

    // Step 2: Get or create skills/topics
    console.log('\n📋 Step 2: Getting or creating skills (topics)...');
    const skillTopics = [
      { name: 'Mathematics', slug: 'mathematics' },
      { name: 'Science', slug: 'science' },
      { name: 'Medicine', slug: 'medicine' },
      { name: 'Pharmacology', slug: 'pharmacology' },
      { name: 'Anatomy', slug: 'anatomy' },
    ];

    const skills = [];
    for (const skillData of skillTopics) {
      let topic = await prisma.topic.findUnique({
        where: { slug: skillData.slug },
      });

      if (!topic) {
        topic = await prisma.topic.create({
          data: {
            name: skillData.name,
            slug: skillData.slug,
            description: `${skillData.name} skill for BKT tracking`,
          },
        });
        console.log(`  ✅ Created topic: ${skillData.name}`);
      } else {
        console.log(`  ℹ️  Topic exists: ${skillData.name}`);
      }
      skills.push(topic);
    }

    // Step 3: Seed user_skill_states with BKT data
    console.log('\n📋 Step 3: Seeding user_skill_states with BKT data...');
    let statesCreated = 0;

    for (const user of users) {
      for (const skill of skills) {
        // Check if state already exists
        const existing = await prisma.userSkillState.findUnique({
          where: {
            userId_skillId: {
              userId: user.id,
              skillId: skill.id,
            },
          },
        });

        if (!existing) {
          // Create new skill state with random BKT p_known value
          const pKnown = Math.random() * 0.8 + 0.1; // 0.1 to 0.9
          const attempts = Math.floor(Math.random() * 20) + 1; // 1 to 20 attempts

          await prisma.userSkillState.create({
            data: {
              userId: user.id,
              skillId: skill.id,
              pKnown,
              attempts,
            },
          });
          statesCreated++;
          console.log(
            `  ✅ Created skill state: ${user.firstName || user.email} → ${skill.name} (p_known: ${pKnown.toFixed(3)})`,
          );
        }
      }
    }

    console.log(`\n  Total states created: ${statesCreated}`);

    // Step 4: Display summary
    console.log('\n📊 Seed Data Summary:');
    console.log(`  • Users seeded: ${users.length}`);
    console.log(`  • Skills created/verified: ${skills.length}`);
    console.log(`  • User-skill states created: ${statesCreated}`);

    console.log('\n✅ Seed data successfully populated!\n');
    console.log('Next steps:');
    console.log('  1. Start backend: cd backend && pnpm start');
    console.log('  2. Run analytics test: node test-batch-with-auth.js');
    console.log('  3. Check metrics: curl http://localhost:8000/metrics\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
