require('dotenv').config();
const { pool } = require('../utils/connect_db');
const { ToHash } = require('../utils/crypto_password');

(async () => {
  try {
    const [users] = await pool.query('SELECT id, username, email, password, role_id FROM user ORDER BY id LIMIT 10');
    console.log('=== users (id, username, email, role_id, password) ===');
    for (const u of users) {
      console.log(`${u.id}\t${u.username}\t${u.email}\trole_id=${u.role_id}\thash=${u.password}`);
      // 试常见密码
      for (const p of ['123456', 'admin', 'admin123', '123456789', 'password', '111111']) {
        if (u.password === ToHash(p)) console.log(`    ^^^ ${u.username} 密码疑似 = "${p}"`);
      }
    }
    const [rp] = await pool.query('SELECT * FROM roleandpermission_middle ORDER BY role_id, permission_id');
    console.log('\n=== roleandpermission_middle ===');
    console.log(JSON.stringify(rp));
    const [perm] = await pool.query('SELECT * FROM permission ORDER BY permission_id');
    console.log('\n=== permission ===');
    console.log(JSON.stringify(perm));
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
