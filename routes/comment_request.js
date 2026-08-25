const express = require('express')
const router = express.Router()
const { tokenValidator } = require('../utils/token_creator')
const { pool } = require('../utils/connect_db')
const {
    getUsernameById,
    comment_getById,
    comment_add,
    comment_getByArticle,
    comment_manageList,
    comment_update,
    comment_deleteCascade,
} = require('../utils/db_comment')
const { article_getById } = require('../utils/db_article')

// 从请求头解析登录用户，失败返回 null
const getLoginUser = (req) => {
    const token = req.headers.authorization
    const decoded = tokenValidator(token)
    if (decoded && typeof decoded === 'object' && decoded.id != null) {
        return decoded
    }
    return null
}

// 管理员校验：解析 token 并查库确认 role_id === 1；通过返回 true，失败已写响应返回 false
const requireAdmin = async (req, res) => {
    const user = getLoginUser(req)
    if (!user) {
        res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
        return false
    }
    try {
        const [rows] = await pool.query('SELECT role_id FROM user WHERE id = ?', [user.id])
        if (!rows.length || rows[0].role_id !== 1) {
            res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员可操作' })
            return false
        }
        return true
    } catch (error) {
        console.error('评论管理-校验角色错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
        return false
    }
}

// 获取某文章评论列表（公开，返回楼中楼树形结构，顶层分页）
router.get('/comment/list/:articleId', async (req, res) => {
    const article_id = Number(req.params.articleId)
    if (!article_id) {
        return res.status(400).json({ code: 400, success: false, message: '文章id不能为空' })
    }
    const { page, pageSize } = req.query
    try {
        const data = await comment_getByArticle(article_id, { page, pageSize })
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (error) {
        console.error('获取评论列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取评论列表失败' })
    }
})

// 发表评论（公开，可匿名；登录用户自动用 username 作为昵称）
router.post('/comment/add', async (req, res) => {
    const { article_id, content, parent_id, nickname } = req.body
    if (!article_id || !content) {
        return res.status(400).json({ code: 400, success: false, message: '文章id和评论内容不能为空' })
    }

    try {
        // 校验文章存在
        const article = await article_getById(Number(article_id))
        if (!article) {
            return res.status(404).json({ code: 404, success: false, message: '文章不存在' })
        }

        // 校验父评论（若提供）存在且属于同一文章
        if (parent_id != null) {
            const parent = await comment_getById(Number(parent_id))
            if (!parent || Number(parent.article_id) !== Number(article_id)) {
                return res.status(400).json({ code: 400, success: false, message: '父评论不存在或不属于该文章' })
            }
        }

        // 登录用户：user_id 取 token 的 id，昵称用用户名；匿名：user_id 为空，昵称必填
        let user_id = null
        let final_nickname = nickname || null
        const user = getLoginUser(req)
        if (user) {
            user_id = user.id
            const username = await getUsernameById(user.id)
            if (username) final_nickname = username
        }

        if (user_id == null && !final_nickname) {
            return res.status(400).json({ code: 400, success: false, message: '匿名评论需要填写昵称' })
        }

        // ---- 防垃圾校验 ----
        const text = String(content || '').trim()
        if (!text) {
            return res.status(400).json({ code: 400, success: false, message: '评论内容不能为空' })
        }
        if (text.length > 500) {
            return res.status(400).json({ code: 400, success: false, message: '评论内容最多 500 字' })
        }
        const condensed = text.replace(/\s+/g, '')
        if (/^\d+$/.test(condensed) && condensed.length >= 6) {
            return res.status(400).json({ code: 400, success: false, message: '评论内容过于简单，请认真填写' })
        }

        // 匿名昵称校验：2-20 字符，不能是纯数字
        if (user_id == null) {
            const nick = String(final_nickname || '').trim()
            if (nick.length < 2 || nick.length > 20) {
                return res.status(400).json({ code: 400, success: false, message: '昵称需 2-20 个字符' })
            }
            if (/^\d+$/.test(nick)) {
                return res.status(400).json({ code: 400, success: false, message: '昵称不能是纯数字' })
            }
        }

        const comment_id = await comment_add({
            article_id: Number(article_id),
            user_id,
            nickname: final_nickname,
            content: text,
            parent_id: parent_id != null ? Number(parent_id) : null,
        })
        res.json({ code: 200, success: true, message: '评论成功', data: { comment_id } })
    } catch (error) {
        console.error('发表评论错误:', error)
        res.status(500).json({ code: 500, success: false, message: '发表评论失败' })
    }
})

// ============ 评论管理（仅管理员） ============

// 评论列表（分页 + 按文章/关键词筛选）
router.get('/comment/manage/list', async (req, res) => {
    const ok = await requireAdmin(req, res)
    if (!ok) return
    const { page, pageSize, article_id, keyword } = req.query
    try {
        const data = await comment_manageList({ page, pageSize, article_id, keyword })
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (error) {
        console.error('评论管理-获取列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取评论列表失败' })
    }
})

// 编辑评论（内容/昵称）
router.put('/comment/manage/update', async (req, res) => {
    const ok = await requireAdmin(req, res)
    if (!ok) return
    const { comment_id, content, nickname } = req.body
    if (!comment_id) {
        return res.status(400).json({ code: 400, success: false, message: 'comment_id 不能为空' })
    }
    if (content === undefined && nickname === undefined) {
        return res.status(400).json({ code: 400, success: false, message: '没有需要更新的字段' })
    }
    try {
        await comment_update(Number(comment_id), { content, nickname })
        res.json({ code: 200, success: true, message: '更新成功' })
    } catch (error) {
        console.error('评论管理-更新错误:', error)
        res.status(500).json({ code: 500, success: false, message: '更新失败' })
    }
})

// 删除评论（单条或批量，级联删子评论）
router.delete('/comment/manage/delete', async (req, res) => {
    const ok = await requireAdmin(req, res)
    if (!ok) return
    const { comment_ids } = req.body
    if (!Array.isArray(comment_ids) || !comment_ids.length) {
        return res.status(400).json({ code: 400, success: false, message: 'comment_ids 不能为空' })
    }
    try {
        let deleted = 0
        for (const id of comment_ids) {
            deleted += await comment_deleteCascade(Number(id))
        }
        res.json({ code: 200, success: true, message: `删除成功（${deleted} 条）`, data: { deleted } })
    } catch (error) {
        console.error('评论管理-删除错误:', error)
        res.status(500).json({ code: 500, success: false, message: '删除失败' })
    }
})

module.exports = router
