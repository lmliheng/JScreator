## JS create

目前是一个不成熟的应用，您可以访问它：lmliheng.github.io/lmliheng(26/9/11服务下架)

单一关系型数据库的*中型后端-单体服务*（采用路由，服务，数据三层结构，通用服务在common目录），多个前台应用。
OSS采用阿里oss，邮箱服务采用emailsender，连接mysql8使用mysql2连接池。

*后续跟进*: 
P0 sentry前端监控，后台页面优化
P1 接口优化(接口命名按服务命名),Agent功能优化,改用ORM,Zod。
P3 数据库监控，QPS监控(交给服务商)


## 参考代码模式

#### Controller/Service/Dao
```ts
// modules/article/article.dao.ts
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

// modules/article/article.controller.ts
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

#### 统一错误处理
代替try...catch

```ts
class AppError extends Error { constructor(public code: number, message: string) { super(message) } }
// service 抛 AppError(404,'文章不存在')；errorHandler 统一输出 { code, success:false, message }
// asyncHandler：包一层 catch(next)，规避 Express4 异步异常不进入错误中间件的问题
```

#### 归属校验


```ts
// service 内统一实现，替代 comment_request 手写的 requireAdmin、article_request 的 isAdminOrEditor
async assertAdmin(viewer) { /* role_id===1，否则 AppError(403) */ }
async assertArticleOwnerOrAdmin(viewer, article) { … }
```

#### 事务助手（跨 DAO 写操作在 Service 内包事务）

```ts
export async function withTransaction<T>(pool: Pool, fn: (conn: Connection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const r = await fn(conn); await conn.commit(); return r; }
  catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}
// dao.add(..., conn) 内部使用 conn 而非 pool —— 这是“DAO 参与事务”的唯一通道
```
