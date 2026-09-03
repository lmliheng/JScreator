const express = require('express')
const router = express.Router()
const { tokenValidator } = require('../utils/token_creator')
const {
    apiKeyCreate,
    apiKeyListByUser,
    apiKeySetStatus,
    apiKeyDelete,
    apiKeyVerify,
} = require('../utils/db_api_key')
const { pool } = require('../utils/connect_db')

/**
 * API Key 管理（登录用户管理自己的 key）
 */

const requireLogin = async (req, res) => {
    const token = req.headers.authorization
    if (!token) return null
    const decoded = await tokenValidator(token)
    if (!decoded || decoded === '解析失败' || typeof decoded !== 'object' || decoded.id == undefined) {
        return null
    }
    return decoded
}

const fail = (res, code, message) => res.status(code).json({ code, success: false, message })

// 我的 key 列表
router.get('/api-keys', async (req, res) => {
    const user = await requireLogin(req, res)
    if (!user) return fail(res, 401, '未登录或登录过期')
    try {
        const list = await apiKeyListByUser(user.id)
        res.json({ code: 200, success: true, message: '获取成功', data: { list } })
    } catch (e) {
        console.error('获取 API key 列表错误:', e)
        fail(res, 500, '获取失败')
    }
})

// 创建 key
router.post('/api-keys', async (req, res) => {
    const user = await requireLogin(req, res)
    if (!user) return fail(res, 401, '未登录或登录过期')
    const { name, scopes } = req.body
    // 权限范围白名单；write 仅 admin/editor 可建（能发文章）
    let scope = 'read'
    if (scopes && String(scopes).includes('write')) {
        const [roleRows] = await pool.query('SELECT role_id FROM user WHERE id = ?', [user.id])
        const roleId = Number(roleRows[0]?.role_id)
        if (roleId === 1 || roleId === 3) scope = 'read,write'
        else return fail(res, 403, '仅管理员/编辑可创建写权限 Key')
    }
    try {
        const result = await apiKeyCreate(user.id, name, scope)
        res.json({
            code: 200,
            success: true,
            message: '创建成功（明文只显示这一次，请妥善保存）',
            data: { plain: result.plain, prefix: result.keyPrefix, scopes: result.scopes },
        })
    } catch (e) {
        console.error('创建 API key 错误:', e)
        fail(res, 500, '创建失败')
    }
})

// 禁用/启用
router.put('/api-keys/:id/status', async (req, res) => {
    const user = await requireLogin(req, res)
    if (!user) return fail(res, 401, '未登录或登录过期')
    const { status } = req.body
    try {
        await apiKeySetStatus(req.params.id, user.id, status)
        res.json({ code: 200, success: true, message: '操作成功' })
    } catch (e) {
        console.error('更新 API key 状态错误:', e)
        fail(res, 500, '操作失败')
    }
})

// 删除
router.delete('/api-keys/:id', async (req, res) => {
    const user = await requireLogin(req, res)
    if (!user) return fail(res, 401, '未登录或登录过期')
    try {
        await apiKeyDelete(req.params.id, user.id)
        res.json({ code: 200, success: true, message: '删除成功' })
    } catch (e) {
        console.error('删除 API key 错误:', e)
        fail(res, 500, '删除失败')
    }
})

module.exports = { router, apiKeyVerify, requireApiKey: apiKeyVerify }
