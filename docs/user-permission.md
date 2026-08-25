# 用户管理 + 角色权限（RBAC）设计说明

> 本模块由 Agent 2 负责：Admin 后台用户管理 CRUD + 角色/权限三级划分。
> 后端统一响应格式 `{ code, success, message, data }`，列表数据放 `data.list`，单条放 `data`。

## 1. 角色三级划分（RBAC）

按 `docs/conventions.md` 约定，`role` 表三级角色：

| role_id | role_name | 权限范围 |
|---------|-----------|----------|
| 1 | admin | 全部：用户/角色/权限管理、管理所有文章、发布通知 |
| 2 | editor | 管理所有用户文章（审核/编辑/删除），不管理用户/权限/通知 |
| 3 | user | 管理自己的文章、评论、修改自己的资料 |

### ⚠️ 重要：当前数据库实际数据与约定不一致（集成需注意）

`role` 表当前真实数据为：

| role_id | 实际 role_name |
|---------|----------------|
| 1 | 超级管理员 |
| 2 | 普通用户 |
| 3 | 编辑 |

即：**role_id=2 是「普通用户」、role_id=3 是「编辑」**，与 conventions.md 的「2=editor、3=user」相反。
本模块的权限校验只依赖「role_id === 1 即管理员」，因此对 admin/editor/user 的「谁能做管理操作」判断不受影响（仅 admin 可做用户/角色/权限管理）。
前端角色下拉与列表均为数据驱动（读 `role_getAll`），因此显示的是数据库中的真实角色名。
若需严格对齐 conventions.md 的 2/3 定义，应由 Agent 1 在「role 初始化」时统一修正（本模块边界：不建表、不改 role 初始化数据）。

---

## 2. 后端接口列表

### 2.1 用户管理（前缀 `/user-manage/*`，仅管理员可写；查询需登录）

| 方法 | 路径 | 权限 | 说明 | 请求体 / 参数 |
|------|------|------|------|---------------|
| GET | `/user-manage/list` | 仅 admin | 用户列表 | 无（返回 `data.list` / `data.total` / `data.page` / `data.pageSize` / `data.size`） |
| GET | `/user-manage/detail/:id` | 登录即可 | 单个用户详情（不含密码） | 路径参数 `id` |
| POST | `/user-manage/add` | 仅 admin | 新增用户 | `{ username, email, password, role_id? }` |
| PUT | `/user-manage/update` | 仅 admin | 更新用户（用户名/邮箱/角色） | `{ id, username, email, role_id? }` |
| DELETE | `/user-manage/delete` | 仅 admin | 删除用户 | `{ id }` |

### 2.2 角色管理（前缀 `/role/*`，写操作仅 admin）

| 方法 | 路径 | 权限 | 说明 | 请求体 / 参数 |
|------|------|------|------|---------------|
| GET | `/role/list` | 登录即可 | 角色列表 | 返回 `data.list` |
| GET | `/role/getAll` | 登录即可 | 旧路由兼容别名 | 同 `/role/list` |
| POST | `/role/add` | 仅 admin | 新增角色 | `{ role_name }` |
| PUT | `/role/update` | 仅 admin | 重命名角色 | `{ role_id, role_name }` |
| PUT | `/role/updateName` | 仅 admin | 旧路由兼容别名 | 同 `/role/update` |
| DELETE | `/role/delete` | 仅 admin | 删除角色 | `{ role_id }` |
| POST | `/role/setPermission` | 仅 admin | 给角色分配权限（整体替换，先清空再写入） | `{ role_id, permission_id_list: number[] }` |
| GET | `/role/permission/:id` | 仅 admin | 查询角色已有权限 id 列表 | 路径参数 `id`（role_id），返回 `data.permission_ids` |
| POST | `/role/addPermission` | 仅 admin | 旧路由兼容（逗号分隔字符串或数组），内部改为整体替换 | `{ role_id, permission_id_list }` |

### 2.3 权限管理（前缀 `/permission/*`）

| 方法 | 路径 | 权限 | 说明 | 请求体 / 参数 |
|------|------|------|------|---------------|
| GET | `/permission/list` | 登录即可 | 权限列表 | 返回 `data.list` |
| GET | `/permission/getAll` | 登录即可 | 旧路由兼容别名 | 同 `/permission/list` |
| PUT | `/permission/update` | 仅 admin | 更新权限名称/描述 | `{ permission_id, permission_name, permission_description }` |
| POST | `/permission/update` | 仅 admin | 旧路由兼容（原用 POST，字段 `permission_desc` 亦可） | 同上（兼容 `permission_desc`） |

### 2.4 保留的既有路由（本人资料）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/sys/profile` | 登录 | 获取本人信息（含权限列表） |
| PUT | `/userInfo` | 登录 | 更新本人用户名/邮箱 |
| POST | `/resetPassword` | 登录 | 重置本人密码 |

---

## 3. 权限规则

- 鉴权方式：手动校验（`utils/authMiddleware.js` 尚未就绪，本模块未新建该文件）。
  - 解析 `Authorization: Bearer <token>`，用 `utils/token_creator.js` 的 `tokenValidator` 解析。
  - `requireLogin`：token 无效/缺失 → `401 { code: 401, success: false, message: '未登录或登录过期' }`。
  - `requireAdmin`：登录后查询 `role_getById(user_id)`，`role_id !== 1` → `403 { code: 403, success: false, message: '权限不足，仅管理员可操作' }`。
- 管理类写操作（用户增删改、角色增删改/分配权限、权限修改）仅 admin（role_id=1）可调用。
- 读操作（用户列表/详情、角色列表、权限列表）要求登录；`/user-manage/list` 为管理页数据，亦要求 admin。
- 新增/更新用户时后端会校验用户名/邮箱唯一性（`register_checkExistByUsername/Email`）。

---

## 4. 数据库函数变更（`utils/db_curd.js`）

新增导出：

- `user_add(username, email, password, role_id)`：新增用户；`id` 走表自增（`result.insertId` 返回新 id），`password` 由路由层 `ToHash` 加密后传入，`role_id` 可选（不传走表默认）。
- `user_delete(id)`：按 id 删除用户。
- `user_getById(id)`：按 id 查单个用户（LEFT JOIN role 取 `role_name`，不含密码）。
- `permission_update(permission_id, permission_name, permission_description)`：更新权限名称/描述（修复了 `permission_request.js` 已 require 但缺失导致的崩溃）。
- `role_setPermission(role_id, permission_id_list)`：事务内先 `DELETE` 再批量 `INSERT`（整体替换，避免重复）。
- `role_getPermissionByRoleId(role_id)`：查询角色已有权限 id 列表。

修改：

- `user_update(id, username, email, role_id)`：`role_id` 为可选参数，不传时保持原三参行为（`/userInfo` 本人更新仍兼容）。

---

## 5. 前端页面说明

技术栈：Vue3 + Element Plus + Pinia + Vue Router（hash）+ vue-i18n。

- `composables/useRequest.js`：新增
  - 用户：`requestUserAdd` / `requestUserUpdate` / `requestUserDelete` / `requestSelfUpdate`（PUT `/userInfo`）/ `requestSelfResetPassword`（POST `/resetPassword`）
  - 角色：`requestRoleAdd` / `requestRoleUpdate` / `requestRoleDelete` / `requestRoleSetPermission` / `requestRolePermission`
  - 权限：`requestPermissionUpdate`
  - （保留既有 `requestUser` / `requestUserDetail` / `requestRoleList` / `requestPermissionList`，并保留其它 agent 追加的通知接口）

- `views/privateViews/UserManage.vue`：用户表格（id/头像/用户名/邮箱/角色/创建时间）+ 新增弹窗（用户名/邮箱/密码/角色下拉）+ 编辑弹窗（用户名/邮箱/角色）+ 删除确认 + 详情跳转 `/user/user-info/:id`。
- `views/privateViews/RoleManage.vue`：角色表格 + 新增/重命名/删除 + 「分配权限」打开 `RolePermissionDialog`。
- `views/privateViews/PermissionManage.vue`：权限表格 + 编辑弹窗（权限名称/描述）。
- `components/RolePermissionDialog.vue`：权限多选（`el-checkbox-group`），加载全部权限并预选该角色已有权限，保存时调用 `/role/setPermission` 整体替换。
- `views/privateViews/UserProfile.vue`：本人资料展示（id/角色/用户名/邮箱/权限列表）+ 编辑资料弹窗 + 重置密码弹窗。
- `views/publicViews/UserInfo.vue`：用户详情页（按新接口字段渲染，含返回按钮）。

> 页面沿用 Element Plus 风格，未改变整体设计基调；新增标签使用中文文案（默认 locale 为 `cn`）。

---

## 6. 验证结果（2026-08-24）

- 后端：`node` 启动无报错（既有 nodemon 已自动热重启，进程 `node server.js --dev`）。
- curl 实测（admin / 123456 登录拿 token）：
  - `GET /user-manage/list` → 200，返回 5 个用户 `data.list`。
  - `GET /user-manage/detail/3` → 200。
  - `POST /user-manage/add` → 200（新用户 id 自增）；`PUT /user-manage/update` → 200（邮箱/角色变更生效）；`DELETE /user-manage/delete` → 200。
  - `POST /role/add` → 200（临时角色 id=5）；`POST /role/setPermission` → 200；`GET /role/permission/5` → 返回 `[1,2,5]`；`DELETE /role/delete` → 200。
  - `PUT /permission/update` → 200（并已还原测试值）。
  - 非 admin（editor，role_id=3）调用 `GET /user-manage/list` → **HTTP 403**，`{ code:403, success:false, message:'权限不足，仅管理员可操作' }`。
- 前端：`npx webpack` 编译成功（`webpack 5.106.2 compiled successfully`），仅有历史警告（`.env.development` 缺失、`defineProps/defineEmits` 宏提示），非本模块引入。

---

## 7. 集成阶段注意事项

1. **role_id 语义冲突**：数据库 `role` 表当前是 `1=超级管理员 / 2=普通用户 / 3=编辑`，与 conventions.md 的 `1=admin / 2=editor / 3=user` 相反。本模块仅以 `role_id===1` 判定管理员，功能不受影响；若需严格对齐，请在 Agent 1 的 role 初始化中统一（本模块未改 role 数据）。
2. `utils/authMiddleware.js` 就绪后，可将各路由文件内重复的 `requireLogin/requireAdmin` 手动校验替换为 `verifyToken` + `requireRole(1)`，路由路径与响应格式无需改动。
3. `user_add` 使用表自增 id，与 `register_register` 使用 `generateId()`（时间戳）混用；当前自增计数已推进到 1778237621053 附近，新增用户 id 会是大整数，但不冲突、不影响功能。
4. `/user-manage/list` 暂未做真分页（一次返回全部，`total=length`）；若用户量大，可后续在 `user_getAll` 增加 LIMIT/OFFSET。
5. 前端 dev server 端口 8085、后端 7000（`useAxiosConfig.js` 硬编码 `http://127.0.0.1:7000`），联调时需保证后端已在运行。
