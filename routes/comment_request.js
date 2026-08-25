const express = require('express')
const router = express.Router()
const { tokenValidator } = require('../utils/token_creator')
const {
    getUsernameById,
    comment_getById,
    comment_add,
    comment_getByArticle,
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

// 获取某文章评论列表（公开，返回楼中楼树形结构）
router.get('/comment/list/:articleId', async (req, res) => {
    const article_id = Number(req.params.articleId)
    if (!article_id) {
        return res.status(400).json({ code: 400, success: false, message: '文章id不能为空' })
    }
    try {
        const list = await comment_getByArticle(article_id)
        res.json({ code: 200, success: true, message: '获取成功', data: { list } })
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

        const comment_id = await comment_add({
            article_id: Number(article_id),
            user_id,
            nickname: final_nickname,
            content,
            parent_id: parent_id != null ? Number(parent_id) : null,
        })
        res.json({ code: 200, success: true, message: '评论成功', data: { comment_id } })
    } catch (error) {
        console.error('发表评论错误:', error)
        res.status(500).json({ code: 500, success: false, message: '发表评论失败' })
    }
})

module.exports = router
