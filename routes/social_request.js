const express = require('express')
const router = express.Router()
const { tokenValidator } = require('../utils/token_creator')
const { pool } = require('../utils/connect_db')
const {
    followAdd,
    followRemove,
    followExists,
    followListByFollower,
    followListByFollowee,
    followStats,
    likeToggle,
    likeExists,
    likeCountByArticle,
    likeCountReceived,
    likeManageList,
    likeManageDelete,
    favoriteToggle,
    favoriteExists,
    favoriteCountByArticle,
    favoriteListByUser,
    favoriteManageList,
    favoriteManageDelete,
    notificationAdd,
    notificationList,
    notificationUnreadCount,
    notificationRead,
    notificationReadAll,
} = require('../utils/db_social')

/**
 * 鉴权辅助：解析 token 返回 { id, role_id }，失败返回 null 并已响应 401
 */
const parseToken = async (token) => {
    if (!token) return null
    const decoded = await tokenValidator(token)
    if (!decoded || decoded === '解析失败' || typeof decoded !== 'object' || decoded.id == undefined) {
        return null
    }
    return decoded
}
const requireLogin = async (req, res) => {
    const decoded = await parseToken(req.headers.authorization)
    if (decoded === null) {
        res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
        return null
    }
    return decoded
}
const requireAdmin = async (req, res) => {
    const decoded = await requireLogin(req, res)
    if (decoded === null) return null
    if (Number(decoded.role_id) !== 1) {
        res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员可操作' })
        return null
    }
    return decoded
}

// 按 username 查用户 id（公开信息）
const userIdByUsername = async (username) => {
    const [rows] = await pool.query('SELECT id FROM user WHERE username = ? LIMIT 1', [username])
    return rows.length ? rows[0].id : null
}

// ================= 关注 =================

// 关注 / 取消关注（toggle）
router.post('/social/follow/:username', async (req, res) => {
    const login = await requireLogin(req, res)
    if (login === null) return
    const { username } = req.params
    const followeeId = await userIdByUsername(username)
    if (!followeeId) {
        return res.status(404).json({ code: 404, success: false, message: '用户不存在' })
    }
    if (Number(followeeId) === Number(login.id)) {
        return res.status(400).json({ code: 400, success: false, message: '不能关注自己' })
    }
    try {
        const existed = await followExists(login.id, followeeId)
        if (existed) {
            await followRemove(login.id, followeeId)
            return res.json({ code: 200, success: true, message: '已取消关注', data: { following: false } })
        }
        await followAdd(login.id, followeeId)
        // 通知对方：XX 关注了你
        await notificationAdd(followeeId, login.id, 'follow', null, '关注了你')
        res.json({ code: 200, success: true, message: '关注成功', data: { following: true } })
    } catch (error) {
        console.error('关注操作错误:', error)
        res.status(500).json({ code: 500, success: false, message: error.message === '不能关注自己' ? error.message : '操作失败' })
    }
})

// 某用户的关注列表（公开）
router.get('/social/following/:username', async (req, res) => {
    const { username } = req.params
    const uid = await userIdByUsername(username)
    if (!uid) {
        return res.status(404).json({ code: 404, success: false, message: '用户不存在' })
    }
    try {
        const list = await followListByFollower(uid)
        res.json({ code: 200, success: true, message: '获取成功', data: { list } })
    } catch (error) {
        console.error('获取关注列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取失败' })
    }
})

// 某用户的粉丝列表（公开）
router.get('/social/followers/:username', async (req, res) => {
    const { username } = req.params
    const uid = await userIdByUsername(username)
    if (!uid) {
        return res.status(404).json({ code: 404, success: false, message: '用户不存在' })
    }
    try {
        const list = await followListByFollowee(uid)
        res.json({ code: 200, success: true, message: '获取成功', data: { list } })
    } catch (error) {
        console.error('获取粉丝列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取失败' })
    }
})

// 某用户的关注/粉丝统计 + 当前登录用户是否已关注（公开）
router.get('/social/stats/:username', async (req, res) => {
    const { username } = req.params
    const uid = await userIdByUsername(username)
    if (!uid) {
        return res.status(404).json({ code: 404, success: false, message: '用户不存在' })
    }
    try {
        const stats = await followStats(uid)
        const liked = await likeCountReceived(uid)
        const login = await parseToken(req.headers.authorization)
        let isFollowing = false
        if (login) {
            isFollowing = await followExists(login.id, uid)
        }
        res.json({
            code: 200,
            success: true,
            message: '获取成功',
            data: { ...stats, liked, isFollowing },
        })
    } catch (error) {
        console.error('获取社交统计错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取失败' })
    }
})

// ================= 点赞 =================

// 点赞 / 取消点赞（toggle）
router.post('/social/like/:articleId', async (req, res) => {
    const login = await requireLogin(req, res)
    if (login === null) return
    const { articleId } = req.params
    try {
        const [arts] = await pool.query('SELECT article_id, user FROM article WHERE article_id = ?', [articleId])
        if (!arts.length) {
            return res.status(404).json({ code: 404, success: false, message: '文章不存在' })
        }
        const result = await likeToggle(articleId, login.id)
        if (result.liked) {
            // 通知作者：XX 点赞了你的文章
            const article = arts[0]
            const [us] = await pool.query('SELECT username FROM user WHERE id = ?', [login.id])
            const actorName = us.length ? (us[0].username || '有人') : '有人'
            await notificationAdd(article.user, login.id, 'like', Number(articleId), `点赞了你的文章 #${articleId}`)
        }
        const count = await likeCountByArticle(articleId)
        res.json({ code: 200, success: true, message: result.liked ? '点赞成功' : '已取消点赞', data: { ...result, count } })
    } catch (error) {
        console.error('点赞操作错误:', error)
        res.status(500).json({ code: 500, success: false, message: '操作失败' })
    }
})

// 查询当前登录用户对文章的点赞/收藏状态（批量：ids 逗号分隔）
router.get('/social/status', async (req, res) => {
    const login = await requireLogin(req, res)
    if (login === null) return
    const { ids } = req.query
    if (!ids) return res.json({ code: 200, success: true, data: { likes: [], favorites: [] } })
    const idArr = String(ids).split(',').map(Number).filter(Boolean)
    if (!idArr.length) return res.json({ code: 200, success: true, data: { likes: [], favorites: [] } })
    try {
        const likes = []
        const favorites = []
        for (const id of idArr) {
            const [lk] = await pool.query('SELECT 1 FROM article_like WHERE article_id = ? AND user_id = ? LIMIT 1', [id, login.id])
            const [fv] = await pool.query('SELECT 1 FROM article_favorite WHERE article_id = ? AND user_id = ? LIMIT 1', [id, login.id])
            if (lk.length) likes.push(id)
            if (fv.length) favorites.push(id)
        }
        res.json({ code: 200, success: true, data: { likes, favorites } })
    } catch (error) {
        console.error('查询点赞收藏状态错误:', error)
        res.status(500).json({ code: 500, success: false, message: '查询失败' })
    }
})

// ================= 收藏 =================

// 收藏 / 取消收藏（toggle）
router.post('/social/favorite/:articleId', async (req, res) => {
    const login = await requireLogin(req, res)
    if (login === null) return
    const { articleId } = req.params
    try {
        const [arts] = await pool.query('SELECT article_id, user FROM article WHERE article_id = ?', [articleId])
        if (!arts.length) {
            return res.status(404).json({ code: 404, success: false, message: '文章不存在' })
        }
        const result = await favoriteToggle(articleId, login.id)
        if (result.favorited) {
            const article = arts[0]
            await notificationAdd(article.user, login.id, 'favorite', Number(articleId), `收藏了你的文章 #${articleId}`)
        }
        const count = await favoriteCountByArticle(articleId)
        res.json({ code: 200, success: true, message: result.favorited ? '收藏成功' : '已取消收藏', data: { ...result, count } })
    } catch (error) {
        console.error('收藏操作错误:', error)
        res.status(500).json({ code: 500, success: false, message: '操作失败' })
    }
})

// 我的收藏列表（私有）
router.get('/social/my-favorites', async (req, res) => {
    const login = await requireLogin(req, res)
    if (login === null) return
    try {
        const list = await favoriteListByUser(login.id)
        res.json({ code: 200, success: true, message: '获取成功', data: { list } })
    } catch (error) {
        console.error('获取收藏列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取失败' })
    }
})

// ================= 互动通知 =================

router.get('/social/notifications', async (req, res) => {
    const login = await requireLogin(req, res)
    if (login === null) return
    const { page, pageSize } = req.query
    try {
        const data = await notificationList(login.id, page, pageSize)
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (error) {
        console.error('获取通知列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取失败' })
    }
})

router.get('/social/notifications/unread-count', async (req, res) => {
    const login = await requireLogin(req, res)
    if (login === null) return
    try {
        const count = await notificationUnreadCount(login.id)
        res.json({ code: 200, success: true, message: '获取成功', data: { count } })
    } catch (error) {
        console.error('获取未读数错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取失败' })
    }
})

router.post('/social/notifications/read', async (req, res) => {
    const login = await requireLogin(req, res)
    if (login === null) return
    const { id, all } = req.body
    try {
        if (all) {
            await notificationReadAll(login.id)
        } else if (id) {
            await notificationRead(id, login.id)
        } else {
            return res.status(400).json({ code: 400, success: false, message: '参数缺失' })
        }
        res.json({ code: 200, success: true, message: '已标记已读' })
    } catch (error) {
        console.error('标记通知已读错误:', error)
        res.status(500).json({ code: 500, success: false, message: '操作失败' })
    }
})

// ================= 后台管理（仅 admin） =================

// 点赞记录列表
router.get('/social/admin/likes', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const { page, pageSize, keyword } = req.query
    try {
        const data = await likeManageList(page, pageSize, keyword)
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (error) {
        console.error('获取点赞记录错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取失败' })
    }
})

// 删除点赞记录
router.delete('/social/admin/likes/:id', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    try {
        await likeManageDelete(req.params.id)
        res.json({ code: 200, success: true, message: '删除成功' })
    } catch (error) {
        console.error('删除点赞记录错误:', error)
        res.status(500).json({ code: 500, success: false, message: '删除失败' })
    }
})

// 收藏记录列表
router.get('/social/admin/favorites', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    const { page, pageSize, keyword } = req.query
    try {
        const data = await favoriteManageList(page, pageSize, keyword)
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (error) {
        console.error('获取收藏记录错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取失败' })
    }
})

// 删除收藏记录
router.delete('/social/admin/favorites/:id', async (req, res) => {
    const admin = await requireAdmin(req, res)
    if (admin === null) return
    try {
        await favoriteManageDelete(req.params.id)
        res.json({ code: 200, success: true, message: '删除成功' })
    } catch (error) {
        console.error('删除收藏记录错误:', error)
        res.status(500).json({ code: 500, success: false, message: '删除失败' })
    }
})

module.exports = router
