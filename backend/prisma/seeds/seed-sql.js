/**
 * Direct SQL Seed Script for BKT Analytics Test Data
 * Uses raw SQL to populate the database with test users, skills, and BKT states
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedData() {
  const client = await pool.connect();

  try {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  Direct SQL Seed: BKT Analytics Test Data      ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    // Step 1: Get existing users
    console.log('📋 Step 1: Fetching existing users...');
    const usersResult = await client.query(
      `SELECT id, email, first_name FROM "users" LIMIT 5`,
    );

    if (usersResult.rows.length === 0) {
      console.log('  ⚠️  No users found in database');
      console.log('  Please create users via /v1/auth/register first');
      return;
    }

    const users = usersResult.rows;
    console.log(`  ✅ Found ${users.length} users:`);
    users.forEach((u, i) => {
      console.log(`     ${i + 1}. ${u.first_name || u.email} (ID: ${u.id.substring(0, 8)}...)`);
    });

    // Step 2: Create topics/skills if they don't exist
    console.log('\n📋 Step 2: Creating skills (topics)...');
    
    // Get first unit for FK constraint
    const unitRes = await client.query(`SELECT id FROM units LIMIT 1`);
    if (unitRes.rows.length === 0) {
      console.log('  ⚠️  No units found - create a unit first');
      return;
    }
    const unitId = unitRes.rows[0].id;
    
    const skills = [
      { name: 'Mathematics' },
      { name: 'Science' },
      { name: 'Medicine' },
      { name: 'Pharmacology' },
      { name: 'Anatomy' },
    ];

    const skillIds = [];
    for (let idx = 0; idx < skills.length; idx++) {
      const skill = skills[idx];
      const result = await client.query(
        `INSERT INTO topics (id, name, description, "order", unit_id, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
         RETURNING id`,
        [skill.name, skill.name, idx + 1, unitId],
      );
      skillIds.push(result.rows[0].id);
      console.log(`  ✅ Skill: ${skill.name}`);
    }

    // Step 3: Seed user_skill_states with BKT data
    console.log('\n📋 Step 3: Seeding user_skill_states with BKT data...');
    let statesCreated = 0;

    for (const user of users) {
      for (let i = 0; i < skillIds.length; i++) {
        const pKnown = Math.random() * 0.8 + 0.1; // 0.1 to 0.9
        const attempts = Math.floor(Math.random() * 20) + 1; // 1 to 20

        try {
          await client.query(
            `INSERT INTO user_skill_states (user_id, skill_id, p_known, attempts, last_updated)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (user_id, skill_id) DO UPDATE 
             SET p_known = $3, attempts = $4, last_updated = NOW()`,
            [user.id, skillIds[i], pKnown, attempts],
          );
          statesCreated++;
          console.log(
            `  ✅ ${user.first_name || user.email} → ${skills[i].name} (p_known: ${pKnown.toFixed(3)})`,
          );
        } catch (err) {
          console.log(`  ⚠️  Skill state exists for ${user.first_name || user.email}`);
        }
      }
    }

    // Step 4: Summary
    console.log('\n📊 Seed Data Summary:');
    console.log(`  • Users seeded: ${users.length}`);
    console.log(`  • Skills created/verified: ${skillIds.length}`);
    console.log(`  • User-skill states created/updated: ${statesCreated}`);

    console.log('\n✅ Seed data successfully populated!\n');
    console.log('Next steps:');
    console.log('  1. View data in Prisma Studio (already open at :51212)');
    console.log('  2. Run: node test-with-real-data.js');
    console.log('  3. Check metrics: curl http://localhost:8000/metrics\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

seedData();
