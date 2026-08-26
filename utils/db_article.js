const { pool } = require('./connect_db')

/**
 * 博客文章 / 分类 数据层（按实际表结构实现，不修改 utils/db_curd.js）
 *
 * 实际表结构（见 asset/sql/5-8 最新导出）：
 *   article: article_id, title, content, user(创建用户ID), status(0草稿/1发布/2仅自己可见), created_at, updated_at
 *   article_category: category_id, category_name, created_at, updated_at, user
 *   articleandcategory_middle: id, article_id, category_id
 *   role: role_id, role_name   (当前库: 1=超级管理员, 2=普通用户, 3=编辑)
 */

/**
 * 查询用户角色信息（含 username / role_id / role_name）
 */
const getUserRoleById = async (user_id) => {
    try {
        const sql = `
            SELECT u.id, u.username, u.role_id, r.role_name
            FROM user u
            LEFT JOIN role r ON u.role_id = r.role_id
            WHERE u.id = ?
        `
        const [rows] = await pool.query(sql, [user_id])
        return rows[0] || null
    } catch (error) {
        console.error('查询用户角色错误:', error)
        throw error
    }
}

/**
 * 是否 admin 或 editor。
 * 说明：用 role_name 判断而非写死 role_id，以兼容「conventions.md 中 admin=1/editor=2」
 * 与「当前库实际 admin=1(超级管理员)/editor=3(编辑)」两种命名/编号，避免误授权。
 */
const isAdminOrEditor = async (user_id) => {
    const role = await getUserRoleById(user_id)
    if (!role) return false
    const name = String(role.role_name || '').trim()
    return ['admin', 'editor', '超级管理员', '编辑'].includes(name)
}

/**
 * 按 id 查询文章原始行（含 user 列，用于鉴权判断作者）
 */
const article_getById = async (article_id) => {
    try {
        const sql = 'SELECT * FROM article WHERE article_id = ?'
        const [rows] = await pool.query(sql, [article_id])
        return rows[0] || null
    } catch (error) {
        console.error('查询文章错误:', error)
        throw error
    }
}

/**
 * 查询某文章的分类（category_id / category_name）
 */
const article_getCategories = async (article_id) => {
    try {
        const sql = `
            SELECT ac.category_id, ac.category_name
            FROM articleandcategory_middle acm
            JOIN article_category ac ON ac.category_id = acm.category_id
            WHERE acm.article_id = ?
            ORDER BY ac.category_id ASC
        `
        const [rows] = await pool.query(sql, [article_id])
        return rows
    } catch (error) {
        console.error('查询文章分类错误:', error)
        throw error
    }
}

/**
 * 组装分类字段，把 GROUP_CONCAT 的字符串转为数组
 */
const attachCategoryArrays = (row) => {
    return {
        ...row,
        category_ids: row.category_ids ? String(row.category_ids).split(',').map(Number) : [],
        category_names: row.category_names ? String(row.category_names).split(',') : [],
    }
}

/**
 * 公开文章列表（分页 + 按分类 + 关键词，仅 status=1 已发布）
 */
const article_list = async ({ page = 1, pageSize = 10, category_id, keyword, status, author } = {}) => {
    page = parseInt(page, 10) || 1
    pageSize = parseInt(pageSize, 10) || 10
    if (page < 1) page = 1
    if (pageSize < 1) pageSize = 10
    const offset = (page - 1) * pageSize

    const where = []
    const params = []

    // status: 不传/空 = 仅已发布(1)；'all' = 全部状态；具体数字 = 筛选该状态
    if (status === undefined || status === '' || status === null) {
        where.push('a.status = 1')
    } else if (status !== 'all') {
        where.push('a.status = ?')
        params.push(Number(status))
    }

    if (keyword) {
        where.push('(a.title LIKE ? OR a.content LIKE ?)')
        params.push(`%${keyword}%`, `%${keyword}%`)
    }
    if (author) {
        where.push('EXISTS (SELECT 1 FROM user u WHERE u.id = a.user AND (u.name LIKE ? OR u.username LIKE ?))')
        params.push(`%${author}%`, `%${author}%`)
    }
    if (category_id) {
        where.push('EXISTS (SELECT 1 FROM articleandcategory_middle acm WHERE acm.article_id = a.article_id AND acm.category_id = ?)')
        params.push(category_id)
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''

    try {
        const countSql = `SELECT COUNT(DISTINCT a.article_id) AS total FROM article a ${whereSql}`
        const [countRows] = await pool.query(countSql, params)
        const total = countRows[0].total

        const listSql = `
            SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                   COALESCE(NULLIF(u.name, ''), u.username) AS author_name, a.created_at, a.updated_at,
                   COUNT(DISTINCT al.id) AS like_count,
                   COUNT(DISTINCT af.id) AS favorite_count,
                   GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                   GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
            FROM article a
            LEFT JOIN user u ON a.user = u.id
            LEFT JOIN article_like al ON al.article_id = a.article_id
            LEFT JOIN article_favorite af ON af.article_id = a.article_id
            LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
            LEFT JOIN article_category ac ON ac.category_id = acm.category_id
            ${whereSql}
            GROUP BY a.article_id, a.title, a.content, a.status, a.user, COALESCE(NULLIF(u.name, ''), u.username), a.created_at, a.updated_at
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `
        const [rows] = await pool.query(listSql, [...params, pageSize, offset])
        const list = rows.map((r) => ({
            ...attachCategoryArrays(r),
            like_count: Number(r.like_count) || 0,
            favorite_count: Number(r.favorite_count) || 0,
        }))
        return { list, total, page, pageSize }
    } catch (error) {
        console.error('查询文章列表错误:', error)
        throw error
    }
}

/**
 * 文章详情（含作者、分类、正文）
 */
const article_detail = async (article_id) => {
    try {
        const sql = `
            SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                   COALESCE(NULLIF(u.name, ''), u.username) AS author_name,
                   u.username AS author_username,
                   u.avatar AS author_avatar,
                   u.bio AS author_bio,
                   a.created_at, a.updated_at
            FROM article a
            LEFT JOIN user u ON a.user = u.id
            WHERE a.article_id = ?
        `
        const [rows] = await pool.query(sql, [article_id])
        const article = rows[0]
        if (!article) return null
        const cats = await article_getCategories(article_id)
        article.category_ids = cats.map(c => c.category_id)
        article.category_names = cats.map(c => c.category_name)
        return article
    } catch (error) {
        console.error('查询文章详情错误:', error)
        throw error
    }
}

/**
 * 新增文章，返回 article_id
 */
const article_add = async ({ user_id, title, content, status = 1, category_ids = [] }) => {
    try {
        const sql = 'INSERT INTO article (title, content, user, status) VALUES (?, ?, ?, ?)'
        const [result] = await pool.query(sql, [title, content, user_id, status])
        const article_id = result.insertId
        await article_setCategories(article_id, category_ids)
        return article_id
    } catch (error) {
        console.error('添加文章错误:', error)
        throw error
    }
}

/**
 * 给文章设置分类（写入中间表，去重）
 */
const article_setCategories = async (article_id, category_ids) => {
    const uniqueIds = [...new Set((Array.isArray(category_ids) ? category_ids : []).map(Number).filter(Boolean))]
    for (const category_id of uniqueIds) {
        await pool.query('INSERT INTO articleandcategory_middle (article_id, category_id) VALUES (?, ?)', [article_id, category_id])
    }
    return true
}

/**
 * 更新文章（字段可选，分类传入时整体替换）
 */
const article_update = async (article_id, { title, content, status, category_ids } = {}) => {
    try {
        const fields = []
        const params = []
        if (title !== undefined) { fields.push('title = ?'); params.push(title) }
        if (content !== undefined) { fields.push('content = ?'); params.push(content) }
        if (status !== undefined) { fields.push('status = ?'); params.push(status) }

        if (fields.length > 0) {
            params.push(article_id)
            await pool.query(`UPDATE article SET ${fields.join(', ')} WHERE article_id = ?`, params)
        }
        if (category_ids !== undefined) {
            await pool.query('DELETE FROM articleandcategory_middle WHERE article_id = ?', [article_id])
            await article_setCategories(article_id, category_ids)
        }
        return true
    } catch (error) {
        console.error('更新文章错误:', error)
        throw error
    }
}

/**
 * 删除文章（中间表通过外键 ON DELETE CASCADE 级联删除；评论无外键，先手动清掉该文章评论，避免孤儿数据）
 */
const article_delete = async (article_id) => {
    try {
        await pool.query('DELETE FROM comment WHERE article_id = ?', [article_id])
        await pool.query('DELETE FROM article WHERE article_id = ?', [article_id])
        return true
    } catch (error) {
        console.error('删除文章错误:', error)
        throw error
    }
}

/**
 * 当前用户自己的文章列表（分页，含草稿/仅自己可见）
 */
const article_mine = async (user_id, page = 1, pageSize = 10) => {
    page = parseInt(page, 10) || 1
    pageSize = parseInt(pageSize, 10) || 10
    if (page < 1) page = 1
    if (pageSize < 1) pageSize = 10
    const offset = (page - 1) * pageSize

    try {
        const countSql = 'SELECT COUNT(*) AS total FROM article WHERE user = ?'
        const [countRows] = await pool.query(countSql, [user_id])
        const total = countRows[0].total

        const listSql = `
            SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                   COALESCE(NULLIF(u.name, ''), u.username) AS author_name, a.created_at, a.updated_at,
                   GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                   GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
            FROM article a
            LEFT JOIN user u ON a.user = u.id
            LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
            LEFT JOIN article_category ac ON ac.category_id = acm.category_id
            WHERE a.user = ?
            GROUP BY a.article_id, a.title, a.content, a.status, a.user, COALESCE(NULLIF(u.name, ''), u.username), a.created_at, a.updated_at
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `
        const [rows] = await pool.query(listSql, [user_id, pageSize, offset])
        const list = rows.map(attachCategoryArrays)
        return { list, total, page, pageSize }
    } catch (error) {
        console.error('查询本人文章列表错误:', error)
        throw error
    }
}

/**
 * 归档：公开文章平铺列表（可选按 username 过滤），按时间倒序，供前端按年月分组
 */
const article_archive = async (username) => {
    try {
        let sql = `
            SELECT a.article_id, a.title, a.created_at,
                   COALESCE(NULLIF(u.name, ''), u.username) AS author_name,
                   u.username AS author_username,
                   GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
            FROM article a
            LEFT JOIN user u ON a.user = u.id
            LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
            LEFT JOIN article_category ac ON ac.category_id = acm.category_id
            WHERE a.status = 1
        `
        const params = []
        if (username) {
            sql += ' AND u.username = ?'
            params.push(username)
        }
        sql += `
            GROUP BY a.article_id, a.title, a.created_at, COALESCE(NULLIF(u.name, ''), u.username), u.username
            ORDER BY a.created_at DESC
        `
        const [rows] = await pool.query(sql, params)
        return rows
    } catch (error) {
        console.error('查询归档文章错误:', error)
        throw error
    }
}

/**
 * 按 id 查询分类原始行（含 user 列，用于鉴权判断归属）
 */
const category_getById = async (category_id) => {
    try {
        const sql = 'SELECT * FROM article_category WHERE category_id = ?'
        const [rows] = await pool.query(sql, [category_id])
        return rows[0] || null
    } catch (error) {
        console.error('查询分类错误:', error)
        throw error
    }
}

/**
 * 更新分类（不限制归属，供 admin/editor 使用）
 */
const category_updateAny = async (category_id, category_name) => {
    try {
        await pool.query('UPDATE article_category SET category_name = ? WHERE category_id = ?', [category_name, category_id])
        return true
    } catch (error) {
        console.error('更新分类错误:', error)
        throw error
    }
}

/**
 * 删除分类（不限制归属，供 admin/editor 使用）
 */
const category_deleteAny = async (category_id) => {
    try {
        await pool.query('DELETE FROM article_category WHERE category_id = ?', [category_id])
        return true
    } catch (error) {
        console.error('删除分类错误:', error)
        throw error
    }
}

module.exports = {
    getUserRoleById,
    isAdminOrEditor,
    article_getById,
    article_list,
    article_detail,
    article_add,
    article_update,
    article_delete,
    article_mine,
    article_archive,
    category_getById,
    category_updateAny,
    category_deleteAny,
}
