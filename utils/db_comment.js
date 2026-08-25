const { pool } = require('./connect_db')

/**
 * 评论数据层（独立文件，不修改 utils/db_curd.js）
 *
 * comment 表结构（见 docs/conventions.md，由 Agent 1 建表）：
 *   comment_id, article_id, user_id(NULL=匿名), nickname, content, parent_id(NULL=顶层), created_at
 */

/**
 * 按 id 查询用户名（登录用户评论时用 username 作为昵称）
 */
const getUsernameById = async (user_id) => {
    try {
        const sql = 'SELECT username FROM user WHERE id = ?'
        const [rows] = await pool.query(sql, [user_id])
        return rows[0] ? rows[0].username : null
    } catch (error) {
        console.error('查询用户名错误:', error)
        throw error
    }
}

/**
 * 按 id 查询单条评论（用于校验 parent_id 是否属于同一文章）
 */
const comment_getById = async (comment_id) => {
    try {
        const sql = 'SELECT * FROM comment WHERE comment_id = ?'
        const [rows] = await pool.query(sql, [comment_id])
        return rows[0] || null
    } catch (error) {
        console.error('查询评论错误:', error)
        throw error
    }
}

/**
 * 新增评论，返回 comment_id
 * @param {Object} param0
 * @param {number} param0.article_id 文章 id
 * @param {number|null} param0.user_id 登录用户 id，匿名传 null
 * @param {string|null} param0.nickname 昵称（登录用户用 username，匿名必填）
 * @param {string} param0.content 评论内容
 * @param {number|null} param0.parent_id 父评论 id，顶层传 null
 */
const comment_add = async ({ article_id, user_id = null, nickname = null, content, parent_id = null }) => {
    try {
        const sql = 'INSERT INTO comment (article_id, user_id, nickname, content, parent_id) VALUES (?, ?, ?, ?, ?)'
        const [result] = await pool.query(sql, [article_id, user_id, nickname, content, parent_id])
        return result.insertId
    } catch (error) {
        console.error('添加评论错误:', error)
        throw error
    }
}

/**
 * 查询某文章全部评论并组装为树形结构（顶层评论 + children 嵌套）
 * @param {number} article_id
 * @returns {Array} 顶层评论数组，每条含 children
 */
const comment_getByArticle = async (article_id) => {
    try {
        const sql = `
            SELECT comment_id, article_id, user_id, nickname, content, parent_id, created_at
            FROM comment
            WHERE article_id = ?
            ORDER BY created_at ASC, comment_id ASC
        `
        const [rows] = await pool.query(sql, [article_id])

        const map = {}
        const roots = []

        // 初始化每条评论，children 默认为空数组
        rows.forEach((row) => {
            row.children = []
            map[row.comment_id] = row
        })

        rows.forEach((row) => {
            if (row.parent_id != null && map[row.parent_id]) {
                map[row.parent_id].children.push(row)
            } else {
                roots.push(row)
            }
        })

        return roots
    } catch (error) {
        console.error('查询文章评论错误:', error)
        throw error
    }
}

module.exports = {
    getUsernameById,
    comment_getById,
    comment_add,
    comment_getByArticle,
}
