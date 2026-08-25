require('dotenv').config();
const { pool } = require('../utils/connect_db');
const fs = require('fs');

// 用法：node scripts/import_articles.js <json文件>
// JSON 文件格式：[{ "title": "...", "content": "..." }]
const file = process.argv[2];
if (!file) {
  console.error('缺少 JSON 文件路径参数');
  process.exit(1);
}
const articles = JSON.parse(fs.readFileSync(file, 'utf8'));
const USER_ID = 1778237622056; // lmliheng

(async () => {
  let inserted = 0, skipped = 0;
  for (const a of articles) {
    const content = (a.content || '').trim();
    if (!content) { skipped++; continue; }
    const [exist] = await pool.query('SELECT COUNT(*) AS c FROM article WHERE user = ? AND title = ?', [USER_ID, a.title]);
    if (exist[0].c > 0) { skipped++; continue; }
    await pool.query('INSERT INTO article (title, content, user, status) VALUES (?, ?, ?, 1)', [a.title, a.content, USER_ID]);
    inserted++;
  }
  console.log('已导入:', inserted, '跳过(空/重复):', skipped);
  await pool.end();
  process.exit(0);
})();
