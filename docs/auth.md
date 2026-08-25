# 认证鉴权文档（Auth）

## 统一响应格式

成功：

```json
{ "code": 200, "success": true, "message": "ok", "data": {} }
```

失败：

```json
{ "code": 401, "success": false, "message": "未登录或登录过期" }
```

## 登录 / 注册

- `POST /sys/login`：body `{ username, password }` 或 `{ email, password }`，密码为明文（后端用 SHA256 与库中哈希比对）。成功返回 `token` + `user_info`。
- `POST /sys/register`：注册新用户，密码用 `ToHash`（SHA256）存储，默认 `role_id = 2`。

## Token 结构

JWT（HS256），签名密钥 `process.env.JWT_SECRET`（兜底 `'test'`）。payload：

```json
{ "id": 1, "role_id": 2, "iat": ..., "exp": ... }
```

有效期 7 天。前端请求头格式：`Authorization: Bearer <token>`。

## 鉴权中间件（utils/authMiddleware.js）

### verifyToken

```js
router.get('/xxx', verifyToken, async (req, res) => {
  // req.user = { id, role_id, iat, exp }
})
```

解析 `Authorization: Bearer <token>`，成功挂 `req.user`，失败返回 401。

### requireRole

```js
// 只允许 admin(1) 和 editor(3)
router.post('/xxx', verifyToken, requireRole(1, 3), async (req, res) => { ... })
```

校验 `req.user.role_id` 是否在允许列表，无权限返回 403。

## token_creator.js 关键函数

- `tokenCreator(user)`：签入 `id` 和 `role_id`，生成 token。
- `tokenValidator(token)`：自动去掉 `Bearer ` 前缀，验证成功返回 decoded，失败返回 `null`。

## 角色权限映射

| role_id | 角色 | 说明 |
|---------|------|------|
| 1 | admin | 全部权限 |
| 2 | user | 自己的文章/评论/资料 |
| 3 | editor | 管理所有文章 |
