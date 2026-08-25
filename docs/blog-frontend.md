# 博客前端（Blog Frontend）说明

博客前端位于 `Blog/` 目录，是一个**独立的 Vue 3 单页应用**，与后端通过 HTTP 接口交互。设计严格遵循 `docs/design.md`（indigo-600 强调色、zinc-50 背景、白底卡片 + zinc-200 细边框 + shadow-sm + rounded-lg、正文 max-w-3xl、列表 max-w-5xl、sticky 顶栏 + 移动端汉堡菜单）。

---

## 1. 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Vue 3（`<script setup>` 组合式 API） |
| 构建 | Vite 6 |
| 样式 | **Tailwind CSS 4**（`@tailwindcss/vite` 插件 + CSS 里 `@import "tailwindcss"`，无 `tailwind.config.js`） |
| 路由 | Vue Router 4 |
| 状态 | Pinia |
| HTTP | axios（统一封装 + 拦截器） |
| Markdown | markdown-it + highlight.js（代码高亮，主题 github-dark） |
| Mock | axios-mock-adapter（后端未就绪时跑通页面） |

## 2. 目录结构

```
Blog/
├── index.html
├── vite.config.js          # vue + tailwindcss 插件、@ 别名、端口 5173
├── .env                    # VITE_API_BASE / VITE_USE_MOCK
├── package.json
└── src/
    ├── main.js             # 入口：装配 Pinia/Router，按需启用 mock
    ├── style.css           # Tailwind 入口 + Markdown 正文排版（.prose）
    ├── App.vue             # 布局壳：顶栏 + <RouterView> + 页脚 + Toast
    ├── router/index.js     # 路由 + 登录守卫
    ├── stores/             # Pinia
    │   ├── index.js
    │   ├── auth.js         # token/user 会话（localStorage）
    │   └── toast.js        # 全局提示
    ├── api/                # 按 blog-api.md 契约封装
    │   ├── http.js         # axios 实例 + 请求/响应拦截器
    │   ├── auth.js         # /sys/login /sys/register
    │   ├── article.js      # /article/*
    │   ├── category.js     # /article/category/*
    │   ├── comment.js      # /comment/*
    │   └── mock/           # axios-mock-adapter（内存数据）
    │       ├── db.js       # 种子数据 + localStorage 持久化
    │       └── index.js    # 拦截规则
    ├── components/
    │   ├── AppNavbar.vue
    │   ├── ArticleCard.vue
    │   ├── Pagination.vue
    │   ├── CommentSection.vue
    │   ├── CommentItem.vue # 递归渲染楼中楼
    │   └── ToastContainer.vue
    ├── utils/
    │   ├── format.js       # 日期格式化 / markdown 摘要
    │   └── markdown.js     # markdown-it 渲染器
    └── views/
        ├── HomeView.vue           # 文章列表（分页/筛选/搜索）
        ├── ArticleDetailView.vue  # 文章详情 + 评论
        ├── LoginView.vue
        ├── RegisterView.vue
        ├── ManageView.vue         # 我的文章（增删改查）
        ├── ArticleEditorView.vue  # 写/编辑（textarea + 预览）
        ├── CategoryManageView.vue # 分类管理
        └── NotFoundView.vue
```

## 3. 页面清单与路由

| 路由 | 页面 | 说明 | 权限 |
|------|------|------|------|
| `/` | 首页 / 文章列表 | 卡片列表、分页、分类筛选、关键词搜索 | 公开 |
| `/article/:id` | 文章详情 | Markdown 渲染、作者、分类标签、评论区 | 公开 |
| `/login` | 登录 | 用户名/邮箱 + 密码 | 访客 |
| `/register` | 注册 | 用户名/邮箱/密码 | 访客 |
| `/manage` | 我的文章 | 列表 + 编辑/删除 + 写文章入口 | 登录 |
| `/manage/new` | 写文章 | Markdown 编辑器（编辑/预览） | 登录 |
| `/manage/edit/:id` | 编辑文章 | 同上 | 登录（本人或 admin/editor） |
| `/categories` | 分类管理 | 新增/重命名/删除自己的分类 | 登录 |
| `*` | 404 | | 公开 |

路由守卫（`router/index.js`）：`meta.requiresAuth` 未登录跳 `/login?redirect=...`；`meta.guestOnly` 已登录跳首页。

## 4. 状态管理（Pinia）

- **`auth`**：`token`（格式 `Bearer <token>`）+ `user`，持久化到 `localStorage`（key：`blog_token` / `blog_user`）。getter 提供 `isLoggedIn` / `isAdmin`（role_id=1）/ `isEditor`（role_id=2）/ `canManageAll`（1 或 2）。
- **`toast`**：全局轻提示（success / error / info），App.vue 里渲染。

## 5. API 层与响应解包

`src/api/http.js` 中统一封装 axios：

- **baseURL**：`import.meta.env.VITE_API_BASE`，默认 `http://127.0.0.1:7000`（与后端一致）。
- **请求拦截器**：从 `localStorage` 读取 token，设置 `Authorization: Bearer <token>`。
- **响应拦截器**：后端返回 `{ code, success, message, data }`。`success === false` 或 `code >= 400` 时抛出 `ApiError(message, code)`；否则返回整个 body，各 API 函数再取 `.data`。
- **401 处理**：除 `/sys/login`、`/sys/register` 外的 401 会清除本地会话并跳转 `/login?expired=1`。

各 API 模块严格按 `docs/blog-api.md` 契约实现：

| 模块 | 端点 |
|------|------|
| 文章 | `GET /article/list`、`GET /article/detail/:id`、`POST /article/add`、`PUT /article/update/:id`、`DELETE /article/delete/:id`、`GET /article/mine` |
| 分类 | `GET /article/category/list`、`POST /article/category/add`、`PUT /article/category/update`、`DELETE /article/category/delete` |
| 评论 | `GET /comment/list/:articleId`、`POST /comment/add` |
| 认证 | `POST /sys/login`、`POST /sys/register` |

**登录/注册的响应兼容**：现有后端 `/sys/login`、`/register` 把 `token` 和 `user_info` 放在顶层（不在 `data` 内），前端 `api/auth.js` 已按此读取 `res.token` / `res.user_info`。

## 6. 评论（匿名 + 楼中楼）

- 登录用户评论：不填昵称，后端取 token 里的用户名（mock 同样处理）。
- 匿名评论：显示「昵称（匿名评论必填）」输入框。
- 楼中楼：`CommentItem.vue` 递归渲染 `children` 树；每个评论有「回复」按钮，展开内联回复框，回复的 `parent_id` 指向被回复评论。

## 7. 如何启动

```bash
cd Blog
npm install
npm run dev
```

默认启动在 `http://127.0.0.1:5173/`。生产构建：`npm run build`，预览：`npm run preview`。

## 8. Mock 说明

- 后端由另一个 agent 并行实现，可能尚未就绪。前端默认 `VITE_USE_MOCK=true`，用 `axios-mock-adapter` 在 axios 层拦截请求，数据结构与 `blog-api.md` 契约一致，页面可完整跑通（含登录、增删改查、评论、分页筛选）。
- Mock 数据在内存 + `localStorage`（key `blog_mock_db`），刷新后保留增删改结果；如需重置可在控制台执行 `__resetBlogMock()`。
- **联调时只需把 `.env` 中 `VITE_USE_MOCK` 改为 `false`（或删除该行）**，即直连 `VITE_API_BASE` 指向的真实后端，无需改动任何业务代码。

**演示账号（mock 模式）**：
- 管理员：`admin` / `admin123`（role_id=1，可管理所有文章与分类）
- 普通用户：`demo` / `demo123`（role_id=3，仅管理自己的内容）

## 9. 联调注意事项（给后端/联调阶段）

1. **契约以 `blog-api.md` 为准**：现有 `routes/article_request.js` 等仍是旧接口（`/article/getAllByPage`、`/article_category/*`、`/register` 等），与契约不一致。前端完全按 `blog-api.md` 编写，**后端需实现契约中的新路由**（`/article/list`、`/article/detail/:id`、`/article/update/:id`、`/article/category/*`、`/comment/*`、`/sys/register`）。
2. **列表响应格式**：`data = { list, total, page, pageSize }`；单条放 `data`。
3. **文章对象字段**：前端使用 `article_id`（非 `id`）、`author_name`、`category_ids`（数组）、`category_names`（数组）。
4. **分类接口需返回 `user_id`**：前端「分类管理」页通过 `user_id` 过滤出「我的分类」（admin/editor 显示全部并带 `user_name` 归属）。`/article/category/list` 返回的每个分类请带上 `user_id`（建议也带 `user_name`）。
5. **`/article/mine` 按角色返回**：普通用户返回自己的文章；admin/editor（role_id 1/2）返回全部，前端据此实现「管理所有人的文章」。
6. **评论树**：`/comment/list/:articleId` 返回 `data.list`，每个评论对象含 `children` 嵌套；顶层 `parent_id` 为 `null`。
7. **认证响应**：`/sys/login`、`/sys/register` 返回顶层 `token` 与 `user_info`（含 `id`、`username`、`role_id` 等）。
8. **CORS**：后端需允许 `http://127.0.0.1:5173` 跨域（`Authorization` 头）。
9. **token 传递**：前端请求头为 `Authorization: Bearer <token>`，后端鉴权按 `docs/conventions.md` 的 `verifyToken` 解析。

## 10. 设计实现要点

- 强调色 `indigo-600`（hover `indigo-700`）、页面背景 `zinc-50`、卡片白底 + `border-zinc-200` + `shadow-sm` + `rounded-lg`。
- 文章正文 `max-w-3xl` 居中、列表 `max-w-5xl`；顶栏 `sticky` 白底细下边框，移动端汉堡菜单。
- Markdown 正文样式集中在 `src/style.css` 的 `.prose`，代码块深色 + github-dark 高亮，行内代码浅灰底等宽字体。
- 组件复用类通过 `<style scoped>` + `@reference "../style.css"`（Tailwind v4 在 SFC 内使用 `@apply` 的写法）。
