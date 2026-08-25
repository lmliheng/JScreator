# 开发约定（Conventions）

本文件是全体子 agent 共享的契约，所有模块必须遵守，避免冲突。

## 1. 角色划分（RBAC）

> ⚠️ role_id 以现有数据库为准（不可改动，避免破坏已有用户数据）。

| role_id | role_name | 权限 |
|---------|-----------|------|
| 1 | admin（超级管理员） | 全部权限：用户/角色/权限管理、管理所有人文章、发布通知 |
| 2 | user（普通用户） | 管理自己的文章、发表评论、修改自己的资料 |
| 3 | editor（编辑） | 管理所有用户的文章（审核/编辑/删除），不管理用户/权限/通知 |

新用户默认 `role_id = 2`（普通用户）。`role` 表已存在这三条记录，**无需重复初始化**。

## 2. 统一响应格式

成功：

```json
{ "code": 200, "success": true, "message": "ok", "data": {} }
```

失败：

```json
{ "code": 401, "success": false, "message": "未登录或登录过期" }
```

- 列表数据统一放在 `data.list`，分页附 `data.total` / `data.page` / `data.pageSize`。
- 单条数据放 `data` 或业务字段（如 `data`）。

## 3. 鉴权中间件（`utils/authMiddleware.js`，Agent 1 实现）

- `verifyToken(req, res, next)`：解析 `Authorization: Bearer <token>`，成功则 `req.user = decoded`（含 `id`）；失败返回 `401`。
- `requireRole(...roleIds)`：在 `verifyToken` 之后调用，校验 `req.user.role_id` 是否在允许列表，无权限返回 `403`。

使用示例：

```js
router.get('/xxx', verifyToken, requireRole(1), async (req, res) => { ... })
```

## 4. 数据库新增表（Agent 1 建表）

### comment（评论，支持匿名 + 楼中楼）

```sql
CREATE TABLE IF NOT EXISTS comment (
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

### notification（通知，可指定用户/角色/全体）

```sql
CREATE TABLE IF NOT EXISTS notification (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  sender_id INT NOT NULL COMMENT '发送者(管理员)user id',
  target_type ENUM('all','user','role') NOT NULL DEFAULT 'all',
  target_id INT NULL COMMENT 'target_type=user时为user_id，=role时为role_id',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### notification_read（已读标记）

```sql
CREATE TABLE IF NOT EXISTS notification_read (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notification_id INT NOT NULL,
  user_id INT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  read_at DATETIME NULL,
  UNIQUE KEY uk_notif_user (notification_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### role（已存在，无需初始化）

`role` 表已存在三条记录：`1=admin`、`2=user`、`3=editor`。**不要重复插入或修改**，避免破坏现有用户数据。

## 5. 路由命名约定（避免冲突）

| 前缀 | 模块 | 负责 agent |
|------|------|-----------|
| `/sys/*` | 认证（login/register/profile） | Agent 1 |
| `/user-manage/*` | 用户管理 | Agent 2 |
| `/role/*`、`/permission/*` | 角色权限 | Agent 2 |
| `/notification/*` | 通知 | Agent 3 |
| `/article/*`、`/comment/*` | 博客与评论 | Agent 4 |

## 6. 数据库连接

连接信息在 `.env`（`DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`），统一通过 `utils/connect_db.js` 的 `pool` 访问。所有 SQL 写在 `utils/db_curd.js`（或按模块新增 db 函数文件）。
