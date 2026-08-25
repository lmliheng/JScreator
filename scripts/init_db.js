require('dotenv').config();
const { pool } = require('../utils/connect_db');

const createTables = async () => {
  const sqls = [
    `CREATE TABLE IF NOT EXISTS comment (
      comment_id INT AUTO_INCREMENT PRIMARY KEY,
      article_id INT NOT NULL,
      user_id INT NULL COMMENT '登录用户id，匿名评论为NULL',
      nickname VARCHAR(50) NULL COMMENT '匿名评论昵称',
      content TEXT NOT NULL,
      parent_id INT NULL COMMENT '父评论id，NULL为顶层评论',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_article (article_id),
      INDEX idx_parent (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS notification (
      notification_id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      sender_id INT NOT NULL COMMENT '发送者(管理员)user id',
      target_type ENUM('all','user','role') NOT NULL DEFAULT 'all',
      target_id INT NULL COMMENT 'target_type=user时为user_id，=role时为role_id',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS notification_read (
      id INT AUTO_INCREMENT PRIMARY KEY,
      notification_id INT NOT NULL,
      user_id INT NOT NULL,
      is_read TINYINT(1) DEFAULT 0,
      read_at DATETIME NULL,
      UNIQUE KEY uk_notif_user (notification_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  ];

  for (const sql of sqls) {
    await pool.query(sql);
    const name = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
    console.log('✅ 建表成功:', name);
  }
};

(async () => {
  try {
    await createTables();
    const [tables] = await pool.query('SHOW TABLES');
    console.log('\n当前所有表:', tables.map(r => Object.values(r)[0]).join(', '));
  } catch (e) {
    console.error('建表失败:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
