const express = require('express')
const router = express.Router()
const { tokenValidator } = require('../utils/token_creator')
const {
    notification_add,
    notification_getForUser,
    notification_markRead,
    notification_getUnreadCount,
    notification_getUserRoleId
} = require('../utils/db_notification')

/**
 * 解析 Authorization: Bearer <token>
 * 成功返回 decoded（含 id），失败写入 401 响应并返回 null
 */
function resolveUser(req, res) {
    const token = req.headers.authorization
    if (!token) {
        res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
        return null
    }
    const decoded = tokenValidator(token)
    if (!decoded || typeof decoded !== 'object' || decoded.id === undefined) {
        res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
        return null
    }
    return decoded
}

/**
 * 校验管理员权限（role_id = 1）
 * 通过返回 true；失败写入响应并返回 false
 */
async function requireAdmin(req, res, user_id) {
    try {
        const role_id = await notification_getUserRoleId(user_id)
        if (role_id !== 1) {
            res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员可发布通知' })
            return false
        }
        return true
    } catch (error) {
        console.error('校验管理员权限错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
        return false
    }
}

// 管理员发布通知
router.post('/notification/add', async (req, res) => {
    const decoded = resolveUser(req, res)
    if (!decoded) return

    const isAdmin = await requireAdmin(req, res, decoded.id)
    if (!isAdmin) return

    const { title, content, target_type, target_id } = req.body
    if (!title || !content) {
        return res.status(400).json({ code: 400, success: false, message: '标题和内容不能为空' })
    }
    const validTypes = ['all', 'user', 'role']
    if (!validTypes.includes(target_type)) {
        return res.status(400).json({ code: 400, success: false, message: "target_type 必须为 'all' | 'user' | 'role'" })
    }
    if (target_type !== 'all' && !target_id) {
        return res.status(400).json({ code: 400, success: false, message: "target_type 为 'user' 或 'role' 时必须提供 target_id" })
    }

    try {
        const insertId = await notification_add(title, content, decoded.id, target_type, target_id)
        res.json({
            code: 200,
            success: true,
            message: '通知发布成功',
            data: { notification_id: insertId }
        })
    } catch (error) {
        console.error('发布通知错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 当前用户收到的通知列表
router.get('/notification/list', async (req, res) => {
    const decoded = resolveUser(req, res)
    if (!decoded) return
    try {
        const list = await notification_getForUser(decoded.id)
        res.json({
            code: 200,
            success: true,
            message: '获取通知列表成功',
            data: { list, total: list.length }
        })
    } catch (error) {
        console.error('获取通知列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 当前用户未读数
router.get('/notification/unread-count', async (req, res) => {
    const decoded = resolveUser(req, res)
    if (!decoded) return
    try {
        const unread_count = await notification_getUnreadCount(decoded.id)
        res.json({
            code: 200,
            success: true,
            message: '获取未读数成功',
            data: { unread_count }
        })
    } catch (error) {
        console.error('获取未读数错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 标记已读
router.post('/notification/read', async (req, res) => {
    const decoded = resolveUser(req, res)
    if (!decoded) return

    const { notification_id } = req.body
    if (!notification_id) {
        return res.status(400).json({ code: 400, success: false, message: 'notification_id 不能为空' })
    }
    try {
        await notification_markRead(notification_id, decoded.id)
        res.json({
            code: 200,
            success: true,
            message: '标记已读成功',
            data: { notification_id }
        })
    } catch (error) {
        console.error('标记已读错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

module.exports = router
