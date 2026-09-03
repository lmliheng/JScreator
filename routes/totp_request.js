const express = require('express')
const router = express.Router()
const { authenticator } = require('otplib')
const { pool } = require('../utils/connect_db')
const { tokenCreator } = require('../utils/token_creator')

/**
 * TOTP（Google Authenticator 等）登录与绑定
 *
 * 1. POST /totp/setup           登录用户开启 TOTP → 返回 secret + otpauth:// URI（用于扫码）
 * 2. POST /totp/confirm         验证刚才的 6 位码并确认绑定（成功后 secret 入库）
 * 3. POST /totp/disable         解绑（需验证当前 6 位码）
 * 4. GET  /totp/status          查询当前用户是否已绑定 TOTP
 * 5. POST /totp/login           账号（用户名/邮箱）+ 6 位动态码登录（未设密码的邮箱用户也可用）
 *    body: { account, code }
 */

const fail = (res, code, message) => res.status(code).json({ code, success: false, message })
const ok = (res, data = {}, message = 'ok') => res.json({ code: 200, success: true, message, data })

// 登录态解析（绑定/解绑/状态用）
const requireLogin = async (req) => {
    const token = req.headers.authorization || ''
    const decoded = await (async () => {
        try {
            const jwt = require('jsonwebtoken')
            const t = token.startsWith('Bearer ') ? token.slice(7) : token
            return jwt.verify(t, process.env.JWT_SECRET || 'test')
        } catch (e) {
            return null
        }
    })()
    return decoded
}

// ===== 1. 开启绑定：生成 secret 并返回 otpauth URI（尚未入库） =====
router.post('/totp/setup', async (req, res) => {
    const login = await requireLogin(req)
    if (!login) return fail(res, 401, '未登录或登录过期')
    try {
        const [rows] = await pool.query('SELECT id, username, email FROM user WHERE id = ?', [login.id])
        const user = rows[0]
        if (!user) return fail(res, 404, '用户不存在')
        const secret = authenticator.generateSecret()
        // 先存到 pending 字段（临时），确认时才写入正式列；此处返回给前端即可
        const account = user.username || user.email || String(user.id)
        const uri = authenticator.keyuri(account, 'JScreator', secret)
        res.json({ code: 200, success: true, message: '获取绑定信息成功', data: { secret, uri } })
    } catch (e) {
        console.error('TOTP setup 错误:', e)
        fail(res, 500, '服务器内部错误')
    }
})

// ===== 2. 确认绑定：验证 6 位码，成功后 secret 入库 =====
router.post('/totp/confirm', async (req, res) => {
    const login = await requireLogin(req)
    if (!login) return fail(res, 401, '未登录或登录过期')
    const { secret, code } = req.body
    if (!secret || !code) return fail(res, 400, '参数缺失')
    try {
        const valid = authenticator.check(code, secret)
        if (!valid) return fail(res, 400, '验证码不正确，请重试')
        await pool.query('UPDATE user SET totp_secret = ? WHERE id = ?', [secret, login.id])
        ok(res, null, 'TOTP 绑定成功')
    } catch (e) {
        console.error('TOTP confirm 错误:', e)
        fail(res, 500, '服务器内部错误')
    }
})

// ===== 3. 解绑：需验证当前动态码 =====
router.post('/totp/disable', async (req, res) => {
    const login = await requireLogin(req)
    if (!login) return fail(res, 401, '未登录或登录过期')
    const { code } = req.body
    try {
        const [rows] = await pool.query('SELECT totp_secret FROM user WHERE id = ?', [login.id])
        const secret = rows[0]?.totp_secret
        if (!secret) return fail(res, 400, '尚未绑定 TOTP')
        if (!authenticator.check(code, secret)) return fail(res, 400, '验证码不正确')
        await pool.query('UPDATE user SET totp_secret = NULL WHERE id = ?', [login.id])
        ok(res, null, '已解绑 TOTP')
    } catch (e) {
        console.error('TOTP disable 错误:', e)
        fail(res, 500, '服务器内部错误')
    }
})

// ===== 4. 状态查询 =====
router.get('/totp/status', async (req, res) => {
    const login = await requireLogin(req)
    if (!login) return fail(res, 401, '未登录或登录过期')
    try {
        const [rows] = await pool.query('SELECT totp_secret FROM user WHERE id = ?', [login.id])
        ok(res, { bound: !!rows[0]?.totp_secret })
    } catch (e) {
        console.error('TOTP status 错误:', e)
        fail(res, 500, '服务器内部错误')
    }
})

// ===== 5. TOTP 直接登录：账号(用户名/邮箱) + 动态码 =====
router.post('/totp/login', async (req, res) => {
    const { account, code } = req.body
    if (!account || !code) return fail(res, 400, '账号和动态码不能为空')
    try {
        // 按用户名或邮箱查用户
        const [rows] = await pool.query(
            'SELECT id, username, email, role_id, avatar, bio, area, name, totp_secret, checkinDay FROM user WHERE username = ? OR email = ? LIMIT 1',
            [account, account]
        )
        const user = rows[0]
        if (!user) return fail(res, 401, '账号不存在')
        if (!user.totp_secret) return fail(res, 400, '该账号未绑定 TOTP，请先登录后在个人设置中绑定')
        const valid = authenticator.check(String(code).trim(), user.totp_secret)
        if (!valid) return fail(res, 401, '动态码错误或已过期')
        const token = tokenCreator(user)
        console.log(`登录通知：用户 TOTP 登录', id:${user.id}, ${user.username}`)
        res.json({
            code: 200,
            success: true,
            message: '登录成功',
            token,
            user_info: {
                id: user.id,
                username: user.username,
                email: user.email,
                role_id: user.role_id,
                avatar: user.avatar,
                bio: user.bio,
                area: user.area,
                name: user.name,
                vipLevel: user.name,
                checkinDay: user.checkinDay,
                login_time: new Date().toLocaleString()
            }
        })
    } catch (e) {
        console.error('TOTP login 错误:', e)
        fail(res, 500, '服务器内部错误')
    }
})

module.exports = router
