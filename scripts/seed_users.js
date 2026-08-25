require('dotenv').config();
const { pool } = require('../utils/connect_db');
const { ToHash } = require('../utils/crypto_password');

/**
 * 批量生成测试用户脚本（幂等，可重复执行）
 *
 * - 用户名: testuser_0001 ~ testuser_0500
 * - 邮箱:   testuser_0001@example.com ~ testuser_0500@example.com
 * - 密码:   ToHash('123456')（crypto-js SHA256）
 * - role_id: 2（普通用户）
 * - user.id 为自增主键，插入时不指定 id
 * - 使用多条 VALUES 批量插入，并 INSERT IGNORE 忽略已存在的用户名/邮箱，避免重复报错
 */

const TOTAL = 500;       // 目标生成数量
const BATCH = 100;       // 每批 VALUES 条数

(async () => {
    try {
        const [beforeRows] = await pool.query('SELECT COUNT(*) AS c FROM user');
        const before = beforeRows[0].c;
        console.log('生成前用户总数:', before);

        const hashedPassword = ToHash('123456');

        let inserted = 0;
        for (let start = 1; start <= TOTAL; start += BATCH) {
            const end = Math.min(start + BATCH - 1, TOTAL);
            const values = [];
            const params = [];
            for (let i = start; i <= end; i++) {
                const num = String(i).padStart(4, '0');
                values.push('(?, ?, ?, ?)');
                params.push(`testuser_${num}`, `testuser_${num}@example.com`, hashedPassword, 2);
            }
            const sql = `INSERT IGNORE INTO user (username, email, password, role_id) VALUES ${values.join(', ')}`;
            const [result] = await pool.query(sql, params);
            inserted += result.affectedRows;
        }

        const [afterRows] = await pool.query('SELECT COUNT(*) AS c FROM user');
        const after = afterRows[0].c;
        console.log('本次实际插入:', inserted, '条');
        console.log('生成后用户总数:', after);

        // 校验样例与范围
        const [sample] = await pool.query(
            "SELECT id, username, email, role_id FROM user WHERE username LIKE 'testuser_%' ORDER BY username LIMIT 3"
        );
        const [range] = await pool.query(
            "SELECT MIN(username) AS min_u, MAX(username) AS max_u, COUNT(*) AS c FROM user WHERE username LIKE 'testuser_%'"
        );
        console.log('testuser 样例:', JSON.stringify(sample));
        console.log('testuser 范围/数量:', JSON.stringify(range));
    } catch (e) {
        console.error('生成测试用户失败:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
        process.exit(0);
    }
})();
