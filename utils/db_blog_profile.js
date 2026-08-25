const { pool } = require('./connect_db')

/**
 * 博客主页 / 用户公开信息数据层（独立文件，不改动 db_curd.js / db_article.js）
 *
 * user 表字段（以实际库为准）：
 *   id, username, email, avatar, bio, vip, checkinDay, name, area, password, created_at, updated_at, role_id
 * article 表字段：
 *   article_id, title, content, user(创建用户ID), status(0草稿/1发布/2仅自己可见), created_at, updated_at
 * 分类通过 articleandcategory_middle 多对多关联 article_category
 */

/**
 * 组装分类字段，把 GROUP_CONCAT 的字符串转为数组（与 db_article.js 保持一致）
 */
const attachCategoryArrays = (row) => {
    return {
        ...row,
        category_ids: row.category_ids ? String(row.category_ids).split(',').map(Number) : [],
        category_names: row.category_names ? String(row.category_names).split(',') : [],
    }
}

/**
 * 按 username 查用户公开信息。
 * 只返回公开字段，不含 password / email 等敏感字段。
 * 返回 null 表示用户不存在。
 *
 * @param {string} username
 * @returns {Promise<object|null>} { id, username, avatar, bio, name, area, vip, created_at }
 */
const getUserPublicByUsername = async (username) => {
    try {
        const sql = `
            SELECT id, username, avatar, bio, name, area, vip, created_at
            FROM user
            WHERE username = ?
        `
        const [rows] = await pool.query(sql, [username])
        return rows[0] || null
    } catch (error) {
        console.error('查询用户公开信息错误:', error)
        throw error
    }
}

/**
 * 查某用户名下已发布（status=1）的文章列表（分页 + total，按 created_at 倒序）。
 *
 * @param {string} username
 * @param {number} [page=1]
 * @param {number} [pageSize=10]
 * @returns {Promise<{list: object[], total: number, page: number, pageSize: number}>}
 */
const getArticlesByUsername = async (username, page = 1, pageSize = 10) => {
    page = parseInt(page, 10) || 1
    pageSize = parseInt(pageSize, 10) || 10
    if (page < 1) page = 1
    if (pageSize < 1) pageSize = 10
    const offset = (page - 1) * pageSize

    try {
        const countSql = `
            SELECT COUNT(*) AS total
            FROM article a
            JOIN user u ON a.user = u.id
            WHERE u.username = ? AND a.status = 1
        `
        const [countRows] = await pool.query(countSql, [username])
        const total = countRows[0].total

        const listSql = `
            SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                   u.username AS author_name, a.created_at, a.updated_at,
                   GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                   GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
            FROM article a
            JOIN user u ON a.user = u.id
            LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
            LEFT JOIN article_category ac ON ac.category_id = acm.category_id
            WHERE u.username = ? AND a.status = 1
            GROUP BY a.article_id, a.title, a.content, a.status, a.user, u.username, a.created_at, a.updated_at
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `
        const [rows] = await pool.query(listSql, [username, pageSize, offset])
        const list = rows.map(attachCategoryArrays)
        return { list, total, page, pageSize }
    } catch (error) {
        console.error('查询用户文章列表错误:', error)
        throw error
    }
}

/**
 * 查询所有「有已发布文章」的用户列表（公开信息 + 文章数），用于博客首页展示用户主页入口。
 */
const getUserList = async (page = 1, pageSize = 24) => {
    page = parseInt(page, 10) || 1
    pageSize = parseInt(pageSize, 10) || 24
    if (page < 1) page = 1
    if (pageSize < 1) pageSize = 24
    const offset = (page - 1) * pageSize

    try {
        const countSql = `
            SELECT COUNT(DISTINCT u.id) AS total
            FROM user u
            JOIN article a ON a.user = u.id AND a.status = 1
        `
        const [countRows] = await pool.query(countSql)
        const total = countRows[0].total

        const listSql = `
            SELECT u.id, u.username, u.avatar, u.bio, u.name, u.area, u.vip, u.created_at,
                   COUNT(a.article_id) AS article_count
            FROM user u
            JOIN article a ON a.user = u.id AND a.status = 1
            GROUP BY u.id, u.username, u.avatar, u.bio, u.name, u.area, u.vip, u.created_at
            ORDER BY article_count DESC, u.created_at DESC
            LIMIT ? OFFSET ?
        `
        const [rows] = await pool.query(listSql, [pageSize, offset])
        return { list: rows, total, page, pageSize }
    } catch (error) {
        console.error('查询用户列表错误:', error)
        throw error
    }
}

module.exports = {
    getUserPublicByUsername,
    getArticlesByUsername,
    getUserList,
}
