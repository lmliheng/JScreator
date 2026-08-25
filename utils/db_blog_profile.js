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
 * @returns {Promise<object|null>} { id, username, avatar, bio, name, area, vip, created_at, socials, featured_articles, github_id }
 */
const getUserPublicByUsername = async (username) => {
    try {
        const sql = `
            SELECT id, username, avatar, bio, name, area, vip, created_at, socials, featured_articles, github_id
            FROM user
            WHERE username = ?
        `
        const [rows] = await pool.query(sql, [username])
        const row = rows[0] || null
        if (row) {
            // mysql2 对 JSON 列会自动解析为数组/对象；兼容字符串情况
            const parseJson = (v) => {
                if (Array.isArray(v)) return v
                if (typeof v === 'string' && v) {
                    try { return JSON.parse(v) } catch (e) { return [] }
                }
                return []
            }
            row.socials = parseJson(row.socials)
            row.featured_articles = parseJson(row.featured_articles)
        }
        return row
    } catch (error) {
        console.error('查询用户公开信息错误:', error)
        throw error
    }
}

/**
 * 按文章 id 数组查已发布文章（保持传入顺序），用于主页精选文章
 * @param {number[]} ids
 * @returns {Promise<object[]>}
 */
const getArticlesByIds = async (ids) => {
    if (!Array.isArray(ids) || !ids.length) return []
    const unique = [...new Set(ids.map(Number).filter(Boolean))]
    const placeholders = unique.map(() => '?').join(',')
    try {
        const sql = `
            SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                   u.username AS author_name, a.created_at, a.updated_at,
                   GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                   GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
            FROM article a
            JOIN user u ON a.user = u.id
            LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
            LEFT JOIN article_category ac ON ac.category_id = acm.category_id
            WHERE a.article_id IN (${placeholders}) AND a.status = 1
            GROUP BY a.article_id, a.title, a.content, a.status, a.user, u.username, a.created_at, a.updated_at
        `
        const [rows] = await pool.query(sql, unique)
        const map = {}
        rows.forEach((r) => { map[r.article_id] = attachCategoryArrays(r) })
        // 按传入 id 顺序返回
        return unique.map((id) => map[id]).filter(Boolean)
    } catch (error) {
        console.error('按 id 查询文章错误:', error)
        throw error
    }
}

/**
 * 查某用户名下已发布（status=1）的文章列表（分页 + total）。
 * 支持 keyword（标题模糊）、category_id（分类筛选）、sort（desc 最新 / asc 最早）。
 *
 * @param {string} username
 * @param {number} [page=1]
 * @param {number} [pageSize=10]
 * @param {Object} [opts] { keyword, category_id, sort }
 * @returns {Promise<{list: object[], total: number, page: number, pageSize: number}>}
 */
const getArticlesByUsername = async (username, page = 1, pageSize = 10, { keyword, category_id, sort } = {}) => {
    page = parseInt(page, 10) || 1
    pageSize = parseInt(pageSize, 10) || 10
    if (page < 1) page = 1
    if (pageSize < 1) pageSize = 10
    const offset = (page - 1) * pageSize

    const where = ['u.username = ?', 'a.status = 1']
    const params = [username]
    if (keyword) {
        where.push('a.title LIKE ?')
        params.push(`%${keyword}%`)
    }
    if (category_id) {
        where.push('EXISTS (SELECT 1 FROM articleandcategory_middle acm2 WHERE acm2.article_id = a.article_id AND acm2.category_id = ?)')
        params.push(category_id)
    }
    const whereSql = 'WHERE ' + where.join(' AND ')
    const orderBy = sort === 'asc' ? 'a.created_at ASC' : 'a.created_at DESC'

    try {
        const countSql = `
            SELECT COUNT(*) AS total
            FROM article a
            JOIN user u ON a.user = u.id
            ${whereSql}
        `
        const [countRows] = await pool.query(countSql, params)
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
            ${whereSql}
            GROUP BY a.article_id, a.title, a.content, a.status, a.user, u.username, a.created_at, a.updated_at
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `
        const [rows] = await pool.query(listSql, [...params, pageSize, offset])
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
    getArticlesByIds,
}
