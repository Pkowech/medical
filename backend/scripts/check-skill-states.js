const { Client } = require('pg');
require('dotenv').config();

const c = new Client({ connectionString: process.env.DATABASE_URL });

c.connect().then(() => {
  c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='user_skill_states'`).then(r => {
    console.log('user_skill_states columns:', r.rows.map(x => x.column_name));
    c.end();
  });
});
