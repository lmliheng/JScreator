const express = require('express')
const router = express.Router()
const { tokenValidator } = require('../utils/token_creator')
const {
    announceGetLatest,
    announceManageList,
    announceAdd,
    announceUpdate,
    announceSetStatus,
    announceDelete,
} = require('../utils/db_announcement')

const parseToken = async (token) => {
    if (!token) return null
    const decoded = await tokenValidator(token)
    if (!decoded || decoded === '解析失败' || typeof decoded !== 'object' || decoded.id == undefined) {
        return null
    }
    return decoded
}

const requireAdmin = async (req, res) => {
    const decoded = await parseToken(req.headers.authorization)
    if (decoded === null) {
        res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
        return null
    }
    if (Number(decoded.role_id) !== 1) {
        res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员可操作' })
        return null
    }
    return decoded
}

// 公开：最新一条启用公告
router.get('/announcement/latest', async (req, res) => {
    try {
        const announcement = await announceGetLatest()
        res.json({ code: 200, success: true, message: '获取成功', data: { announcement } })
    } catch (error) {
        console.error('获取公告错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取公告失败' })
    }
})

// ================= 管理端（仅 admin） =================

router.get('/announcement/admin/list', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const { page, pageSize, keyword, status } = req.query
    try {
        const data = await announceManageList(page, pageSize, keyword, status)
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (error) {
        console.error('获取公告列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取失败' })
    }
})

router.post('/announcement/admin/add', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const { title, content } = req.body
    if (!title || !title.trim()) {
        return res.status(400).json({ code: 400, success: false, message: '公告标题不能为空' })
    }
    if (!content || !content.trim()) {
        return res.status(400).json({ code: 400, success: false, message: '公告内容不能为空' })
    }
    try {
        const id = await announceAdd(title.trim(), content)
        res.json({ code: 200, success: true, message: '发布成功', data: { id } })
    } catch (error) {
        console.error('新增公告错误:', error)
        res.status(500).json({ code: 500, success: false, message: '发布失败' })
    }
})

router.put('/announcement/admin/update/:id', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const id = Number(req.params.id)
    const { title, content } = req.body
    if (!id || !title || !content) {
        return res.status(400).json({ code: 400, success: false, message: '参数缺失' })
    }
    try {
        await announceUpdate(id, title.trim(), content)
        res.json({ code: 200, success: true, message: '更新成功' })
    } catch (error) {
        console.error('更新公告错误:', error)
        res.status(500).json({ code: 500, success: false, message: '更新失败' })
    }
})

router.put('/announcement/admin/status/:id', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const id = Number(req.params.id)
    const { status } = req.body
    if (!id || status === undefined) {
        return res.status(400).json({ code: 400, success: false, message: '参数缺失' })
    }
    try {
        await announceSetStatus(id, status)
        res.json({ code: 200, success: true, message: '操作成功' })
    } catch (error) {
        console.error('公告启停错误:', error)
        res.status(500).json({ code: 500, success: false, message: '操作失败' })
    }
})

router.delete('/announcement/admin/delete/:id', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const id = Number(req.params.id)
    if (!id) {
        return res.status(400).json({ code: 400, success: false, message: '无效的公告' })
    }
    try {
        await announceDelete(id)
        res.json({ code: 200, success: true, message: '删除成功' })
    } catch (error) {
        console.error('删除公告错误:', error)
        res.status(500).json({ code: 500, success: false, message: '删除失败' })
    }
})

module.exports = router
