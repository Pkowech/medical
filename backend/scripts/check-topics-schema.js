const { Client } = require('pg');
require('dotenv').config();

const c = new Client({ connectionString: process.env.DATABASE_URL });

c.connect().then(() => {
  c.query(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name='topics'
    ORDER BY ordinal_position
  `).then(r => {
    console.log('Topics table schema:');
    r.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(20)} ${row.data_type.padEnd(20)} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
    });
    c.end();
  });
});
