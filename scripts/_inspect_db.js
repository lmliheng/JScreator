require('dotenv').config();
const { pool } = require('../utils/connect_db');

(async () => {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    console.log('=== TABLES ===');
    console.log(JSON.stringify(tables, null, 2));

    for (const t of ['role', 'user']) {
      try {
        const [cols] = await pool.query(`SHOW COLUMNS FROM \`${t}\``);
        console.log(`\n=== COLUMNS of ${t} ===`);
        console.log(JSON.stringify(cols, null, 2));
      } catch (e) {
        console.log(`\n=== ${t}: ${e.message} ===`);
      }
    }

    try {
      const [roles] = await pool.query('SELECT * FROM role');
      console.log('\n=== role rows ===');
      console.log(JSON.stringify(roles, null, 2));
    } catch (e) {
      console.log('\n=== role rows error: ' + e.message + ' ===');
    }

    try {
      const [users] = await pool.query('SELECT id, username, email, role_id FROM user LIMIT 10');
      console.log('\n=== user sample (id, username, email, role_id) ===');
      console.log(JSON.stringify(users, null, 2));
    } catch (e) {
      console.log('\n=== user sample error: ' + e.message + ' ===');
    }
  } catch (err) {
    console.error('CONNECTION ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
