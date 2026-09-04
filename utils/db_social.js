const { pool } = require('./connect_db')

/**
 * 社交互动数据层：关注 / 点赞 / 收藏 / 互动通知
 * 表：follow, article_like, article_favorite, user_notification
 */

// ===== 关注 =====

// 关注（唯一约束防重复；INSERT IGNORE 幂等）
const followAdd = async (followerId, followeeId) => {
    if (Number(followerId) === Number(followeeId)) {
        throw new Error('不能关注自己')
    }
    await pool.query('INSERT IGNORE INTO follow (follower_id, followee_id) VALUES (?, ?)', [followerId, followeeId])
}

// 取消关注
const followRemove = async (followerId, followeeId) => {
    await pool.query('DELETE FROM follow WHERE follower_id = ? AND followee_id = ?', [followerId, followeeId])
}

// 是否已关注
const followExists = async (followerId, followeeId) => {
    const [rows] = await pool.query(
        'SELECT id FROM follow WHERE follower_id = ? AND followee_id = ? LIMIT 1',
        [followerId, followeeId]
    )
    return rows.length > 0
}

// 某人的关注列表（含对方公开信息）
const followListByFollower = async (userId) => {
    const [rows] = await pool.query(
        `SELECT u.id, u.username, u.avatar, u.name, u.bio, u.area, f.created_at AS follow_time
         FROM follow f
         JOIN user u ON u.id = f.followee_id
         WHERE f.follower_id = ?
         ORDER BY f.created_at DESC`,
        [userId]
    )
    return rows
}

// 某人的粉丝列表（含对方公开信息）
const followListByFollowee = async (userId) => {
    const [rows] = await pool.query(
        `SELECT u.id, u.username, u.avatar, u.name, u.bio, u.area, f.created_at AS follow_time
         FROM follow f
         JOIN user u ON u.id = f.follower_id
         WHERE f.followee_id = ?
         ORDER BY f.created_at DESC`,
        [userId]
    )
    return rows
}

// 关注数 / 粉丝数
const followStats = async (userId) => {
    const [following] = await pool.query('SELECT COUNT(*) AS c FROM follow WHERE follower_id = ?', [userId])
    const [followers] = await pool.query('SELECT COUNT(*) AS c FROM follow WHERE followee_id = ?', [userId])
    return { following: following[0].c, followers: followers[0].c }
}

// ===== 点赞 =====



// 点赞（已赞则取消，返回新状态）
const likeToggle = async (articleId, userId) => {
    const [rows] = await pool.query(
        'SELECT id FROM article_like WHERE article_id = ? AND user_id = ? LIMIT 1',
        [articleId, userId]
    )
    if (rows.length > 0) {
        await pool.query('DELETE FROM article_like WHERE id = ?', [rows[0].id])
        return { liked: false }
    }
    await pool.query('INSERT INTO article_like (article_id, user_id) VALUES (?, ?)', [articleId, userId])
    return { liked: true }
}



// 是否已赞
const likeExists = async (articleId, userId) => {
    const [rows] = await pool.query(
        'SELECT id FROM article_like WHERE article_id = ? AND user_id = ? LIMIT 1',
        [articleId, userId]
    )
    return rows.length > 0
}



// 文章点赞数
const likeCountByArticle = async (articleId) => {
    const [rows] = await pool.query('SELECT COUNT(*) AS c FROM article_like WHERE article_id = ?', [articleId])
    return rows[0].c
}



// 某用户收到的全部点赞数（其文章获赞总数）
const likeCountReceived = async (userId) => {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS c FROM article_like al
         JOIN article a ON a.article_id = al.article_id
         WHERE a.user = ?`,
        [userId]
    )
    return rows[0].c
}

// 全站点赞记录（后台管理，分页 + 关键词搜索文章标题/用户名）
const likeManageList = async (page = 1, pageSize = 10, keyword = '') => {
    page = parseInt(page, 10) || 1
    pageSize = parseInt(pageSize, 10) || 10
    if (page < 1) page = 1
    if (pageSize < 1) pageSize = 10
    const offset = (page - 1) * pageSize

    const where = ['1=1']
    const params = []
    if (keyword) {
        where.push('(a.title LIKE ? OR u.username LIKE ?)')
        params.push(`%${keyword}%`, `%${keyword}%`)
    }
    const whereSql = 'WHERE ' + where.join(' AND ')

    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM article_like al
         JOIN article a ON a.article_id = al.article_id
         JOIN user u ON u.id = al.user_id
         ${whereSql}`,
        params
    )
    const total = countRows[0].total

    const [rows] = await pool.query(
        `SELECT al.id, al.article_id, a.title AS article_title, a.user AS author_id,
                u.username AS username, u.name AS nickname, al.created_at
         FROM article_like al
         JOIN article a ON a.article_id = al.article_id
         JOIN user u ON u.id = al.user_id
         ${whereSql}
         ORDER BY al.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
    )
    return { list: rows, total, page, pageSize }
}



// 删除点赞记录
const likeManageDelete = async (id) => {
    await pool.query('DELETE FROM article_like WHERE id = ?', [id])
}



// ===== 收藏 =====

const favoriteToggle = async (articleId, userId) => {
    const [rows] = await pool.query(
        'SELECT id FROM article_favorite WHERE article_id = ? AND user_id = ? LIMIT 1',
        [articleId, userId]
    )
    if (rows.length > 0) {
        await pool.query('DELETE FROM article_favorite WHERE id = ?', [rows[0].id])
        return { favorited: false }
    }
    await pool.query('INSERT INTO article_favorite (article_id, user_id) VALUES (?, ?)', [articleId, userId])
    return { favorited: true }
}

const favoriteExists = async (articleId, userId) => {
    const [rows] = await pool.query(
        'SELECT id FROM article_favorite WHERE article_id = ? AND user_id = ? LIMIT 1',
        [articleId, userId]
    )
    return rows.length > 0
}

const favoriteCountByArticle = async (articleId) => {
    const [rows] = await pool.query('SELECT COUNT(*) AS c FROM article_favorite WHERE article_id = ?', [articleId])
    return rows[0].c
}

// 我的收藏列表（只取已发布文章，带分类）
const favoriteListByUser = async (userId) => {
    const [rows] = await pool.query(
        `SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                u.username AS author_name, a.created_at, a.updated_at,
                af.created_at AS favorited_at,
                GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
         FROM article_favorite af
         JOIN article a ON a.article_id = af.article_id AND a.status = 1
         JOIN user u ON a.user = u.id
         LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
         LEFT JOIN article_category ac ON ac.category_id = acm.category_id
         WHERE af.user_id = ?
         GROUP BY a.article_id, a.title, a.content, a.status, a.user, u.username, a.created_at, a.updated_at, af.created_at
         ORDER BY af.created_at DESC`,
        [userId]
    )
    return rows.map((r) => ({
        ...r,
        category_ids: r.category_ids ? String(r.category_ids).split(',').map(Number) : [],
        category_names: r.category_names ? String(r.category_names).split(',') : [],
    }))
}

// 全站收藏记录（后台管理）
const favoriteManageList = async (page = 1, pageSize = 10, keyword = '') => {
    page = parseInt(page, 10) || 1
    pageSize = parseInt(pageSize, 10) || 10
    if (page < 1) page = 1
    if (pageSize < 1) pageSize = 10
    const offset = (page - 1) * pageSize

    const where = ['1=1']
    const params = []
    if (keyword) {
        where.push('(a.title LIKE ? OR u.username LIKE ?)')
        params.push(`%${keyword}%`, `%${keyword}%`)
    }
    const whereSql = 'WHERE ' + where.join(' AND ')

    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM article_favorite af
         JOIN article a ON a.article_id = af.article_id
         JOIN user u ON u.id = af.user_id
         ${whereSql}`,
        params
    )
    const total = countRows[0].total

    const [rows] = await pool.query(
        `SELECT af.id, af.article_id, a.title AS article_title, a.user AS author_id,
                u.username AS username, u.name AS nickname, af.created_at
         FROM article_favorite af
         JOIN article a ON a.article_id = af.article_id
         JOIN user u ON u.id = af.user_id
         ${whereSql}
         ORDER BY af.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
    )
    return { list: rows, total, page, pageSize }
}

const favoriteManageDelete = async (id) => {
    await pool.query('DELETE FROM article_favorite WHERE id = ?', [id])
}

// ===== 互动通知 =====

const notificationAdd = async (userId, actorId, type, articleId = null, content = '') => {
    // 不给自己发通知
    if (Number(userId) === Number(actorId)) return
    await pool.query(
        'INSERT INTO user_notification (user_id, actor_id, type, article_id, content) VALUES (?, ?, ?, ?, ?)',
        [userId, actorId, type, articleId, content]
    )
}

const notificationList = async (userId, page = 1, pageSize = 20) => {
    page = parseInt(page, 10) || 1
    pageSize = parseInt(pageSize, 10) || 20
    if (page < 1) page = 1
    if (pageSize < 1) pageSize = 20
    const offset = (page - 1) * pageSize

    const [countRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM user_notification WHERE user_id = ?',
        [userId]
    )
    const total = countRows[0].total

    const [rows] = await pool.query(
        `SELECT n.id, n.type, n.article_id, n.content, n.is_read, n.created_at,
                u.username AS actor_username, u.name AS actor_name, u.avatar AS actor_avatar
         FROM user_notification n
         JOIN user u ON u.id = n.actor_id
         WHERE n.user_id = ?
         ORDER BY n.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, pageSize, offset]
    )
    return { list: rows, total, page, pageSize }
}

const notificationUnreadCount = async (userId) => {
    const [rows] = await pool.query(
        'SELECT COUNT(*) AS c FROM user_notification WHERE user_id = ? AND is_read = 0',
        [userId]
    )
    return rows[0].c
}

const notificationRead = async (id, userId) => {
    await pool.query('UPDATE user_notification SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?', [id, userId])
}

const notificationReadAll = async (userId) => {
    await pool.query('UPDATE user_notification SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0', [userId])
}

module.exports = {
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
}
