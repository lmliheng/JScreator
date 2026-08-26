const express = require('express')
const router = express.Router()
const {
    getUserPublicByUsername,
    getArticlesByUsername,
    getUserList,
    getArticlesByIds,
    getLatestArticles,
    getHotArticles,
} = require('../utils/db_blog_profile')

/**
 * 博客个人主页接口（供博客前端 /username 路由使用）
 *
 * 1. GET /blog/profile/:username
 *    一次返回用户公开信息 + 第一页已发布文章，方便个人主页首屏。
 *    query: page（默认 1）、pageSize（默认 10）
 *    data = { user: {...}, articles: { list, total, page, pageSize } }
 *
 * 2. GET /blog/articles/:username
 *    只返回该用户的已发布文章分页，供「加载更多 / 翻页」使用，避免重复拉用户信息。
 *    query: page（默认 1）、pageSize（默认 10）
 *    data = { list, total, page, pageSize }
 */

// 博客首页：所有有文章的用户列表（用户主页入口）
router.get('/blog/users', async (req, res) => {
    const { page, pageSize } = req.query
    try {
        const data = await getUserList(page, pageSize)
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (error) {
        console.error('获取用户列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取用户列表失败' })
    }
})

// 博客首页：全站最新文章流（门户首页「最新文章」区块）
router.get('/blog/feed', async (req, res) => {
    const { limit } = req.query
    try {
        const list = await getLatestArticles(limit)
        res.json({ code: 200, success: true, message: '获取成功', data: { list } })
    } catch (error) {
        console.error('获取全站最新文章错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取最新文章失败' })
    }
})

// 博客首页：全站热议文章（按评论数排序，门户首页「热门文章」区块）
router.get('/blog/hot', async (req, res) => {
    const { limit } = req.query
    try {
        const list = await getHotArticles(limit)
        res.json({ code: 200, success: true, message: '获取成功', data: { list } })
    } catch (error) {
        console.error('获取热议文章错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取热门文章失败' })
    }
})

// 博客主页：用户公开信息 + 文章（设置了精选则展示精选，否则最新）
router.get('/blog/profile/:username', async (req, res) => {
    const { username } = req.params
    const { page, pageSize } = req.query
    try {
        const user = await getUserPublicByUsername(username)
        if (!user) {
            return res.status(404).json({ code: 404, success: false, message: '用户不存在' })
        }
        let articles
        let all_total = 0
        const featured = user.featured_articles || []
        if (featured.length) {
            const list = await getArticlesByIds(featured)
            articles = { list, total: list.length, page: 1, pageSize: list.length }
        } else {
            articles = await getArticlesByUsername(username, page, pageSize)
        }
        // 全部已发布文章数（供「查看全部」入口显示）
        try {
            const countRes = await getArticlesByUsername(username, 1, 1)
            all_total = countRes.total || 0
        } catch (e) {
            all_total = articles.total || 0
        }
        res.json({ code: 200, success: true, message: '获取成功', data: { user, articles, all_total } })
    } catch (error) {
        console.error('获取博客主页错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取博客主页失败' })
    }
})

// 用户已发布文章分页（翻页 / 加载更多），支持 keyword / category_id / sort 筛选
router.get('/blog/articles/:username', async (req, res) => {
    const { username } = req.params
    const { page, pageSize, keyword, category_id, sort } = req.query
    try {
        const user = await getUserPublicByUsername(username)
        if (!user) {
            return res.status(404).json({ code: 404, success: false, message: '用户不存在' })
        }
        const data = await getArticlesByUsername(username, page, pageSize, { keyword, category_id, sort })
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (error) {
        console.error('获取用户文章列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取用户文章列表失败' })
    }
})

module.exports = router
