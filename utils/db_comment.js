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
 * 查询某文章评论并组装为树形结构（顶层评论分页 + children 嵌套）
 * - 登录用户评论显示名：name（别名）优先，无则 username；匿名用存储的 nickname
 * - 每条评论带 is_author：评论者是否是该文章作者
 * @param {number} article_id
 * @param {Object} [opts] { page=1, pageSize=20, maxChildren=50 }
 * @returns {{list:Array, total:number, page:number, pageSize:number}}
 */
const comment_getByArticle = async (article_id, { page = 1, pageSize = 20, maxChildren = 50 } = {}) => {
    try {
        // 文章作者 user id（用于作者标志）
        const [aRows] = await pool.query('SELECT `user` FROM article WHERE article_id = ?', [article_id])
        const articleAuthorId = aRows[0] ? aRows[0].user : null

        const sql = `
            SELECT c.comment_id, c.article_id, c.user_id, c.nickname, c.content, c.parent_id, c.created_at,
                   COALESCE(NULLIF(u.name, ''), u.username) AS display_name
            FROM comment c
            LEFT JOIN user u ON u.id = c.user_id
            WHERE c.article_id = ?
            ORDER BY c.created_at ASC, c.comment_id ASC
        `
        const [rows] = await pool.query(sql, [article_id])

        const map = {}
        const roots = []

        // 初始化每条评论，children 默认为空数组
        rows.forEach((row) => {
            row.children = []
            // 显示名：登录用户用 name 优先，无则 username；匿名评论用存的昵称
            if (row.user_id != null && row.display_name) {
                row.nickname = row.display_name
            }
            // 作者标志：评论者就是文章作者
            row.is_author = row.user_id != null && Number(row.user_id) === Number(articleAuthorId)
            delete row.display_name
            map[row.comment_id] = row
        })

        rows.forEach((row) => {
            if (row.parent_id != null && map[row.parent_id]) {
                map[row.parent_id].children.push(row)
            } else {
                roots.push(row)
            }
        })

        // 楼中楼限制数量：保留最新的 maxChildren 条
        roots.forEach((root) => {
            if (root.children.length > maxChildren) {
                root.children = root.children.slice(root.children.length - maxChildren)
            }
        })

        // 顶层评论分页
        const total = roots.length
        const pageNum = Math.max(1, parseInt(page, 10) || 1)
        const size = Math.max(1, parseInt(pageSize, 10) || 20)
        const list = roots.slice((pageNum - 1) * size, pageNum * size)

        return { list, total, page: pageNum, pageSize: size }
    } catch (error) {
        console.error('查询文章评论错误:', error)
        throw error
    }
}

/**
 * 管理员：评论列表（分页 + 按文章/关键词筛选），含文章标题
 */
const comment_manageList = async ({ page = 1, pageSize = 10, article_id, keyword } = {}) => {
    const where = []
    const params = []
    if (article_id) {
        where.push('c.article_id = ?')
        params.push(article_id)
    }
    if (keyword) {
        where.push('(c.content LIKE ? OR c.nickname LIKE ?)')
        params.push(`%${keyword}%`, `%${keyword}%`)
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const countSql = `SELECT COUNT(*) AS total FROM comment c ${whereSql}`
    const [countRows] = await pool.query(countSql, params)
    const total = countRows[0].total

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const size = Math.max(1, parseInt(pageSize, 10) || 10)
    const offset = (pageNum - 1) * size

    const listSql = `
        SELECT c.comment_id, c.article_id, c.user_id, c.nickname, c.content, c.parent_id, c.created_at,
               a.title AS article_title,
               COALESCE(NULLIF(u.name, ''), u.username) AS display_name
        FROM comment c
        LEFT JOIN article a ON a.article_id = c.article_id
        LEFT JOIN user u ON u.id = c.user_id
        ${whereSql}
        ORDER BY c.comment_id DESC
        LIMIT ? OFFSET ?
    `
    const [rows] = await pool.query(listSql, [...params, size, offset])
    return { list: rows, total, page: pageNum, pageSize: size }
}

/**
 * 管理员：更新评论（content / nickname 可选）
 */
const comment_update = async (comment_id, { content, nickname } = {}) => {
    const fields = []
    const params = []
    if (content !== undefined) {
        fields.push('content = ?')
        params.push(String(content))
    }
    if (nickname !== undefined) {
        fields.push('nickname = ?')
        params.push(String(nickname))
    }
    if (!fields.length) return false
    params.push(comment_id)
    await pool.query(`UPDATE comment SET ${fields.join(', ')} WHERE comment_id = ?`, params)
    return true
}

/**
 * 管理员：级联删除评论（含所有楼中楼子评论），返回删除条数
 */
const comment_deleteCascade = async (comment_id) => {
    const toDelete = [Number(comment_id)]
    let frontier = [Number(comment_id)]
    while (frontier.length) {
        const [rows] = await pool.query('SELECT comment_id FROM comment WHERE parent_id IN (?)', [frontier])
        const ids = rows.map((r) => r.comment_id)
        if (!ids.length) break
        toDelete.push(...ids)
        frontier = ids
    }
    await pool.query('DELETE FROM comment WHERE comment_id IN (?)', [toDelete])
    return toDelete.length
}

module.exports = {
    getUsernameById,
    comment_getById,
    comment_add,
    comment_getByArticle,
    comment_manageList,
    comment_update,
    comment_deleteCascade,
}
