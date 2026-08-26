const express = require('express')
const router = express.Router()
const { tokenValidator } = require('../utils/token_creator')
const {
    adGetByPosition,
    adIncrementClick,
    adManageList,
    adAdd,
    adUpdate,
    adSetStatus,
    adDelete,
    adGetById,
} = require('../utils/db_ad')

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

// 投放位置白名单
const POSITIONS = ['article_top', 'article_bottom', 'home_mid']

// 公开：某位置的启用广告（排序最前一条）
router.get('/ad/slots', async (req, res) => {
    const { position } = req.query
    if (!position || !POSITIONS.includes(position)) {
        return res.status(400).json({ code: 400, success: false, message: '无效的广告位' })
    }
    try {
        const ad = await adGetByPosition(position)
        res.json({ code: 200, success: true, message: '获取成功', data: { ad } })
    } catch (error) {
        console.error('获取广告错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取广告失败' })
    }
})

// 公开：广告点击统计 +1
router.post('/ad/click/:id', async (req, res) => {
    const id = Number(req.params.id)
    if (!id) {
        return res.status(400).json({ code: 400, success: false, message: '无效的广告' })
    }
    try {
        await adIncrementClick(id)
        res.json({ code: 200, success: true, message: 'ok' })
    } catch (error) {
        console.error('广告点击统计错误:', error)
        res.status(500).json({ code: 500, success: false, message: '统计失败' })
    }
})

// ================= 管理端（仅 admin） =================

router.get('/ad/admin/list', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const { page, pageSize, keyword, position } = req.query
    try {
        const data = await adManageList(page, pageSize, keyword, position)
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (error) {
        console.error('获取广告列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取失败' })
    }
})

router.get('/ad/admin/detail/:id', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    try {
        const ad = await adGetById(req.params.id)
        if (!ad) {
            return res.status(404).json({ code: 404, success: false, message: '广告不存在' })
        }
        res.json({ code: 200, success: true, message: '获取成功', data: ad })
    } catch (error) {
        console.error('获取广告详情错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取失败' })
    }
})

router.post('/ad/admin/add', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const { title } = req.body
    if (!title) {
        return res.status(400).json({ code: 400, success: false, message: '广告标题不能为空' })
    }
    try {
        const id = await adAdd(req.body)
        res.json({ code: 200, success: true, message: '新增成功', data: { id } })
    } catch (error) {
        console.error('新增广告错误:', error)
        res.status(500).json({ code: 500, success: false, message: '新增失败' })
    }
})

router.put('/ad/admin/update/:id', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const id = Number(req.params.id)
    if (!id) {
        return res.status(400).json({ code: 400, success: false, message: '无效的广告' })
    }
    try {
        await adUpdate(id, req.body)
        res.json({ code: 200, success: true, message: '更新成功' })
    } catch (error) {
        console.error('更新广告错误:', error)
        res.status(500).json({ code: 500, success: false, message: '更新失败' })
    }
})

router.put('/ad/admin/status/:id', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const id = Number(req.params.id)
    const { status } = req.body
    if (!id || status === undefined) {
        return res.status(400).json({ code: 400, success: false, message: '参数缺失' })
    }
    try {
        await adSetStatus(id, status)
        res.json({ code: 200, success: true, message: '操作成功' })
    } catch (error) {
        console.error('广告启停错误:', error)
        res.status(500).json({ code: 500, success: false, message: '操作失败' })
    }
})

router.delete('/ad/admin/delete/:id', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const id = Number(req.params.id)
    if (!id) {
        return res.status(400).json({ code: 400, success: false, message: '无效的广告' })
    }
    try {
        await adDelete(id)
        res.json({ code: 200, success: true, message: '删除成功' })
    } catch (error) {
        console.error('删除广告错误:', error)
        res.status(500).json({ code: 500, success: false, message: '删除失败' })
    }
})

module.exports = router
