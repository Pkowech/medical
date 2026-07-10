const { Client } = require('pg');
require('dotenv').config();

const c = new Client({ connectionString: process.env.DATABASE_URL });

c.connect().then(async () => {
  const r = await c.query(`SELECT id, name FROM units LIMIT 1`);
  if (r.rows.length > 0) {
    console.log('Sample unit:', r.rows[0]);
  } else {
    console.log('No units found');
  }
  c.end();
});
