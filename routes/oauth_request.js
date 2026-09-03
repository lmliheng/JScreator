const express = require('express')
const router = express.Router()
const { pool } = require('../utils/connect_db')
const { tokenValidator } = require('../utils/token_creator')
const {
    oauthClientCreate,
    oauthClientUpdate,
    oauthClientList,
    oauthClientGetByClientId,
    oauthClientSetStatus,
    oauthClientDelete,
    oauthCodeCreate,
    oauthCodeConsume,
    pkceVerify,
    issueAccessToken,
} = require('../utils/db_oauth')

/**
 * OAuth 2.0 授权服务器
 *
 * 授权码 + PKCE（第三方 Web/移动端登录）：
 *   GET  /oauth/authorize?client_id=..&redirect_uri=..&code_challenge=..&state=..
 *        → 未登录跳登录页；已登录返回确认页（HTML）或 302（若已批准）
 *   POST /oauth/authorize/confirm  用户同意 → 302 redirect_uri?code=..&state=..
 *   POST /oauth/token  grant_type=authorization_code + code + code_verifier → access_token
 *
 * Client Credentials（机器对机器）：
 *   POST /oauth/token  grant_type=client_credentials + client_id + client_secret → access_token
 *
 * 管理端（仅 admin）：
 *   GET/POST/PUT/DELETE /oauth/admin/clients...
 */

const fail = (res, code, message, error) => res.status(code).json({ code, success: false, message, error })

const requireAdmin = async (req, res) => {
    const token = req.headers.authorization || ''
    const decoded = await tokenValidator(token)
    if (!decoded || typeof decoded !== 'object' || decoded.id == undefined) {
        fail(res, 401, '未登录或登录过期')
        return null
    }
    const [rows] = await pool.query('SELECT role_id FROM user WHERE id = ?', [decoded.id])
    if (Number(rows[0]?.role_id) !== 1) {
        fail(res, 403, '权限不足，仅管理员可操作')
        return null
    }
    return decoded
}

// 检查回调 URI 是否在客户端白名单
function isAllowedRedirect(client, uri) {
    const allowed = String(client.redirect_uris || '').split(',').map((s) => s.trim()).filter(Boolean)
    return allowed.includes(uri)
}

// ================= 管理端 =================

// 客户端列表
router.get('/oauth/admin/clients', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (!admin) return
    try {
        const list = await oauthClientList()
        res.json({ code: 200, success: true, message: '获取成功', data: { list } })
    } catch (e) {
        console.error('OAuth client list 错误:', e)
        fail(res, 500, '获取失败')
    }
})

// 创建客户端
router.post('/oauth/admin/clients', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (!admin) return
    const { name, description, redirect_uris, scopes, grant_types, logo } = req.body
    if (!name) return fail(res, 400, '应用名称不能为空')
    if (String(grant_types || '').includes('authorization_code') && !redirect_uris) {
        return fail(res, 400, '授权码模式需要填写回调 URI')
    }
    try {
        const result = await oauthClientCreate({
            name, description, redirect_uris, scopes, grant_types, logo,
        })
        res.json({
            code: 200, success: true, message: '创建成功',
            data: {
                ...result,
                // secret 明文只返回一次
                note: result.client_secret ? 'client_secret 只显示这一次，请妥善保存' : undefined,
            },
        })
    } catch (e) {
        console.error('OAuth client create 错误:', e)
        fail(res, 500, '创建失败')
    }
})

// 更新客户端
router.put('/oauth/admin/clients/:id', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (!admin) return
    const id = Number(req.params.id)
    const { name, description, redirect_uris, scopes, grant_types, logo } = req.body
    if (!id || !name) return fail(res, 400, '参数缺失')
    try {
        await oauthClientUpdate(id, { name, description, redirect_uris, scopes, grant_types, logo })
        res.json({ code: 200, success: true, message: '更新成功' })
    } catch (e) {
        console.error('OAuth client update 错误:', e)
        fail(res, 500, '更新失败')
    }
})

// 启停
router.put('/oauth/admin/clients/:id/status', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (!admin) return
    const { status } = req.body
    try {
        await oauthClientSetStatus(req.params.id, status)
        res.json({ code: 200, success: true, message: '操作成功' })
    } catch (e) {
        fail(res, 500, '操作失败')
    }
})

// 删除
router.delete('/oauth/admin/clients/:id', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (!admin) return
    try {
        await oauthClientDelete(req.params.id)
        res.json({ code: 200, success: true, message: '删除成功' })
    } catch (e) {
        fail(res, 500, '删除失败')
    }
})

// ================= 授权端点 =================

// GET /oauth/authorize —— 授权码流程发起
// 支持两种：浏览器访问（302 到登录/确认页）或 API 判断
router.get('/oauth/authorize', async (req, res) => {
    const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state, scope } = req.query

    // 基础校验
    if (!client_id || !redirect_uri) {
        return res.status(400).send('参数缺失：需要 client_id 与 redirect_uri')
    }
    const client = await oauthClientGetByClientId(String(client_id))
    if (!client || Number(client.status) !== 1) {
        return res.status(400).send('无效的客户端')
    }
    if (!isAllowedRedirect(client, String(redirect_uri))) {
        return res.status(400).send('redirect_uri 不在白名单')
    }
    if (response_type !== 'code') {
        return res.status(400).send('仅支持 response_type=code')
    }

    // 未登录 → 跳转登录页（带回 redirect）
    const token = req.headers.authorization || (req.cookies && req.cookies.token) || ''
    const decoded = token ? await tokenValidator(token) : null
    if (!decoded || decoded.id == undefined) {
        // 无 cookie 支持 → 浏览器场景要求登录；返回带登录跳转的 HTML
        const loginUrl = `/login?redirect=${encodeURIComponent(`/oauth/authorize?${new URLSearchParams(req.query).toString()}`)}`
        return res.redirect(loginUrl)
    }

    // 已登录：直接签发授权码并 302 回调用方（简化确认流程：无独立确认页）
    const authorizeParams = new URLSearchParams(req.query)
    const code = await oauthCodeCreate(
        client.client_id,
        decoded.id,
        String(scope || 'read'),
        code_challenge ? String(code_challenge) : null,
        String(redirect_uri)
    )
    const cb = new URL(String(redirect_uri))
    cb.searchParams.set('code', code)
    if (state) cb.searchParams.set('state', String(state))
    res.redirect(cb.toString())
})

// ================= Token 端点 =================

router.post('/oauth/token', async (req, res) => {
    const { grant_type } = req.body
    try {
        if (grant_type === 'authorization_code') {
            // 授权码 + PKCE 换 token
            const { code, code_verifier, client_id, redirect_uri } = req.body
            if (!code) return fail(res, 400, '缺少授权码', 'invalid_request')
            const consumed = await oauthCodeConsume(String(code))
            if (!consumed) return fail(res, 400, '授权码无效', 'invalid_grant')
            if (consumed.error) return fail(res, 400, consumed.message, consumed.error)

            const rec = consumed.code
            // client 校验
            const client = await oauthClientGetByClientId(rec.client_id)
            if (!client || Number(client.status) !== 1) return fail(res, 400, '无效的客户端', 'invalid_client')

            // PKCE 校验：授权时有 challenge，则必须提供 verifier
            if (rec.code_challenge) {
                if (!pkceVerify(String(code_verifier || ''), rec.code_challenge)) {
                    return fail(res, 400, 'PKCE 校验失败', 'invalid_grant')
                }
            }
            const accessToken = issueAccessToken({
                user_id: Number(rec.user_id),
                client_id: client.client_id,
                scope: rec.scope || 'read',
            })
            return res.json({
                access_token: accessToken,
                token_type: 'Bearer',
                expires_in: 3600,
                scope: rec.scope || 'read',
            })
        }

        if (grant_type === 'client_credentials') {
            // 客户端凭证模式
            const { client_id, client_secret } = req.body
            if (!client_id || !client_secret) return fail(res, 400, '缺少客户端凭证', 'invalid_client')
            const client = await oauthClientGetByClientId(String(client_id))
            if (!client || Number(client.status) !== 1 || !client.client_secret) {
                return fail(res, 401, '无效的客户端', 'invalid_client')
            }
            // 常量时间比较 secret
            const ok = require('crypto').timingSafeEqual(
                Buffer.from(String(client_secret)),
                Buffer.from(client.client_secret)
            )
            if (!ok) return fail(res, 401, '客户端密钥错误', 'invalid_client')
            const accessToken = issueAccessToken({
                user_id: null,
                client_id: client.client_id,
                scope: client.scopes || 'read',
                type: 'client_credentials',
            })
            return res.json({
                access_token: accessToken,
                token_type: 'Bearer',
                expires_in: 3600,
                scope: client.scopes || 'read',
            })
        }

        fail(res, 400, '不支持的 grant_type', 'unsupported_grant_type')
    } catch (e) {
        console.error('OAuth token 错误:', e)
        fail(res, 500, '服务器内部错误')
    }
})

module.exports = router
