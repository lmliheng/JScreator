require('dotenv').config();
const { pool } = require('../utils/connect_db');

/**
 * 索引迁移脚本（幂等）
 *
 * 1. 先 SHOW INDEX 判断是否已存在同名索引，或该列是否已被其他索引覆盖，
 *    已存在则跳过，避免重复建索引。
 * 2. 未覆盖则 ALTER TABLE ... ADD INDEX。
 * 3. 最后 SHOW INDEX FROM 各表验证结果。
 *
 * 目标索引：
 *   user           username / email（唯一索引，建表时已存在） / role_id（已存在 idx_role）
 *   article        user（已存在 idx_user）/ status / created_at
 *   comment        article_id / parent_id（建表时已存在 idx_article / idx_parent）
 *   notification   target_type / target_id / created_at
 */

// table / indexName / column
const desiredIndexes = [
    { table: 'user', name: 'username', column: 'username' },
    { table: 'user', name: 'email', column: 'email' },
    { table: 'user', name: 'idx_role', column: 'role_id' },
    { table: 'article', name: 'idx_user', column: 'user' },
    { table: 'article', name: 'idx_status', column: 'status' },
    { table: 'article', name: 'idx_created_at', column: 'created_at' },
    { table: 'comment', name: 'idx_article', column: 'article_id' },
    { table: 'comment', name: 'idx_parent', column: 'parent_id' },
    { table: 'notification', name: 'idx_target_type', column: 'target_type' },
    { table: 'notification', name: 'idx_target_id', column: 'target_id' },
    { table: 'notification', name: 'idx_created_at', column: 'created_at' },
];

// 判断某列是否已被该表某个索引（单列索引）覆盖
const isColumnIndexed = (indexRows, column) => {
    // 按索引名分组
    const byName = {};
    for (const r of indexRows) {
        (byName[r.Key_name] = byName[r.Key_name] || []).push(r.Column_name);
    }
    for (const name of Object.keys(byName)) {
        const cols = byName[name];
        // 单列索引且列名匹配（PRIMARY 主键同样算覆盖）
        if (cols.length === 1 && cols[0] === column) {
            return true;
        }
    }
    return false;
};

const hasIndexName = (indexRows, name) => indexRows.some((r) => r.Key_name === name);

(async () => {
    const added = [];
    const skipped = [];
    try {
        for (const { table, name, column } of desiredIndexes) {
            const [rows] = await pool.query(`SHOW INDEX FROM \`${table}\``);
            if (hasIndexName(rows, name) || isColumnIndexed(rows, column)) {
                skipped.push(`${table}.${name}(${column})`);
                continue;
            }
            await pool.query(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (\`${column}\`)`);
            added.push(`${table}.${name}(${column})`);
            console.log(`✅ 新增索引: ${table}.${name}(${column})`);
        }

        console.log('\n=== 汇总 ===');
        console.log('新增索引:', added.length ? added.join(', ') : '(无)');
        console.log('已存在/跳过:', skipped.length ? skipped.join(', ') : '(无)');

        console.log('\n=== 验证 SHOW INDEX ===');
        for (const table of ['user', 'article', 'comment', 'notification']) {
            const [rows] = await pool.query(`SHOW INDEX FROM \`${table}\``);
            const byName = {};
            for (const r of rows) {
                (byName[r.Key_name] = byName[r.Key_name] || []).push(r.Column_name);
            }
            console.log(`\n[${table}]`);
            for (const name of Object.keys(byName)) {
                const unique = rows.find((r) => r.Key_name === name).Non_unique === 0;
                console.log(`  ${name} [${unique ? 'UNIQUE' : 'NON-UNIQUE'}] (${byName[name].join(', ')})`);
            }
        }
    } catch (e) {
        console.error('迁移索引失败:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
        process.exit(0);
    }
})();
