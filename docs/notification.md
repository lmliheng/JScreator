# 通知系统设计（Notification）

## 1. 概述

管理员可发布通知，支持指定全体用户、指定单个用户、指定角色（role_id）。用户可查看自己收到的通知、标记已读、查看未读数。

角色划分（见 `docs/conventions.md`）：

| role_id | role_name | 通知权限 |
|---------|-----------|----------|
| 1 | admin | 发布通知（全体/用户/角色）、查看自己的通知 |
| 2 | editor | 只能查看/标记自己的通知 |
| 3 | user | 只能查看/标记自己的通知 |

## 2. 表结构（由 Agent 1 建表，见 conventions.md）

### notification（通知）

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

## 3. 通知可见性规则

某用户 `user_id`（角色 `role_id`）能收到通知 `n`，当且仅当满足以下任一条件：

1. `n.target_type = 'all'`
2. `n.target_type = 'user' AND n.target_id = user_id`
3. `n.target_type = 'role' AND n.target_id = role_id`

未读数 = 能收到且（无已读记录 或 `is_read = 0`）的通知数量。

## 4. 后端接口

统一响应格式：

```json
{ "code": 200, "success": true, "message": "ok", "data": {} }
```

| 方法 | 路径 | 权限 | 请求体 | 说明 |
|------|------|------|--------|------|
| POST | `/notification/add` | admin(role_id=1) | `{ title, content, target_type, target_id? }` | 发布通知 |
| GET  | `/notification/list` | 登录 | - | 当前用户收到的通知列表 |
| GET  | `/notification/unread-count` | 登录 | - | 当前用户未读数 |
| POST | `/notification/read` | 登录 | `{ notification_id }` | 标记某通知已读 |

### 4.1 POST /notification/add

- `target_type`：`'all'`（全体）| `'user'`（指定用户）| `'role'`（指定角色）
- `target_type = 'all'` 时 `target_id` 可省略；`'user'`/`'role'` 时 `target_id` 必填（分别为 user_id / role_id）
- 校验：标题/内容非空、target_type 合法、非管理员返回 403

成功返回：

```json
{ "code": 200, "success": true, "message": "通知发布成功", "data": { "notification_id": 1 } }
```

### 4.2 GET /notification/list

成功返回（`data.list` 为数组，每条含 `is_read` 0/1）：

```json
{
  "code": 200,
  "success": true,
  "message": "获取通知列表成功",
  "data": {
    "list": [
      {
        "notification_id": 1,
        "title": "系统维护通知",
        "content": "今晚 23:00 维护",
        "sender_id": 1,
        "target_type": "all",
        "target_id": null,
        "created_at": "2025-01-01 10:00:00",
        "is_read": 0
      }
    ],
    "total": 1
  }
}
```

### 4.3 GET /notification/unread-count

```json
{ "code": 200, "success": true, "message": "获取未读数成功", "data": { "unread_count": 3 } }
```

### 4.4 POST /notification/read

```json
{ "code": 200, "success": true, "message": "标记已读成功", "data": { "notification_id": 1 } }
```

### 鉴权

- 使用现有手动 `tokenValidator` 模式（见 `routes/role_request.js`）：解析 `Authorization: Bearer <token>`，失败返回 401。
- 管理员校验：查询 `user.role_id`，非 1 返回 403。
- 若 `utils/authMiddleware.js` 落地，可平滑替换为 `verifyToken` + `requireRole(1)`。

## 5. 后端文件

| 文件 | 说明 |
|------|------|
| `utils/db_notification.js` | 通知相关数据库函数（独立文件，不动 `db_curd.js`） |
| `routes/notification_request.js` | 通知路由 |
| `server.js` | 注册 `notification_request` 路由 |

### db_notification.js 导出函数

- `notification_add(title, content, sender_id, target_type, target_id)`
- `notification_getForUser(user_id)`
- `notification_markRead(notification_id, user_id)`
- `notification_getUnreadCount(user_id)`
- `notification_getUserRoleId(user_id)`（管理员校验辅助）

## 6. 前端（Admin）

技术栈：Vue3 + Element Plus + Pinia + vue-router + vue-i18n。

| 文件 | 说明 |
|------|------|
| `Admin/src/composables/useRequest.js` | 新增 `requestNotificationAdd/List/UnreadCount/Read` |
| `Admin/src/components/NotificationBell.vue` | 顶部铃铛 + 未读红点 + 下拉通知列表（30s 轮询） |
| `Admin/src/views/privateViews/NotificationCenter.vue` | 用户通知中心（列表 + 标记已读 + 全部已读） |
| `Admin/src/views/privateViews/NotificationManage.vue` | 管理员通知管理（发布 + 通知列表） |
| `Admin/src/router/index.js` | 新增 `/notification/*` 路由 |
| `Admin/src/views/HomeView.vue` | 头部挂载铃铛组件 |
| `Admin/src/components/AsideCom.vue` | 新增「通知」菜单（管理项仅 admin 可见） |
| `Admin/src/i18n/index.js` | 新增通知相关多语言 key |

### 路由

- `/notification/notification-center`：通知中心（所有登录用户）
- `/notification/notification-manage`：通知管理（仅 admin，菜单按 `role_id === 1` 显示，页面内也有空态兜底）

## 7. 使用说明

1. **发布通知**：admin 登录 → 左侧「通知 → 通知管理」→ 填标题/内容 → 选目标类型（全体/指定用户/指定角色）→ 发布。
2. **查看通知**：任何登录用户点击顶部铃铛查看最近通知，或进入「通知中心」查看完整列表。
3. **标记已读**：铃铛下拉点击单条、或通知中心「标记已读 / 全部已读」。
4. **未读数**：铃铛红点实时显示未读数（30s 轮询）。

## 8. 注意事项 / 边界

- **不建表**：`notification`、`notification_read` 由其他 agent 建，本模块直接按字段读写；若表未建好，通知接口会返回 500（`Table ... doesn't exist`）。
- **不修改** `db_curd.js`、`token_creator.js`、login/register 路由。
- 管理员管理页的「通知列表」复用 `/notification/list`（当前用户视角）；如需“管理员查看全部已发布通知”，可后续新增 admin 专属查询接口。
- 已读标记为幂等操作（`ON DUPLICATE KEY UPDATE`），重复标记不会报错。
