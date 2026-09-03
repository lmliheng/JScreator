const express = require('express')
const router = express.Router()
const { apiKeyVerify } = require('../utils/db_api_key')
const { article_detail, article_list } = require('../utils/db_article')
const { getUserPublicByUsername } = require('../utils/db_blog_profile')

/**
 * 开放 API v1（外部接口，API Key 鉴权）
 * 请求头：Authorization: Bearer sk_xxxxx
 * 权限范围：read（查询）/ write（发布）
 *
 * 端点：
 *   GET    /api/v1/articles           文章列表（分页 + keyword + category_id）
 *   GET    /api/v1/articles/:id       文章详情（含 AI 总结）
 *   GET    /api/v1/users/:username    用户公开主页信息
 *   POST   /api/v1/articles           发布文章（需 write）
 */

const fail = (res, code, message) => res.status(code).json({ code, success: false, message })

// API Key 鉴权中间件
async function requireApiKey(req, res, next) {
    const auth = req.headers.authorization || ''
    const plain = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    const verified = await apiKeyVerify(plain)
    if (!verified) {
        return fail(res, 401, '无效的 API Key')
    }
    req.apiKeyUser = verified // { user_id, scopes }
    req.apiKey = plain
    next()
}

// 校验是否有指定权限（read/write）
function requireScope(scope) {
    return (req, res, next) => {
        const scopes = String(req.apiKeyUser.scopes || 'read').split(',').map((s) => s.trim())
        if (!scopes.includes(scope)) {
            return fail(res, 403, `该 API Key 无 ${scope} 权限`)
        }
        next()
    }
}

// 文章列表
router.get('/api/v1/articles', requireApiKey, requireScope('read'), async (req, res) => {
    const { page, pageSize, keyword, category_id } = req.query
    try {
        const data = await article_list({ page, pageSize, keyword, category_id })
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (e) {
        console.error('API 文章列表错误:', e)
        fail(res, 500, '获取失败')
    }
})

// 文章详情
router.get('/api/v1/articles/:id', requireApiKey, requireScope('read'), async (req, res) => {
    const id = Number(req.params.id)
    if (!id) return fail(res, 400, '文章 id 不能为空')
    try {
        const article = await article_detail(id)
        if (!article || article.status !== 1) {
            return fail(res, 404, '文章不存在或未发布')
        }
        res.json({ code: 200, success: true, message: '获取成功', data: article })
    } catch (e) {
        console.error('API 文章详情错误:', e)
        fail(res, 500, '获取失败')
    }
})

// 用户公开主页
router.get('/api/v1/users/:username', requireApiKey, requireScope('read'), async (req, res) => {
    const { username } = req.params
    try {
        const user = await getUserPublicByUsername(username)
        if (!user) return fail(res, 404, '用户不存在')
        res.json({ code: 200, success: true, message: '获取成功', data: user })
    } catch (e) {
        console.error('API 用户查询错误:', e)
        fail(res, 500, '获取失败')
    }
})

// 发布文章（write 权限）
router.post('/api/v1/articles', requireApiKey, requireScope('write'), async (req, res) => {
    const { title, content, category_ids, status } = req.body
    if (!title || !content) return fail(res, 400, '标题和内容不能为空')
    try {
        const { article_add } = require('../utils/db_article')
        const article_id = await article_add({
            user_id: req.apiKeyUser.user_id, // 文章归属 key 的持有者
            title,
            content,
            status: status === undefined ? 1 : Number(status),
            category_ids: category_ids || [],
        })
        // 发布时异步生成 AI 总结
        if (Number(status === undefined ? 1 : status) === 1) {
            const { summarizeAndSave } = require('../utils/ai_summary')
            summarizeAndSave(article_id, { title, content }).then(() => {})
        }
        res.json({ code: 200, success: true, message: '发布成功', data: { article_id } })
    } catch (e) {
        console.error('API 发布文章错误:', e)
        fail(res, 500, '发布失败')
    }
})

module.exports = router
