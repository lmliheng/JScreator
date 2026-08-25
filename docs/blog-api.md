# 博客 API 契约（Blog API Contract）

本文是博客后端（Agent 4）与博客前端（Agent 5）共享的接口契约。两端必须严格按此契约实现，最终无需返工即可对接。

所有响应遵循统一格式 `{ code, success, message, data }`，列表数据放 `data = { list, total, page, pageSize }`。

> 状态：**已按契约实现**（Agent 4，2026-08-24）。实现时有少量微调，已在下文逐条标注「实现说明」，其余与契约一致。

## 文章

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/article/list` | 公开 | 文章列表。query: `page`、`pageSize`、`category_id`、`keyword` |
| GET | `/article/detail/:id` | 公开 | 文章详情（含作者、分类、正文） |
| POST | `/article/add` | 登录 | 新增文章。body: `{ title, content, category_ids: [] }` |
| PUT | `/article/update/:id` | 登录 | 更新文章（作者本人或 admin/editor） |
| DELETE | `/article/delete/:id` | 登录 | 删除文章（作者本人或 admin/editor） |
| GET | `/article/mine` | 登录 | 当前登录用户自己的文章列表 |

实现说明：

- `GET /article/list` 只返回 `status = 1`（已发布）的文章；`keyword` 对 `title`/`content` 做模糊匹配，`category_id` 精确过滤。
- `POST /article/add` body 额外可选 `status`（`0` 草稿 / `1` 发布 / `2` 仅自己可见），缺省为 `1`（发布）。
- `PUT /article/update/:id` body 字段均可选（部分更新）：`title`、`content`、`category_ids`（传了则整体替换分类）、`status`。
- `GET /article/detail/:id`：已发布文章公开可见；未发布（草稿/仅自己可见）仅作者本人或 admin/editor 可见，否则返回 404。
- `GET /article/mine` 返回当前用户全部文章（含草稿/仅自己可见），query 支持 `page`、`pageSize`。

## 分类

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/article/category/list` | 公开 | 全部分类 |
| POST | `/article/category/add` | 登录 | 新增分类（作者自己的分类） |
| PUT | `/article/category/update` | 登录 | 更新分类 |
| DELETE | `/article/category/delete` | 登录 | 删除分类 |

实现说明：

- `PUT /article/category/update` body: `{ category_id, category_name }`；`DELETE /article/category/delete` body: `{ category_id }`。
- 分类 update/delete 权限为「作者本人（分类的 `user` 字段匹配）或 admin/editor」，与文章保持一致（比「登录」更严格）。

## 评论（匿名 + 楼中楼）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/comment/list/:articleId` | 公开 | 某文章的评论列表，返回楼中楼树形结构 |
| POST | `/comment/add` | 公开（可匿名） | 发表评论。body: `{ article_id, content, parent_id?, nickname? }` |

评论规则：

- `parent_id` 为 `null`/缺省 = 顶层评论；有值 = 回复某条评论（楼中楼，可多层嵌套）。
- 登录用户评论：`user_id` 取 token 里的 id，`nickname` 用用户名（忽略 body 里的 nickname）。
- 匿名评论：`user_id` 为空，`nickname` 必填（前端让匿名者填昵称）。

实现说明：

- `GET /comment/list/:articleId` 返回 `data = { list: [顶层评论] }`，每条评论含 `children: []` 递归嵌套。
- `POST /comment/add` 会校验：文章存在（否则 404）；若提供 `parent_id`，须存在且属于同一文章（否则 400）。
- 评论对象字段：`{ comment_id, article_id, user_id, nickname, content, parent_id, created_at, children: [] }`。

## 字段约定

文章对象：`{ article_id, title, content, status, user_id, author_name, category_ids, category_names, created_at, updated_at }`

- `user_id` 对应文章表的 `user` 列（创建用户 id）；`author_name` 为该作者的 `username`。
- `category_ids` / `category_names` 为数组（经 `articleandcategory_middle` 多对多聚合）。

评论对象：`{ comment_id, article_id, user_id, nickname, content, parent_id, created_at, children: [] }`

## 鉴权与角色（实现说明）

- 鉴权沿用现有 `utils/token_creator.js` 的 `tokenValidator`：解析 `Authorization: Bearer <token>`，成功得到 `{ id }`。
- 当前 token 里只有 `id`（不含 `role_id`），因此权限判断时**查数据库取用户角色**（`utils/db_article.js` 的 `getUserRoleById`）。
- admin/editor 判定按 `role_name`（`admin`/`超级管理员`、`editor`/`编辑`）而非写死 `role_id`，以兼容当前库实际角色编号（`1=超级管理员`、`2=普通用户`、`3=编辑`）与 conventions.md 中「admin=1/editor=2/user=3」的差异，避免误授权。

## 数据表

由 Agent 1 建表：`article`（已存在）、`article_category`（已存在）、`articleandcategory_middle`（已存在，多对多）、`comment`（新增）。字段见 `docs/conventions.md`。

## 后端实现文件（Agent 4）

- `routes/article_request.js`：`/article/*` 契约路由 + 保留原有遗留路由（`/article/getAll`、`/article/getAllByPage`、`/article/getSomeByPageAndCategory`、`/article/detail`、`/article_category/getAll`、`/article_category/set` 等）。
- `routes/comment_request.js`：`/comment/*` 路由。
- `utils/db_article.js`：新增文章/分类数据层（按实际表结构）。
- `utils/db_comment.js`：新增评论数据层（`comment_add`、`comment_getByArticle` 树形）。
