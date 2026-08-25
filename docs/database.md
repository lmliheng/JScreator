# 数据库文档（Database）

数据库：MySQL（连接信息在 `.env` 的 `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`），统一通过 `utils/connect_db.js` 的连接池 `pool` 访问。

## 全部表清单

| 表 | 说明 |
|----|------|
| user | 用户 |
| role | 角色 |
| permission | 权限 |
| roleandpermission_middle | 角色-权限中间表 |
| article | 文章（博客） |
| article_category | 文章分类 |
| articleandcategory_middle | 文章-分类中间表 |
| comment | 评论（新增） |
| notification | 通知（新增） |
| notification_read | 通知已读标记（新增） |

## 角色表 role（已有，勿改语义）

| role_id | role_name | 权限 |
|---------|-----------|------|
| 1 | admin（超级管理员） | 全部权限 |
| 2 | user（普通用户） | 管理自己的文章、评论、改自己资料 |
| 3 | editor（编辑） | 管理所有用户文章 |

> 新用户默认 `role_id = 2`（普通用户）。

## 新增表结构

### comment（评论，支持匿名 + 楼中楼）

```sql
CREATE TABLE comment (
  comment_id INT AUTO_INCREMENT PRIMARY KEY,
  article_id INT NOT NULL,
  user_id INT NULL COMMENT '登录用户id，匿名评论为NULL',
  nickname VARCHAR(50) NULL COMMENT '匿名评论昵称',
  content TEXT NOT NULL,
  parent_id INT NULL COMMENT '父评论id，NULL为顶层评论',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_article (article_id),
  INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### notification（通知，可指定全体/用户/角色）

```sql
CREATE TABLE notification (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  sender_id INT NOT NULL COMMENT '发送者(管理员)user id',
  target_type ENUM('all','user','role') NOT NULL DEFAULT 'all',
  target_id INT NULL COMMENT 'target_type=user时为user_id，=role时为role_id',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### notification_read（通知已读标记）

```sql
CREATE TABLE notification_read (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notification_id INT NOT NULL,
  user_id INT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  read_at DATETIME NULL,
  UNIQUE KEY uk_notif_user (notification_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 建表脚本

执行 `node scripts/init_db.js` 可创建上面三张新增表（幂等，使用 `CREATE TABLE IF NOT EXISTS`）。
