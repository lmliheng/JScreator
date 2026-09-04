# JScreator Express 后端三层架构改造规划（Controller / Service / DAO）

> 适用范围：`C:\Users\Administrator\Desktop\最近\JScreator` 根目录的 Express 主应用（`server.js` + `routes/*` + `utils/*`），以及 `Backend/` 目录（TypeScript 迁移目标区）。
> 编写日期：2025 年（规划稿）。本文只做规划，不含可直接运行的实现代码；落地时按“第 10 节 阶段计划”逐项推进。

---

## 0. 结论先行（TL;DR）

1. **Controller / Service / DAO 三层设计对这个项目是合适的**，不是过度设计 —— 当前代码约 **130 个接口、26 个业务路由文件**，已是一个“中型单体”，且**数据访问层事实上已经存在**（`utils/db_*.js`），真正的痛点不是“没有分层”，而是 **HTTP 层混入了业务规则与 SQL、鉴权与归属校验在多处复制粘贴、单文件过大（`article_request.js` 648 行、`db_curd.js` 851 行）**。
2. 改造的本质是 **“归位 + 去重 + 补类型”**，不是推倒重写：把现有 SQL 搬运进 DAO、把业务判断提炼进 Service、把路由瘦身为参数校验 + 响应组装。
3. 落地时建议按 **域（Domain）** 组织而非按层建大目录，先迁移高价值域（article / user / auth），采用 **绞杀者模式（Strangler）** 分阶段替换，全程保证对外接口的 **path / 参数 / 响应结构不变**（Admin、Blog、IMG 三个前端 + OpenAPI `/api/v1/*` 外部调用方都依赖它）。
4. **重要前置问题已锁定**：本次改造**绑定 TypeScript**（`Backend/` 即目标区，当前 `index.ts` 是不可运行的半成品，见 1.4）；Dockerfile 改为 **TS 两段式构建**（见 10.P1）；**无前端调用的接口删除**（删除清单见 7.6）；`/social/notifications` 与 `/notification/*` **已判定为非同一业务，分别保留**（专项分析见 7.7）。

---

## 0.5 决策记录（已确认，2025）

| # | 决策 | 状态 | 对规划的影响 |
|---|---|---|---|
| ① | 语言：本次迁移**绑定 TypeScript**，落点 `Backend/` | ✅ 已锁定 | 目录树/代码模式全部按 TS；`Backend/index.ts` 在 P1 重建后删除 |
| ② | Dockerfile **改 TS 两段式构建**（build 镜像编译 → 运行镜像 `node dist/server.js`） | ✅ 已锁定 | 见 §10 P1；需在云托管侧确认构建命令/Node 版本 |
| ③ | **无前端调用的接口一律删除**（删除清单见 7.6，P0 冻结） | ✅ 已锁定 | 删除在 P0 冻结清单、各域迁移时同步执行 |
| ④ | `/social/notifications` 与 `/notification/*` **不是同一业务**，**两套都保留**，拆成独立模块 | ✅ 已锁定 | 见 §7.7 专项分析；social 内为“互动通知”，独立模块为“广播通知” |
| ⑤ | 注册路径：统一为 `POST /sys/register`（与 `/sys/login` 对齐），删除裸 `/register` | ✅ 已锁定 | P0 落地：register 路由改挂 `/sys/register`，验证 Admin/Blog 注册链路（见 7.6） |
| ⑥ | 动工节奏：P0 已确认执行并完成 | ✅ 已完成 | 结果见 §10「P0 执行记录」（129→112 端点） |
| ⑦ | P1 TS 骨架等价启动 + 两段式 Dockerfile | ✅ 已完成 | 结果见 §10「P1 执行记录」；运行：`npm run start:ts` |
| ⑧ | P2 横切收编（errorHandler 挂载 + common 单测） | ✅ 已完成 | 结果见 §10「P2 执行记录」；运行：`npm run test:ts` |
| ⑨ | P3 auth 域迁移（5/5 子流程完成） | ✅ 已完成 | /sys/login、/sys/register、/email/*、/totp/*、/auth/github*、/oauth/* 已 TS 化并通过等价验证（见 §10 P3 执行记录） |
| ⑩ | P3 user 域迁移（13 端点） | ✅ 已完成 | /sys/profile、/userInfo*、/resetPassword、/user-manage/* 已 TS 化并通过等价验证（见 §10 P3 执行记录） |
| ⑪ | P3 api_key/openapi 域迁移 | ✅ 已完成 | /api-keys* + /api/v1/* 已 TS 化并通过等价验证；/api/v1 数据层暂桥接 legacy（见 §10 P3 执行记录） |
| ⑫ | P3 article 域迁移（14 端点） | ✅ 已完成 | 文章/分类/归档/我的文章/AI 总结已 TS 化并通过等价验证；openapi 桥接切换 TS DAO（见 §10 P3 执行记录） |
| ⑬ | P3 blog_profile 域迁移（5 端点） | ✅ 已完成 | /blog/* 已 TS 化并通过等价验证；openapi 用户桥接切换 TS DAO，遗留桥仅剩 ai_summary（见 §10 P3 执行记录） |
| ⑭ | P3 comment/social/dm 域迁移（24 端点） | ✅ 已完成 | 树形评论、关注·点赞·收藏·互动通知、私信 REST 已 TS 化并通过等价验证 39/39（见 §10 P3 执行记录） |
| ⑮ | P3 system 域收尾（最后 9 个 legacy 模块） | ✅ 已完成 | role/permission/notification/ad/announcement/upload/system-monitor/init/backup 全部 TS 化并验证 50/50；**TS 入口不再挂载任何 legacy 路由**（见 §10 P3 执行记录） |
| ⑯ | P4 事务与鉴权强化 | ✅ 已完成 | withTransaction + 跨表写事务化 + 分层审计 + service 单测（30/30，见 §10 P4 执行记录） |
| ⑰ | P5 WS/异步收编 | ✅ 已完成 | WS 协议层 TS 化（infra/ws）+ agent 服务化 + dm.send；协议双入口等价 8/8（见 §10 P5 执行记录） |
| ⑱ | P6 契约测试 | ✅ 已完成 | contract.test 断言注册路径集 == api-baseline（31/31 单测全绿，见 §10 P6 执行记录） |
| ⑲ | 部署链路本地验证（Dockerfile 两段式模拟） | ✅ 已完成 | ci→build→prune→运行冒烟全过（HTTP+WS）；云侧构建支持与环境变量待你在控制台确认（见 §10 部署验证记录） |

---

## 1. 现状盘点（基于源码实测）

### 1.1 顶层结构

```
JScreator/
├── server.js                  # 唯一入口：Express4 + http.Server(承载WS) + CORS + api统计中间件 + 24个路由挂载
├── Dockerfile                 # node:18-alpine，CMD node server.js（微信云托管，监听80）
├── routes/                    # 25 个 *_request.js（25 个文件中 24 个被挂载）
├── utils/                     # 数据访问 utils/db_*.js + 鉴权/邮件/OSS/WS/AI 等
├── Backend/                   # TS 迁移“草图”（index.ts/package.json/tsconfig.json，当前不可运行）
├── Admin/ Blog/ IMG/          # 三个 Vue3 前端（webpack / vite），直连 127.0.0.1:7000，无 /api 前缀
├── mcp-server/                # 独立的 TS MCP 服务（Hono），不在本次范围
├── scripts/  test/  asset/devDocs/
```

### 1.2 接口层现状

- **25 个路由文件、约 130 个接口**，全部直接挂载在根路径（`/article/list`、`/sys/login` …），**没有 `/api` 前缀**，前端 `useAxiosConfig.js` 中 `baseURL` 指向 `127.0.0.1:7000`。
- 每个路由文件 = `express.Router()`，内部自行完成：**token 解析 → 权限判断 → 参数校验 → 调 db → try/catch → 组装 `{ code, success, message, data }` 响应**。
- **单文件过大**：`article_request.js` 648 行；且一个模块内“新契约路由”与“遗留路由”并存（如 `/article/detail/:id` 与 query 版 `/article/detail`、`/article/getAll`、`/article_category/*`），代码里自己标注了“遗留/复用/新增”。
- 路由文件之间出现**跨文件互相调用**（如 `comment_request.js` 同时用 `db_comment` 和 `db_article`），依赖关系隐藏在各文件 `require` 中，没有显式边界。
- **孤儿文件**：`routes/image_update.js` 只有注释，未挂载；`routes/auth_github.js` 为 OAuth 重定向流（写 res 302 跳转，属“非 JSON 响应”特例）。

### 1.3 数据访问层现状（已事实存在的 DAO）

| 文件 | 规模/职责 | 归属域 |
|---|---|---|
| `utils/db_curd.js` | 851 行“通用 CRUD + 杂项”，含用户/角色/文章/分类等历史函数，动态 SET、分页等 | 多个域混放（重构重点） |
| `utils/db_article.js` | 文章/分类/归档/AI 摘要（14KB） | article |
| `utils/db_comment.js` | 树形评论/级联删除 | comment |
| `utils/db_social.js` / `db_message.js` / `db_notification.js` | 关注/点赞/收藏、私信、通知 | social / dm |
| `db_user` 相关函数分散于 db_curd | 用户/角色/权限 | user / system |
| `db_ad.js` / `db_announcement.js` / `db_blog_profile.js` / `db_api_key.js` / `db_oauth.js` | 广告/公告/博客资料/API密钥/OAuth | 各业务域 |
| `connect_db.js` | mysql2 连接池（pool） | 全局基础 |

- SQL 风格：`mysql2/promise` 的 `pool.query`，**部分 SQL 仍是字符串拼接（如 db_curd 内 `${id}`），存在注入隐患与坏味道**，迁移时统一参数化。
- 路由层仍偶发**直接 `require pool` 写 SQL**（如 `comment_request.js` 的 `requireAdmin` 里 `pool.query('SELECT role_id …')`）——说明 DAO 边界并没有被真正遵守。

### 1.4 Backend/ 目录现状（关键问题）

```
Backend/
├── index.ts        # ≈ server.js 的拷贝，但第34行起 require('./routes/...')、require('./utils/...')
│                   #   —— Backend/ 下并不存在 routes/ 与 utils/，require 必然失败
├── package.json    # name=backend；type=module；依赖全部误放 devDependencies
├── package-lock.json
└── tsconfig.json   # strict、nodenext、verbatimModuleSyntax（合理，可沿用）
```

- `npm test` 执行的是 `node index.ts`：**Node 18 不支持直接运行 TS**（无 type stripping），且模块格式（ESM + `require()` CJS 互操作）与 tsconfig `module: nodenext` 组合无法在当前状态下启动。
- `@types/express` 是 **^5.0.6**，而运行依赖是 **express ^4.18.2** —— 类型与运行时版本不匹配，会导致类型误判。
- **结论**：`Backend/` 是一份“TS 迁移草图”，本身不可运行，也没有被 Dockerfile 或任何脚本引用。它既是本次规划的目标落点，也是需要先清理的“第二份代码”。

### 1.5 横切能力（迁移时必须保留语义）

| 能力 | 实现 | 迁移要求 |
|---|---|---|
| 接口统计/系统监控 | `utils/api_monitor.js`：内存 Map + `registerRoutes(app)` 递归扫描 `app._router.stack` | 必须在**所有路由挂载完成后**调用；迁移后路径/方法不变则统计口径不变 |
| WebSocket | `utils/ws_server.js`：与 Express 同端口（`http.createServer(app)`），协议含 agent 流式对话、DM、ping | WS 消息处理（agent/dm）在新架构中应调用 **Service**，不能内联 SQL |
| 鉴权 | `utils/authMiddleware.js`（verifyToken/requireRole）+ `utils/token_creator.js`（JWT）| 大部分路由**并未使用** authMiddleware，而是复制了 `getLoginUser(req)` 小工具函数 —— 统一为中间件 + `req.user` |
| 上传 | `utils/oss/oss.js` + multer | 保持控制器可测试：OSS 客户端注入 DAO/Service 之外的基础设施层 |
| 邮件/AI/备份 | `emailSender.js`、`llm.js`/`ai_summary.js`/`agent.js`、mysqldump | AI summary 是“异步 fire-and-forget”，迁移时保留不阻塞响应；备份下载是流式响应特例 |

---

## 2. 三层架构评价（“你觉得这样设计怎么样”）

### 2.1 总体判断：方向正确，值得做

| 维度 | 评价 |
|---|---|
| 必要性 | 本项目是**单一 MySQL 数据库的中型单体**（约 130 接口、20+ 表、5 个前端/客户端），规模到了分层能带来净收益的临界点 |
| 可行性 | 已有 `utils/db_*.js` 作 DAO 雏形，迁移成本低于“从零建三层”；SQL 可先**搬运后优化** |
| 收益 | ① 业务规则（归属校验/权限/事务）不再散落在每个路由里；② DAO 可脱离 Express 单测（mock pool）；③ 新域开发只需照着 controller→service→dao 补齐 |

### 2.2 需要注意的四个“陷阱”（本项目的针对性建议）

1. **不要为分层而分层（空转三层）**。如果一个接口只是“查表返回”，可以允许 Controller 直接调 DAO（或薄 Service 仅做参数归一），不必强制 1 接口 = 3 个文件 3 个类。判断标准：**有“规则/多步/事务/跨域协作”才需要 Service 方法**；纯 CRUD 用通用 DAO 方法即可。
2. **Express 语境下的 Controller 不是“胖类”**。Express 里真正的第一层是 `Router`（声明路径与方法），Controller 建议作为“路由 handler 的载体”存在，职责收敛为：解析入参 → 校验 → 调 Service → 统一响应。**不要**在 Controller 里写 SQL、不要直接 `import pool`。
3. **不要为“分层”而引入重框架**（NestJS 装饰器全家桶、tsyringe 等）。项目已在 `Admin/node_modules` 出现 tsyringe 但后端并未使用。轻量方案即可：**纯函数模块或小 class + 构造函数注入 DAO/pool**；只有跨模块共享依赖变多时才考虑容器。
4. **DAO 层必须管好“事务边界”**。跨表写操作（如文章+分类中间表、评论级联删除、用户+角色）需要 `pool.getConnection() + beginTransaction`。设计约定：**事务在 Service 发起，DAO 方法接受可选的 `connection` 参数**（见 6.3 示例），避免 DAO 各自连池导致无法回滚。

### 2.3 与“分模块不分层”等其他方案的取舍

- **方案 A（本次推荐）：Controller / Service / DAO 三层 + 按域分目录**。优点：规则沉淀在 Service，数据访问沉淀在 DAO，利于测试与多人并行；代价：文件数量增加（本项目可控）。
- 方案 B：仅“路由层 + DAO 层”（现状加强版）—— 适合接口全部是薄 CRUD 的项目，本项目已有大量业务规则（可见性、归属、角色、级联），**不够**。
- 方案 C：Clean Architecture / 六边形 —— 对本项目**过重**，会引入大量 mapper/port 样板。

---

## 3. 目标架构

```
浏览器/前端 (Admin Blog IMG)         外部调用方 (OpenAPI /api/v1)
        │                                        │
        ▼                                        ▼
   ┌──────────────────────────────────────────────────┐
   │ 入口层   src/server.ts(启动)  src/app.ts(装配)      │   ← http.Server + WebSocket 同端口
   ├──────────────────────────────────────────────────┤
   │ 路由层   modules/*/routes.ts   (仅声明 method+path) │
   ├──────────────────────────────────────────────────┤
   │ 控制层   modules/*/controllers/*                  │   ← 解析/校验/调Service/统一响应（不碰SQL）
   ├──────────────────────────────────────────────────┤
   │ 业务层   modules/*/services/*                     │   ← 规则/权限归属/事务/跨域编排/异步任务
   ├──────────────────────────────────────────────────┤
   │ 数据层   modules/*/dao/* + db/pool.ts + 事务助手    │   ← 只做参数化 SQL，返回行数据
   ├──────────────────────────────────────────────────┤
   │ 横切     common/(middleware error response)       │   ← 鉴权/角色/错误处理/响应包装/校验
   └──────────────────────────────────────────────────┘
        │
        ▼
   MySQL (mysql2 连接池)     OSS(ali-oss)     SMTP(nodemailer)     OpenAI/LLM
```

**依赖方向（强制单向）**：

```
routes ──► controllers ──► services ──► dao ──► db/pool
            │                │
            └────► common(错误/响应/校验/中间件) ◄────┘
```

- controller **禁止** import dao；service **禁止** import controller；dao **禁止**依赖业务规则与 res/req。
- 例外与特例：OAuth 重定向（`auth_github`）与备份下载（流式）是“非 JSON 响应”的 controller，允许直接写 res，但逻辑仍在 service（service 返回数据/文件句柄，controller 负责发送）。

---

## 4. 目录结构与命名规范

```
Backend/
├── package.json / tsconfig.json / .env.example
├── src/
│   ├── server.ts                 # 启动：http.createServer(app) + initWsServer + listen
│   ├── app.ts                    # 装配：cors/json/统计中间件/挂载各域 routes/registerRoutes
│   ├── config/                   # env 读取与校验（db/jwt/cors 白名单/oss…）
│   ├── db/
│   │   ├── pool.ts               # mysql2 连接池（搬运 utils/connect_db.js）
│   │   └── transaction.ts        # withTransaction(fn) 助手
│   ├── common/
│   │   ├── middleware/           # auth(verifyToken/requireRole)、rateLimit、upload
│   │   ├── errors/               # AppError + errorHandler + asyncHandler
│   │   ├── response.ts           # ok(res,data)/fail 统一 {code,success,message,data}
│   │   ├── validation/           # 轻量校验器（或引入 zod）
│   │   └── logger/ api-monitor/  # recordApi/registerRoutes/getApiStats 语义保留
│   ├── infra/                    # oss/ email / llm / ai-summary / agent / backup / ws
│   │   └── ws/                   # ws_server 同端口；消息处理回调 → 调 modules/*/services
│   └── modules/
│       ├── auth/      {routes, controller, service, dao, types}   # login/register/totp/oauth/github/email
│       ├── user/      {…}                                          # profile/user-manage/api-keys
│       ├── article/   {…}                                          # article + category + ai-summary(内部服务)
│       ├── comment/   {…}
│       ├── social/    {…}                                          # follow/like/favorite + 互动通知(interactionNotification)
│       ├── dm/        {…}                                          # REST + WS 共用 service
│       ├── notification/ {…}                                       # 广播通知（/notification/*，Admin 公告中心）
│       ├── content/   {…}                                          # blog_profile/ad/announcement/upload
│       ├── system/    {…}                                          # role/permission/monitor/backup
│       └── openapi/   {…}                                          # /api/v1/* + api_key 校验与 scope
└── (迁移完成后删除 Backend/index.ts 与根目录重复代码，见第 10 节)
```

**命名约定**：
- 文件：`xxx.controller.ts` / `xxx.service.ts` / `xxx.dao.ts` / `xxx.routes.ts` / `xxx.types.ts`（DAO 按表或聚合命名：`article.dao.ts` 可含多表方法，但**只服务 article 域**）。
- 方法：沿用现有 `verb_noun` 风格便于对照（`article_list`、`article_getById`），Service 方法以动词+意图命名（`publishArticle`、`regenerateSummary`）。
- 响应：所有 JSON 接口统一 `{ code, success, message, data }`（现状即如此，保持）。

---

## 5. 分层职责（写成团队约定）

| 层 | 职责 | 禁止 |
|---|---|---|
| routes.ts | 声明 method + path，绑定 controller（可叠加 auth 中间件） | 写业务、写 SQL |
| controller | 取参（req.params/query/body + req.user）、参数兜底校验、调 service、统一响应/错误透传 | 直接 import pool、写业务规则、拼接 SQL |
| service | 业务规则（状态机、可见性、归属/权限、事务编排、跨域协作、异步任务触发） | import controller、出现 res/req 对象（用抛出 AppError 代替） |
| dao | 参数化 SQL、行映射、分页组装；可接受 `conn` 参与事务 | 业务判断、鉴权、日志外发 |
| common/infra | 中间件、错误、响应、pool、OSS/邮件/LLM/WS 基础设施 | 具体业务术语 |

---

## 6. 参考代码模式（以 article 域为模板）

> 仅示意签名，非最终实现。目标：**同一接口“搬运前后”行为逐字节等价**。

```ts
// modules/article/article.dao.ts —— 直接搬运 db_article.js 现有 SQL
export class ArticleDao {
  constructor(private pool: Pool) {}
  list(filter: { page?; pageSize?; categoryId?; keyword?; status?; author? }): Promise<ArticleRow[]> { /* 原 SQL */ }
  getById(id: number, conn?: Connection): Promise<ArticleRow | null> { /* … */ }
  add(input, categoryIds: number[], conn?: Connection): Promise<number> { /* 含中间表插入，事务由 service 控制 */ }
}

// modules/article/article.service.ts —— 规则归位
export class ArticleService {
  constructor(private dao: ArticleDao, private userDao: UserDao, private ai: AiSummary) {}
  async listVisible(filter) { /* 只暴露 status=1 或按作者过滤 */ }
  async detail(id: number, viewer?: Viewer) { /* 原路由里“非发布仅作者或 admin/editor 可见”逻辑 → AppError(404) */ }
  async create(userId, input, categoryIds) { /* 校验 → dao.add（事务）→ 若发布则异步 summarizeAndSave */ }
}

// modules/article/article.controller.ts —— 瘦 handler
export const articleController = (svc: ArticleService) => ({
  list: asyncHandler(async (req, res) => {
    res.json(ok(await svc.listVisible(req.query)));
  }),
  detail: asyncHandler(async (req, res) => {
    res.json(ok(await svc.detail(Number(req.params.id), req.user)));
  }),
});

// modules/article/article.routes.ts —— 只声明路径
export const articleRoutes = (svc: ArticleService) => {
  const r = Router();
  const c = articleController(svc);
  r.get('/article/list', c.list);
  r.get('/article/detail/:id', c.detail);
  r.post('/article/add', verifyToken, c.add);   // verifyToken 由 common 提供
  return r;
};
```

### 6.1 统一错误处理（替代现在每路由 try/catch 复制）

```ts
class AppError extends Error { constructor(public code: number, message: string) { super(message) } }
// service 抛 AppError(404,'文章不存在')；errorHandler 统一输出 { code, success:false, message }
// asyncHandler：包一层 catch(next)，规避 Express4 异步异常不进入错误中间件的问题
```

### 6.2 归属校验 helper（消灭各路由手写 getLoginUser/isAdminOrEditor）

```ts
// service 内统一实现，替代 comment_request 手写的 requireAdmin、article_request 的 isAdminOrEditor
async assertAdmin(viewer) { /* role_id===1，否则 AppError(403) */ }
async assertArticleOwnerOrAdmin(viewer, article) { … }
```

### 6.3 事务助手（跨 DAO 写操作在 Service 内包事务）

```ts
export async function withTransaction<T>(pool: Pool, fn: (conn: Connection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const r = await fn(conn); await conn.commit(); return r; }
  catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}
// dao.add(..., conn) 内部使用 conn 而非 pool —— 这是“DAO 参与事务”的唯一通道
```

---

## 7. 领域模块映射表（routes → 三层 → 数据）

> 每行含义：现有路由文件 → 目标 modules/xx → controller 拆分建议 → service 主要职责 → dao 复用来源。接口 path 全部保持不变。

### 7.1 auth / 账户

| 现有文件 | 目标模块 | Service 职责要点 | DAO 来源 |
|---|---|---|---|
| login_request.js（/sys/login） | auth | 校验密码+签发 JWT+返回用户信息（含角色权限 join） | db_curd 用户部分 → user.dao |
| register_request.js（/register → 改 /sys/register） | auth | 用户名/邮箱查重、ToHash 入库；**路径已对齐决策⑤：后端统一 `POST /sys/register`（与 `/sys/login` 一致），P0 即改** | db_curd → user.dao |
| totp_request.js（/totp/*） | auth | otplib 绑定/确认/禁用/校验登录 | user.dao(totp 字段) |
| auth_email.js（/email/send-code,/email/login） | auth | 验证码生成/发送(infra mail)/校验登录 | user.dao + 验证码存储 |
| auth_github.js（/auth/github*） | auth | OAuth 跳转/回调/bind（302 特例） | user.dao + github bind 表 |
| oauth_request.js（/oauth/*） | auth(oauth) | 客户端 CRUD + authorize + token 签发 | db_oauth → oauth.dao |
| api_key_request.js（/api-keys*） | openapi | API Key CRUD/启停；hash 存储 | db_api_key → api_key.dao |
| user_request.js（/sys/profile,/userInfo,/resetPassword,/user-manage/*） | user | 资料读取/更新（动态字段 SET 保留）、改密、管理员用户 CRUD/批量删除 | db_curd 用户函数 → user.dao |

### 7.2 内容创作

| 现有文件 | 目标模块 | Service 职责要点 | DAO 来源 |
|---|---|---|---|
| article_request.js（新契约 + 遗留 + /article/category/* + ai-summary/regenerate） | article | 列表可见性、详情鉴权、增删改（事务+中间表）、mine、归档、AI 摘要重生成 | db_article + db_curd 遗留函数 → article.dao / category.dao |
| article_category_request.js（遗留 /article_category/*） | article | **先核对前端是否仍调用**；若已废弃则在迁移时下线（见 12.决策③） | 同上 |
| blog_profile_request.js（/blog/*） | content | 聚合个人主页：资料+文章数+关注数等 | db_blog_profile + 跨域查询(service 编排) |
| upload_request.js（/upload/image） | content | multer → OSS，返回 URL | infra/oss |

### 7.3 互动

| 现有文件 | 目标模块 | Service 职责要点 | DAO 来源 |
|---|---|---|---|
| comment_request.js（/comment/*） | comment | 树形组装（楼中楼）、父评论同文校验、级联删除、manage 鉴权 | db_comment + db_article → comment.dao |
| social_request.js（/social/*，含 /social/notifications*） | social | follow/like/favorite 幂等、计数、**互动通知联动（写 user_notification）**、admin 列表 | db_social → social.dao（follow/like/favorite）+ interactionNotification.dao（user_notification） |
| dm_request.js（/dm/*） | dm | 会话/消息/已读（REST 与 WS 共用 service） | db_message → dm.dao |
| notification_request.js（/notification/*） | **notification（广播通知模块）** | **平台广播通知**：管理员发布（all/user/role 定向）、用户可见性计算、已读 | db_notification → broadcastNotification.dao（notification + notification_read） |

### 7.4 平台与系统

| 现有文件 | 目标模块 | Service 职责要点 | DAO 来源 |
|---|---|---|---|
| role_request.js / permission_request.js | system | RBAC：角色-权限中间表维护、setPermission（事务） | db_curd → role.dao/permission.dao |
| system_monitor_request.js | system | 系统信息 + api 统计（读 api-monitor 内存） | infra/api-monitor（无 SQL） |
| init_request.js（GET /） | system | 健康检查文案 | 无 |
| ad_request.js / announcement_request.js | content | 广告位/公告 CRUD 与状态 | db_ad / db_announcement |
| backup_request.js（/backup/download） | system | mysqldump 流式下载（admin 鉴权；流式特例） | infra/backup |
| open_api.js（/api/v1/*） | openapi | requireApiKey + scope 校验 + 只读/写文章用户接口 | api_key.dao + article.dao/user.dao |

### 7.5 “重复/新旧双套”接口审计结论（已扫 Admin/Blog/IMG/mcp-server 全部 src）

> 审计方法：把 routes 全部 ~130 个 path 拆成片段，对 `Admin/src`、`Blog/src`、`IMG/src`、`mcp-server/src` 做正则全量匹配；Admin 的请求统一收口在 `composables/useRequest.js`，Blog 收口在 `src/api/*`，故源码扫描可信度高。

| 端点组 | 审计结论 |
|---|---|
| `/article/detail/:id`（契约） vs `/article/detail`(query)（遗留） | Admin/Blog 均只调 `:id` 版 → **query 版删除** |
| `/article/update/:id` vs `/article/update`(query)；`/article/delete/:id` vs `/article/delete`(query) | 前端只调 `:id` 版 → **query 版删除** |
| `/article/getAll`、`/article/getAllByPage`、`/article/getSomeByPageAndCategory` | **零调用 → 删除**（连同其 db_curd 遗留函数） |
| `/article/category/*`（article_request 内契约） vs `/article_category/*`（独立文件 + article_request 内遗留两条） | 前端只调 `/article/category/*` → **`/article_category/*` 全部删除（含 article_category_request.js 整文件）** |
| `/role/list|permission/list` vs `/role/getAll|permission/getAll` | Admin 只调 `/role/list`、`/permission/list` → **getAll 版删除** |
| `/role/update` vs `/role/updateName`、`/role/addPermission` | Admin 无 updateName/addPermission 调用 → **删除**（P0 复核后） |
| `/permission/update`（PUT） vs `/permission/update`（POST） | 重复注册同一 path；保留 PUT → **POST 版删除** |
| `/social/notifications*` vs `/notification/*` | **非同一业务，两套都保留**（见 7.7） |
| `POST /register` vs 前端调用的 `POST /sys/register` | **前后端不一致（前端注册当前 404）** → 已决策⑤：统一 `/sys/register`，P0 即执行 |

### 7.6 删除清单（已锁定 + 待 P0 复核）

**A. 整文件删除**
- `routes/article_category_request.js`（5 个 `/article_category/*` 端点零调用）
- `routes/image_update.js`（空文件，仅注释，未挂载）

**B. 端点级删除（路由文件瘦身时同步执行）**
- `article_request.js`：`GET /article/getAll`、`GET /article/getAllByPage`、`GET /article/getSomeByPageAndCategory`、`GET /article/detail`(query)、`PUT /article/update`(query)、`DELETE /article/delete`(query)、`GET /article_category/getAll`、`POST /article_category/set`
- `permission_request.js`：`GET /permission/getAll`、`POST /permission/update`（保留 PUT）
- `role_request.js`：`GET /role/getAll`、`PUT /role/updateName`、`POST /role/addPermission`（P0 复核无其它调用后）
- `register_request.js`：`POST /register` → **改为 `POST /sys/register`（决策⑤已锁定，P0 即执行）**，旧路径删除（无任何前端调用，仅 SPA 内部路由 `/register` 与之同名，互不影响）
- `init_request.js`：`GET /`（若云托管/运维未把它当健康检查则一并删除，P0 复核）
- `db_curd.js` 中随上述端点一起失活的遗留函数（迁移到 DAO 时不再搬运）

**C. P0 复核项**：编译产物 `dist/` 中是否有旧调用（一般不算调用方）；是否有部署在外的老版本前端/脚本仍在调上表端点；`/role/updateName`、`/role/addPermission`、`GET /` 是否有系统脚本依赖。

### 7.7 两套通知系统专项分析（已确认：非同一业务，各自保留）

**证据一：数据模型不同**

| | `/social/notifications*`（互动通知） | `/notification/*`（广播通知） |
|---|---|---|
| 表 | `user_notification`（单表，每事件一行，`is_read` 是行内字段） | `notification` + `notification_read`（广播体一张表 + 每个用户独立已读标记表） |
| 记录语义 | 一条记录 = “某人对我做了一次互动” | 一条记录 = “一条公告，按规则推给很多人” |

**证据二：生产者与权限完全不同**

- 互动通知**没有任何创建 API**：由业务动作内部写库 —— 关注时 `notificationAdd(被关注者, 动作人, 'follow', …)`、点赞/收藏时通知文章作者（`type: 'follow'|'like'|'favorite'`，含 `actor_id`/`article_id`），字段无 title。
- 广播通知**只由管理员 API 发布**：`POST /notification/add|update|delete` 均校验 `role_id===1`；字段含 `title/content/type(system|announcement|reminder)/importance/target_type('all'|'user'|'role')/target_id/sender_id`。

**证据三：消费端可见性规则与已读模型不同**

- 互动通知：收件人就是行的 `user_id`（写死），列表**分页**（page/pageSize）。
- 广播通知：收件人**动态计算** —— `target_type='all'` 或 `='user' 且 target_id=我` 或 `='role' 且 target_id=我的 role_id`（SQL 里子查询当前用户角色）；**不分页**，返回 `total=list.length`；已读是 `notification_read` 的幂等 upsert（`ON DUPLICATE KEY UPDATE`）。

**证据四：调用方完全分离（前端源码实测）**

| 调用方 | 使用的接口 |
|---|---|
| **Admin 前端**（通知铃铛 + 通知中心 + 通知管理） | `/notification/add|list|unread-count|read|update|delete`（useRequest.js L247–282；NotificationBell/NotificationCenter/NotificationManage 三视图，admin 才能进发布/管理页） |
| **Blog 前端**（个人主页收件箱） | `/social/notifications`、`/social/notifications/unread-count`、`/social/notifications/read`（api/social.js；BlogProfileView 渲染） |
| IMG / mcp-server | 均不调用上述任何通知接口 |

**架构落地（对应决策④）**
- **social 模块**：`interactionNotification.service.ts` + `user_notification.dao.ts`，被 follow/like/favorite 的 service 调用写入；保留 `/social/notifications*`（Blog 个人收件箱）。
- **notification 模块**（独立于 system）：`broadcastNotification.service.ts` + `broadcastNotification.dao.ts`（notification + notification_read）；保留 `/notification/*`（Admin 公告中心）。
- 两个模块**不共享 service/dao**；已读、未读数语义各自实现，响应字段也保持现状（`data.count` vs `data.unread_count` 的差异**原样保留**，避免前端改动）。
- 可选优化（二期，不改变接口）：若未来想在一个铃铛里聚合两类通知，另建聚合 API，而不是合并本表。

---

## 8. 横切关注点迁移清单

1. **鉴权统一**：把散落各路由的 `getLoginUser(req)` 收编为 `common/middleware/auth.ts`（`verifyToken` 设 `req.user`，失败 401）。**行为差异风险**：现有代码“解析失败返回 null 继续走 404”与“直接 401”两种策略并存（如 article detail 用 404 掩盖未发布，comment 用 401），迁移时要逐个端点对照，禁止“顺手统一”。
2. **权限查库缓存**：`requireAdmin`/`isAdminOrEditor` 每请求查 `user.role_id`，可在 verifyToken 时一并带出或短 TTL 缓存，减少一次 DB 往返（可选优化，二期做）。
3. **API 监控语义保留**：`recordApi` 中间件在**所有路由前**注册；`registerRoutes(app)` 在**所有路由挂载后**调用；`system_monitor` 读同一份内存 stats。三条顺序约束写进 app.ts 注释。
4. **WebSocket**：`infra/ws` 保持 `http.createServer(app)` 同端口方案；把 agent/dm 处理改为调用 `modules/*/services`（`agent.service.ts` 内部复用 llm/ai_summary，DM 复用 dm.service），WS 内部不再直接写 SQL。
5. **校验层**：先用轻量手写校验（现状风格），不要在一期引入 zod 造成“行为微变”（如字符串数字转换）；二期可统一 zod。
6. **非 JSON 特例**：github OAuth 302、backup 流式下载、upload 返回 —— controller 层显式标注 `@special` 或拆分文件，防止后来者误套 `ok()` 包装。

---

## 9. 数据库与事务约定

- 保留 `mysql2/promise` 连接池（`connect_db.js` → `db/pool.ts`），连接参数从 env 读取，导出 `testConnection` 供启动自检。
- **SQL 安全**：迁移中把所有 `${…}` 拼接改为 `?` 参数化（现状 db_curd 内有残留），不改变返回结构。
- **事务场景清单**（第一期就要覆盖）：文章+分类中间表、评论级联删除、角色权限 setPermission、user-manage 删除（若有级联）、批量删除（delete-batch）、DM 已读。
- 表结构以运行库为准（`scripts/init_db.js` 只建了部分表，多数表由历史迁移脚本维护），DAO 迁移时**不做 DDL 变更**；如确需字段调整另立 migration 任务。

---

## 10. 分阶段迁移计划（绞杀者模式）

> 铁律：**接口清单以 P0 冻结的“删除后基线”为准** —— P0 先按 §7.6 执行接口删除，再用 registerRoutes 导出一份新基线 `api-baseline.json`；此后每个阶段结束时清单都必须与该基线 diff 一致，三个前端冒烟通过。

| 阶段 | 内容 | 产出 | 退出标准 |
|---|---|---|---|
| **P0 ✅ 已完成（2025）** | ① 用 registerRoutes 导出全量清单存档；② 按 §7.6 执行删除（整文件 + 端点级 + register 路由改挂 `/sys/register`），删除后导出**新基线** `asset/devDocs/api-baseline.json`；③ 复核 §7.6-C 遗留项 | 删除后代码 + api-baseline.json + api-baseline-before-p0.json | 删除清单全部落地；`/sys/register` 注册链路打通（决策⑤）；无调用方回归 |
| **P1 ✅ 已完成（2025）** | 搭建 Backend/src（config/legacy 桥/common：错误/响应/asyncHandler/鉴权）；旧路由经 CJS 桥以“只挂载 legacy 路由”方式跑通；修正 Backend/tsconfig 与 package.json；根 package.json 增加 ts 脚本与构建期依赖；**TS 两段式 Dockerfile**（node:20-alpine build → npm ci → ts:build → prune → run 阶段 `node Backend/dist/server.js`，PORT=80） | 可运行 TS 骨架 + 新 Dockerfile + build/start 脚本 | ✅ 新入口接口清单 = 新基线（112=112 零 diff）；WS 同端口正常（与根入口一致） |
| **P2 ✅ 已完成（2025）** | 中间件/响应/错误处理收编：errorHandler 挂载到 app（TS 路由经 asyncHandler 抛错统一渲染）；ok/fail 信封与 auth 中间件定型；补单测（node:test + 编译产物） | common 层已挂载；`test:ts` 脚本；单测 16 例 | ✅ 单测覆盖 asyncHandler/errorHandler/response/auth 全绿（16/16）；基线仍 112=112 |
| **P3 域迁移（按价值排序）** | **auth（含 /sys/register 对齐与遗留删除）→ user → article（含 7.6-B 文章/分类删除）→ comment → social/dm（互动通知进 social）→ notification（广播通知独立模块）→ content → system → openapi**。每域步骤：① dao.ts 从 utils/db_* 原样搬运 SQL（遗留函数不搬运）→ ② service.ts 提取规则（对照旧路由逐条）→ ③ controller+routes 替换挂载 → ④ 删除该域旧路由挂载与旧 DAO（文件保留到 P7） | 每域新代码 + 迁移核对单 | 逐端点 curl 对比 status/body 结构一致；该域 7.6 删除项无回归 |
| **P4 事务与鉴权强化** | withTransaction 覆盖 9 节事务场景；归属/权限 helper 替换完各 controller 内的手写逻辑 | service 层单元测试（mock dao/pool） | 事务场景测试通过 |
| **P5 WS/异步收编** | ws 消息处理接入 service；AI summary 异步任务抽象 | infra/ws + agent.service | WS 协议回归（agent 流式/DM/已读） |
| **P6 类型与测试补齐** | 行类型定义（RowDataPacket 映射）、controller/service/dao 单测、契约测试（supertest 打本地实例对比 baseline） | 测试套件 | `npm test` 全绿；覆盖率报告 |
| **P7 清理收尾** | 删除根目录双份代码（routes/*、utils/db_*、server.js、Backend/index.ts、遗留桥）+ 单入口部署 | 单入口、单代码树 | **⏳ 待部署验证通过后执行**（见 §10「P7 状态说明」） |

> 迁移期允许“新老入口并存”运行（老入口 service.js 供回滚，新入口用另一个 PORT 环境变量），同库同数据无风险，因为只读+兼容写。

**P0 执行记录（已完成）**

- 端点变化：**129 → 112**（删除 18、新增 `POST /sys/register`）；两次清单见 `asset/devDocs/api-baseline-before-p0.json`（存档）与 `asset/devDocs/api-baseline.json`（新基线，后续阶段 diff 基准）。
- 整文件删除：`routes/article_category_request.js`、`routes/image_update.js`；`server.js` 挂载 24 → 23。
- 端点级删除（§7.6-B 全部落地）：`/article/getAll`、`/article/getAllByPage`、`/article/getSomeByPageAndCategory`、`/article/detail`(query)、`/article/update`(query)、`/article/delete`(query)、`/article_category/*`（含 set）、`/permission/getAll`、`/permission/update`(POST 重复版)、`/role/getAll`、`/role/updateName`、`/role/addPermission`、`POST /register`。
- 注册路径：`register_request.js` 已改挂 `POST /sys/register`（决策⑤）；前端 Admin/Blog 无需改动。
- 复核结论（§7.6-C）：scripts/test/utils 均无引用；Blog 已构建产物 `dist` 无遗留端点调用信号。
- **偏差记录**：① `GET /`（init_request）**保留**作健康检查出口（云托管可能探测 `/`，保留成本为零）；② `db_curd.js` 中随删除而失活的遗留函数**延后至 P3**（已 grep 确认零外部引用，P3 迁移时不再搬运即可）；③ `Backend/index.ts` 暂未同步（本身不可运行，P1 重建）。
- 冒烟验证（`PORT=7099 node server.js`）：被删端点均 404；`POST /sys/register` 空参返回 `body.code=400`（路由与参数校验生效）；`/article/category/list`、`/role/list` 正常返回（本地 DB 可达）；`GET /` 200。
- 备注：`Blog/index.html` 存在一条工作区既有改动（title 文案“JScreator Blog”→“JS creator Blog”），非本次 P0 修改；`asset/devDocs` 在 `.gitignore`（规则 `devDocs`）内，两份基线文件仅存本地，如需入库请调整忽略规则。

**P1 执行记录（已完成）**

- 新增 TS 源码（`Backend/src`）：
  - `server.ts` 入口 —— 装配 + `http.Server` 承载 WS 同端口；调试用 `DUMP_BASELINE=<路径>` 导出接口清单后退出（不监听）；
  - `app.ts` 装配 —— CORS 白名单/json/urlencoded/统计中间件/legacy 路由/registerRoutes，顺序与根 server.js 完全一致；
  - `legacy.ts` CJS 桥 —— 模块顶层先 `dotenv.config()` 再提供 23 个 legacy 路由挂载与 api_monitor/ws_server/token_creator 桥（保证 env 先于连接池创建就位）；P3/P5/P7 逐步拆除；
  - `config/env.ts`（CORS 白名单）；`common/errors.ts`（AppError/asyncHandler/errorHandler）、`common/response.ts`（ok/fail）、`common/middleware/auth.ts`（verifyToken/requireRole，语义对齐根 authMiddleware，P3 起供 TS 路由使用）。
- 配置：`Backend/tsconfig.json` 增加 rootDir/outDir/include/esModuleInterop（strict/verbatimModuleSyntax/nodenext 保留）；`Backend/package.json` 收敛为最小清单（type: module、engines node>=20），依赖统一由根 package.json 管理。
- 根 package.json：新增 `ts:build`（tsc -p Backend）、`start:ts`、`watch:ts`；devDependencies 增加 typescript、@types/express@4、@types/cors、@types/node（@types/express 与运行时 express4 对齐）。
- Dockerfile：两段式 TS 构建（见上表），运行入口 `node Backend/dist/server.js`。
- 验证：`tsc` 零错误编译；`DUMP_BASELINE` 导出 112 端点与根基线 `api-baseline.json` **双向零 diff**；`PORT=7098 node Backend/dist/server.js` 冒烟：`/` 200、被删接口 404、`/sys/register` 空参 body.code=400、`/role/list`、`/article/category/list` 200（真实 DB）；WS `/ws?token=` 握手 connected + ping→pong，与根入口（7097）行为一致。
- 运行说明：新入口 `npm run start:ts`；旧入口 `npm run dev`（回滚通道）；`Backend/dist` 为构建产物（`.gitignore` 含 `dist`，不入库）；docker build 的 build 阶段需要可访问 npm registry。

**P2 执行记录（已完成）**

- app.ts 末尾挂载 `common/errors.ts` 的 `errorHandler`（P2 收编第一步）：TS 路由经 asyncHandler 抛错统一渲染 `{code, success, message}`；legacy 路由自带 try/catch 且不调 next(err)，行为不受影响（实测未匹配路由仍走 Express 默认 404）。
- 单测（node:test 内置于 Node，跑编译产物，零新增测试依赖）：
  - `Backend/src/common/errors.test.ts` —— AppError / asyncHandler（异常转发 next、正常放行）/ errorHandler（AppError→code/message、未知错误→500、headersSent→透传）；
  - `Backend/src/common/response.test.ts` —— ok(data)/ok()无 data 省略字段/自定义 message/fail 状态码；
  - `Backend/src/common/middleware/auth.test.ts` —— verifyToken（合法/Bearer 前缀/非法 401/缺失 401）、requireRole（越权 403/命中放行）；注入固定 `JWT_SECRET` 保证自洽（tokenValidator 每次调用惰性读 env）。
- 脚本：根 package.json 新增 `test:ts`（tsc -p Backend && node --test 三个用例文件）。
- 验证：单测 **16/16 全绿**；挂载 errorHandler 后接口清单仍 112=112 零 diff；`PORT=7096` 冒烟：未匹配路径默认 404、`/sys/register` 空参 code=400、`/role/list` 真实 DB 数据 200。

**P3 执行记录（进行中：auth 域 子流程 1/5 —— /sys/login + /sys/register）**

- 新增 TS 三层：
  - `modules/user/user.dao.ts` —— user 表参数化 SQL（findByEmail/findByUsername/existsByEmail/existsByUsername/insertUser），SQL 原样搬运自 db_curd 的 login_loginBy*/register_*；
  - `modules/auth/auth.service.ts` —— 业务规则：查重/哈希/落库/发 token；**密码哈希与 ID 生成不重写**，桥接既有 crypto_password（SHA256 兼容存量哈希）与 id_creator；
  - `modules/auth/auth.controller.ts` —— 响应体**逐字段对齐 legacy**（含怪癖：注册校验失败 HTTP200+body.code=400、用户名登录 catch HTTP200+body.code=500、邮箱登录 catch 无 code；vipLevel=name）；
  - `modules/auth/auth.routes.ts` + `index.ts`（组装工厂）；`db/pool.ts`（TS 侧连接池，参数同 connect_db）；
- legacy.ts：LEGACY_ROUTES 摘除 login_request/register_request（23→21），新增 crypto/id/token 桥；
- app.ts：`app.use(createAuthRouter())` 置于 legacy 挂载前。
- 验证：编译零错误；接口清单仍 **112=112 零 diff**；单测 16/16 全绿；**双入口等价**（legacy 7094 vs TS 7095，7/7 用例 status+body 逐字节一致）：注册空参/邮箱重复/用户名重复/email 占位模式、登录空参/用户名错误/邮箱错误（后 4 例走真实 DB 只读路径）。
- 注意：routes/login_request.js、register_request.js **保留**（根 legacy 入口回滚通道，P7 再删）。
- 子流程 2-5 完成记录：
  - **email（/email/send-code、/email/login）**：`modules/auth/email/*`；内存验证码（5 分钟 TTL）与服务生命周期一致；SMTP 走既有 utils/emailSender（内部吞错语义保留）；自动注册复用 user.dao.registerEmailUser。
  - **totp（/totp/setup|confirm|disable|status|login）**：`modules/auth/totp/*`；otplib 走根依赖（authenticator 本地 require）；secret 确认后才入库；响应怪癖保留（ok() 恒带 data、confirm/disable 传 data:null）；绑定类端点统一走 common verifyToken。
  - **github（/auth/github、/auth/github/bind、/auth/github/callback）**：`modules/auth/github/*`；302 重定向流为"非 JSON 特例"；axios 复用根依赖（与 legacy 同库）；绑定/自动注册走 user.dao（getByGithubId/registerGithubUser/setGithubId）；asyncHandler 已兼容同步 handler（Promise.resolve 包裹）。
  - **oauth（/oauth/admin/clients*、/oauth/authorize、/oauth/token）**：`modules/oauth/*`（独立模块，自持 oauth_client/oauth_code DAO）；PKCE（S256）、timingSafeEqual（长度不一致抛错→500 的怪癖保留）、oauth-access JWT 均内化到 service；管理端守卫 = common verifyToken + 查库 role_id=1。
  - legacy.ts 挂载 17 个模块（已摘 login/register/email/totp/github/oauth）；app.ts 依次挂载 5 组 TS 路由。
- 验证（auth 域全量）：接口清单仍 **112=112 零 diff**；单测 16/16；**双入口等价 22/22**（email 校验路径、totp 全端点无副作用路径（admin 真实 token）、github 全部 302 分支（Location 逐字一致）、oauth 管理列表/authorize 400 文本/未登录跳转/token 失败与客户端凭证（随机字段归一化后比对））。
- 说明：email 成功发送与验证码成功登录、github callback 带 code（触网）、oauth 授权码签发（写 oauth_code）需外部服务或写库，未做黑盒对比，等价性由校验/失败路径 + 逐行移植保证；相关 legacy utils（emailSender/otplib/axios 依赖、db_oauth 等）保留至 P7 清理。
- **user 域完成记录（/sys/profile、/userInfo、/userInfo/unbind-github、/resetPassword、/user-manage/* 13 端点）**：
  - `modules/user/user.dao.ts` 增补：profileRows（角色/权限 join，参数化）、getUserStats、listPage（真分页+关键字）、getDetailById（LEFT JOIN role、JSON 列防御 parse）、addUser/deleteById/deleteBatchByIds、updateProfile（动态 SET + socials/featured 序列化）、setPasswordHash、clearGithubId；
  - `modules/user/user.service.ts`（profile 组装与统计兜底 0、canEditTarget 本人/管理员、查重+新增等）；`user.controller.ts` 响应逐字段对齐（含 /sys/profile 无 token 也返回 HTTP200+code500 文案的怪癖）；`user.routes.ts` 守卫对齐（user-manage 管理端 adminOnly、detail 仅登录、userInfo 服务内权限）；
  - `adminOnly` 守卫从 oauth.routes 上移到 `common/middleware/auth.ts` 复用；
  - legacy.ts 挂载收敛到 16 个模块。
  - 验证：接口清单 112=112 零 diff；单测 16/16；双入口等价 **17/17**（profile 有效/无 token、userInfo 本人 200 与跨用户 403、resetPassword 缺参、list/detail/add/update/reset/delete/delete-batch 的校验与 403/无写入分支、含非管理员 user1 越权路径）。
- **api_key/openapi 域完成记录（/api-keys* + /api/v1/*）**：
  - `modules/openapi/apiKey.dao.ts`：api_key 表纯 TS 化（SHA256 存 hash+prefix、sk_ 明文仅生成一次、verify 时异步刷新 last_used_at 不阻塞）；
  - `modules/openapi/apiKey.service.ts`（write 权限仅 role 1/3 可建 → 否则 403 文案一致）、`openApi.service.ts`（/api/v1 业务）、`openapi.controller.ts`、`openapi.routes.ts`（requireApiKey/requireScope 中间件在 TS 内实现，401/403 文案对齐）；
  - `/api/v1/*` 依赖的 article/blog_profile/ai_summary 数据层**暂桥接 legacy utils**（legacy.ts 新增 loadArticleUtils/loadBlogProfileUtils/loadAiSummaryUtils），article 域迁移后切换 TS DAO（已在注释标注）；
  - legacy.ts 挂载收敛到 **14 个模块**（已摘 api_key_request/open_api）。
  - 验证：接口清单 112=112 零 diff；单测 16/16；双入口等价 **10/10**（401 各分支、普通用户列表/越权 write 403（未写库）、不存在 key 的 status/delete 幂等路径）。
  - 说明：已授权读取与 scope=write 真实 403 需要真实明文 key（避免建 key 写库），留待集成环境验证；requireScope 逻辑逐行对齐 legacy。
- **article 域完成记录（文章/分类/归档/我的文章/AI 总结，14 端点）**：
  - `modules/article/article.dao.ts`：article / article_category / articleandcategory_middle 全量参数化 SQL（db_article.js + db_curd 分类函数逐行搬运），含行整形（GROUP_CONCAT→数组、like/favorite 计数、ai_summary JSON 防御 parse、中间表去重）；
  - `modules/article/article.service.ts`：可见性（未发布仅作者/admin-editor）、归属/权限（role_name 判断 admin/editor，兼容两套编号）、分类归属更新/删除分支、发布时异步 AI 总结触发；
  - `article.controller.ts`/`article.routes.ts`（detail 可选登录解析、写操作 verifyToken）、`index.ts`；
  - openapi 的 article 数据层**切换为 TS DAO**（移除 loadArticleUtils 桥）；legacy.ts 挂载收敛到 **13 个模块**。
  - 验证：接口清单 112=112 零 diff；单测 16/16；双入口等价 **26/26**（公开读含真实 DB 详情、401/400/403/404 全分支、普通用户越权改他人文章 403、无写入校验路径）。
  - 说明：真实“发布/更新为已发布”会触发 OpenAI AI 总结（外部副作用），等价验证用校验/越权/不存在分支规避；AI 生成路径逻辑逐行对齐 legacy。
- **blog_profile 域完成记录（/blog/* 5 端点）**：
  - `modules/blog/blogProfile.dao.ts`：用户公开信息（JSON 列防御 parse）+ 按 id/按 username 文章分页 + 有文章用户列表 + 最新/热议流（SQL 与行整形逐行搬运 db_blog_profile.js）；
  - `modules/blog/blogProfile.service.ts`：主页聚合（featured 精选优先，否则最新；all_total 兜底）、用户文章 404 语义；
  - `blogProfile.controller.ts`/`blogProfile.routes.ts`（全部公开读）/`index.ts`；
  - openapi 的 `getUserPublicByUsername` **切换为 TS DAO**（移除 loadBlogProfileUtils 桥，唯一遗留桥只剩 ai_summary）。
  - 验证：接口清单 112=112 零 diff；单测 16/16；双入口等价 **13/13**（users/feed/hot/profile/articles 默认与筛选、不存在用户 404，走真实 DB）。
- **comment 域完成记录（/comment/* 5 端点）**：
  - `modules/comment/comment.dao.ts`：评论 SQL + **树形组装**（顶层分页、children 嵌套、楼中楼 maxChildren=50、is_author、display_name 覆盖昵称）逐行搬运 db_comment.js；
  - `comment.service.ts`：创建校验序列与文案完全对齐 legacy（文章存在 404 → 父评论同文校验 → 匿名需昵称 → 内容防垃圾 4 条 → 匿名昵称 2-20/非纯数字），管理列表/更新/级联删除（含"级联计数含自身"怪癖）。
- **social 域完成记录（/social/* 15 端点）**：
  - `modules/social/social.dao.ts`：follow/article_like/article_favorite/user_notification 全量参数化 SQL（db_social.js 逐行搬运）；
  - `social.service.ts`：关注 toggle（自关注 400/不存在 404/成功发通知）、点赞/收藏 toggle + 通知作者（'点赞/收藏了你的文章 #id'）、status 批量（**无 message 字段**的怪癖）、互动通知分页/未读/单条/全部已读、管理列表与删除；
  - 守卫说明：social legacy 的 requireAdmin 校验 **token 内 role_id 声明**，TS 统一走 common adminOnly（**查库**，更严谨，与 user/oauth 一致）；真实登录 token 携带 role_id，行为等价（已在驱动中用带 role_id 的 token 验证）。
- **dm 域完成记录（/dm/* 4 端点，REST 侧）**：
  - `modules/dm/dm.dao.ts`：会话列表（GREATEST/LEAST 聚合+未读数子查询）、历史消息翻页倒序→正序、未读总数、标记已读（db_message.js 逐行搬运）；
  - 说明：msgSend 属 WebSocket 写路径，仍由 legacy utils/ws_server 使用（P5 收编 WS 时切换）。
  - legacy.ts 挂载收敛到 **9 个模块**。
  - 验证（三域合并）：接口清单 112=112 零 diff；单测 16/16；双入口等价 **39/39**（comment 校验/管理分支、social 关注/点赞收藏只读与 404/400/401/403、通知与管理端、dm 会话/历史/未读/已读，含真实 DB 数据）。
  - 说明：点赞/收藏/关注的"成功写入"路径为写操作且含通知副作用，验证用只读与前置校验分支规避；toggle 逻辑逐行对齐 legacy。
- **P4 执行记录（事务与鉴权强化）**
  - `db/transaction.ts`：withTransaction（begin → fn(conn) → commit；异常 rollback；finally release）+ 单测（提交/回滚/释放顺序、commit 失败回滚）。
  - 事务场景落地：article.dao add（文章+分类中间表）/update（分类整体替换）/remove（评论清理+删文）、comment.dao deleteCascade（子树收集+删除）、oauth.dao consumeCode（查码+标记已用）——SQL 不变，仅收拢到事务连接；rbac.setRolePermission 此前已事务化。
  - 分层审计：grep 确认 `pool` 直连仅出现在 `*.dao.ts`（+ systemmon 的 db 健康检查，对齐 legacy 语义）；controller/service 零直连。
  - errorHandler 增强：带 status 的框架错误（如 body-parser 400 JSON 解析失败）沿用其状态码，不再一律 500（记录为有意的行为偏差：JSON 400 vs legacy HTML 400）。
  - service 层单测（mock dao/deps，不碰 DB）：AuthService 注册查重/登录分支、ArticleService 可见性/归属权限/分类 admin-editor/AI 总结触发、withTransaction —— 单测总数 **16 → 30，全部通过**；`test:ts` 自动覆盖全部新增。
- **P5 执行记录（WS/异步收编）**
  - `infra/ws/ws.server.ts`：WebSocket 协议层从 utils/ws_server.js 逐行移植（/ws、query token 校验、connected、ping/pong、agent 流式、dm/dm_read），业务全部经 `WsHandlers` 注入 services；
  - `modules/agent/agent.service.ts`：资料编辑/文章优化 Agent 从 utils/agent.js 服务化（prompt/JSON 解析/兜底文案逐字保留），LLM 走 utils/llm.js 桥，用户/文章读写走 user.dao/article.dao；
  - dm.dao/service 增补 `send`（msgSend 语义：content 截断 2000）——WS 发消息不再依赖 legacy db_message；
  - `server.ts` 启动改为 TS WS：agent/dm/userExists/markRead 各 handlers 注入；`utils/ws_server.js` 不再被 TS 入口使用（根 legacy 入口仍保留供回滚）。
  - 验证：接口清单 112=112 零 diff；单测 30/30；**WS 协议双入口等价 8/8**（未授权/坏 token、connected+ping、dm 给自己/对方不存在、dm_read ack、agent 空内容、未知消息类型）。
  - 说明：agent 成功调用 LLM 与真实 dm 发送为外部副作用路径，未做黑盒对比；由协议与校验路径 + 逐行移植保证。
- **P6 执行记录（契约测试）**  - `Backend/src/contract.test.ts`：启动 buildApp（不监听）→ 断言 `registerRoutes` 扫描出的路径集与 `asset/devDocs/api-baseline.json` **逐项一致**（数量 + 排序），任何路由改动偏离契约立即红灯；纳入 `npm run test:ts`（`--test-force-exit` 规避依赖模块持有句柄导致进程不退出）。
  - 验证：单测 **31/31** 全绿（含契约用例）。
- **部署验证记录（Dockerfile 两段式，本地完整模拟）**
  - 本机无 Docker，按 Dockerfile 语义在暂存目录复刻：`npm ci`（280 包）→ `npm run ts:build` → `npm prune --omit=dev`（typescript 等 17 个 dev 包被清、runtime 依赖保留、`Backend/dist/server.js` 就绪）→ 运行阶段以裁剪依赖启动。
  - 冒烟全过：`GET /` 200、`/role/list`、`/article/list`、`/blog/profile/*` 200（真实 DB）、`/system-monitor` 无 token 401、**WS /ws ping→pong 正常**。
  - **云侧仍需你确认/配置**：① 云托管是否支持自定义 Dockerfile 构建阶段；② 环境变量注入（DB_HOST/PORT/USER/PASSWORD/NAME、JWT_SECRET、GITHUB_CLIENT_ID/SECRET/CALLBACK_URL、FRONTEND_URL、SMTP_*、FROM_EMAIL、OSS_*、DEEPSEEK_API_KEY/BASE_URL/MODEL）；③ 正式域名加入 CORS 白名单（config/env.ts）与 GitHub OAuth 回调；④ PORT=80 监听由 ENV 提供。
- **P7 状态说明（待部署验证后执行）**
  - 目标：删除根目录双份代码（`routes/*`、`utils/db_*` 等被 TS DAO 取代的文件、`server.js`、`Backend/index.ts` 旧 stub、遗留桥清理），收敛单入口 `node Backend/dist/server.js`。
  - **暂缓原因**：根 `server.js`/`routes`/`utils`/`test`/`scripts` 仍是回滚通道与 dev 测试/脚本的依赖（根 npm test、db:* 脚本、export_api_baseline 解析 server.js）；删除应在「新 Dockerfile 部署验证通过、跑一段时间无回退需求」后一次性执行，并同步更新 test/scripts/README（删除清单见 §7.6/§10 各域记录，均以 git 历史可追溯）。
- **system 域收尾记录（role/permission、notification 广播、ad/announcement/upload、system-monitor/init、backup 共 9 个 legacy 模块）**：
  - `modules/rbac`（role+permission：list 在 legacy 中为**公开**，等价保留；管理操作 adminOnly；setPermission 事务化）；
  - `modules/notification`（平台广播：add/list/unread/read/update/delete，admin 文案专用守卫）；
  - `modules/content`（ad/announcement SQL + upload：multer 内存存储→OSS 桥、类型白名单、5MB 限制与 MulterError 中间件）；
  - `modules/systemmon`（/system-monitor + api-stats + GET / 健康检查：CPU 采样缓存、os/db 信息、admin 守卫文案专用）；
  - `modules/backup`（mysqldump→zip 流式下载，逻辑含 DROP/外键兼容改写逐行对齐）；
  - **legacy.ts LEGACY_ROUTES 已清空**：TS 入口不再挂载任何 legacy 路由（registerRoutes 扫描的 112 路径全部来自 TS 模块）。
  - 验证：接口清单 112=112 零 diff；单测 16/16；双入口等价 **50/50**（含真实 DB 读、401/400/403/404、无写入操作、monitor 键形状、api-stats 覆盖基线 112 路径集）。
  - 说明：backup 成功路径会执行真实 mysqldump（重/含库数据），driver 仅覆盖 401/403 守卫分支；`/system-monitor/api-stats` 为各进程内存统计，跨进程比对改为"各自覆盖基线路径集"断言。

---

## 11. 风险与注意点

1. **行为回归**：最大风险。对策：P0 契约基线 + 每域 diff + 前端冒烟；**“顺手统一”是禁忌**（401 vs 404 语义、数字转字符串、默认分页值等细节必须原样保留）。
2. **Express4 异步异常**：async handler 抛错不会自动进错误中间件 —— 所有 controller 必须经 `asyncHandler` 包装（或在升级 Express5 后天然支持，但升级本身是独立风险项，不建议混入本改造）。
3. **registerRoutes 顺序**：若新骨架阶段先挂载部分路由就调用 registerRoutes，统计清单会缺接口；务必保持“全部挂载 → registerRoutes”。
4. **双份代码**：当前 `server.js` 与 `Backend/index.ts` 已经是两份拷贝（后者还不可运行）。迁移期间**禁止**继续复制文件，一律“移动/搬运”；P7 必须收敛到单入口。
5. **TS 化与部署链路（已决策）**：新代码统一 TS（`type: module` + `moduleResolution: nodenext`），`package.json` 增加 `build: tsc`、`start: node dist/server.js`、`dev: tsx watch`；**Dockerfile 两段式**：build 阶段 `npm ci && npm run build`，运行阶段只装 production 依赖并 `node dist/server.js`（基础镜像建议 `node:20-alpine`，需在云托管控制台确认是否支持自定义 Dockerfile 构建阶段与 Node 版本）；依赖归类修正（mysql2/express 等从 devDependencies 移入 dependencies）；`@types/express` 对齐运行时 express 4（或独立决策升级 express 5）。
6. **CJS/ESM 边界**：根目录是 CJS；新代码建议 `type: module` 纯 ESM，legacy 阶段用动态 `import()` 或 CJS 桥接，避免 tsconfig/运行时双标准打架。
7. **WS 与进程模型**：内存版 API 统计与 WS 在线表都是**单进程内存**状态，迁移不改此模型；若未来多实例部署需外置存储，属独立课题。

---

## 12. 决策清单与剩余待确认项

**已锁定（见 §0.5）**：① 绑定 TypeScript；② Dockerfile 改 TS 两段式构建；③ 无调用接口删除（清单 §7.6）；④ 两套通知非同一业务、分别保留（§7.7）；⑤ 注册统一为 `POST /sys/register`（删除裸 `/register`）。

**仍待你确认 / 下一步**：
- **P5 已完成**（WS/agent 收编，见 §10 P5 执行记录）—— TS 入口不再有运行时 legacy 依赖。后续可选：① **P6/P7 收尾**（行类型补全、契约测试、删除根目录 routes/utils 双份代码与 utils/ws_server 等遗留桥、单入口部署）；② 先做**部署验证**（Dockerfile 两段式上线）。
- 部署侧：云托管控制台是否支持自定义 Dockerfile 的构建阶段？（决定 Dockerfile 能否直接上线；若限制为“仅运行命令”则需改用云端构建 TS 的替代方案）

---

## 13. 里程碑与验收（粗粒度）

| 里程碑 | 关键验收 |
|---|---|
| M1：P0 ✅ 已完成 | 7.6 删除清单全部落地；`/sys/register` 注册链路打通；删除后 api-baseline.json 存档（129→112，diff 见 §10 P0 执行记录） |
| M2：P1 ✅ 已完成 | 新入口（npm run start:ts）可启动；接口清单 112 = 基线零 diff；WS /ws 同端口正常（含 token 鉴权握手）；两段式 Dockerfile 就绪 |
| M3：P3 完成（全部域） | 逐端点 diff 全绿；`system-monitor` 清单一致；三前端手工冒烟通过 |
| M4：P5–P6 ✅ 已完成 | 单测/契约测试进 test:ts（31 用例）；WS 协议回归通过（8/8 双入口等价） |
| M5：P7 完成 | ⏳ 待部署验证：单入口部署后删除根目录双份代码，旧文件零引用（grep 校验），全量回归通过 |

---

*（本文档随代码演化更新；每完成一个阶段，在对应行勾选并记录 diff 结果。）*
