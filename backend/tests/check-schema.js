const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(() => {
  client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='topics'`).then(res => {
    console.log('Topics columns:', res.rows.map(r => r.column_name));
    client.end();
  });
});
