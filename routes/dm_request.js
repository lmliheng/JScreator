const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const { tokenValidator } = require('../utils/token_creator')
const { pool } = require('../utils/connect_db')
const {
    msgConversation,
    msgConversationList,
    msgUnreadTotal,
    msgMarkRead,
} = require('../utils/db_message')

/**
 * 私信 REST 接口（配合 WebSocket 实时收发）
 * GET  /dm/conversations         会话列表（含未读数）
 * GET  /dm/messages/:otherId     与某人的历史消息
 * GET  /dm/unread-count          未读总数
 * POST /dm/read                  { other_id } 标记会话已读
 */

const fail = (res, code, message) => res.status(code).json({ code, success: false, message })

async function loginUser(req) {
    const token = req.headers.authorization || ''
    try {
        const t = token.startsWith('Bearer ') ? token.slice(7) : token
        return jwt.verify(t, process.env.JWT_SECRET || 'test')
    } catch (e) {
        return null
    }
}

router.get('/dm/conversations', async (req, res) => {
    const user = await loginUser(req)
    if (!user) return fail(res, 401, '未登录或登录过期')
    try {
        const list = await msgConversationList(user.id)
        res.json({ code: 200, success: true, data: { list } })
    } catch (e) {
        console.error('DM 会话列表错误:', e)
        fail(res, 500, '获取失败')
    }
})

router.get('/dm/messages/:otherId', async (req, res) => {
    const user = await loginUser(req)
    if (!user) return fail(res, 401, '未登录或登录过期')
    const otherId = Number(req.params.otherId)
    const { page, pageSize } = req.query
    try {
        const list = await msgConversation(user.id, otherId, page, pageSize)
        res.json({ code: 200, success: true, data: { list } })
    } catch (e) {
        console.error('DM 消息错误:', e)
        fail(res, 500, '获取失败')
    }
})

router.get('/dm/unread-count', async (req, res) => {
    const user = await loginUser(req)
    if (!user) return fail(res, 401, '未登录或登录过期')
    try {
        const count = await msgUnreadTotal(user.id)
        res.json({ code: 200, success: true, data: { count } })
    } catch (e) {
        fail(res, 500, '获取失败')
    }
})

router.post('/dm/read', async (req, res) => {
    const user = await loginUser(req)
    if (!user) return fail(res, 401, '未登录或登录过期')
    const { other_id } = req.body
    if (!other_id) return fail(res, 400, '参数缺失')
    try {
        await msgMarkRead(user.id, Number(other_id))
        res.json({ code: 200, success: true, message: 'ok' })
    } catch (e) {
        fail(res, 500, '操作失败')
    }
})

module.exports = router
