const { pool } = require('./connect_db')

/**
 * 站点公告数据层
 * 表：announcement（title/content/status/created_at）
 */

// 最新一条启用公告（公开展示用）
const announceGetLatest = async () => {
    const [rows] = await pool.query(
        `SELECT id, title, content, created_at
         FROM announcement
         WHERE status = 1
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
    )
    return rows[0] || null
}

// 管理端列表（分页 + 关键词 + 状态筛选）
const announceManageList = async (page = 1, pageSize = 10, keyword = '', status = '') => {
    page = parseInt(page, 10) || 1
    pageSize = parseInt(pageSize, 10) || 10
    if (page < 1) page = 1
    if (pageSize < 1) pageSize = 10
    const offset = (page - 1) * pageSize

    const where = ['1=1']
    const params = []
    if (keyword) {
        where.push('title LIKE ?')
        params.push(`%${keyword}%`)
    }
    if (status === '0' || status === '1') {
        where.push('status = ?')
        params.push(Number(status))
    }
    const whereSql = 'WHERE ' + where.join(' AND ')

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM announcement ${whereSql}`, params)
    const total = countRows[0].total

    const [rows] = await pool.query(
        `SELECT id, title, content, status, created_at, updated_at
         FROM announcement
         ${whereSql}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
    )
    return { list: rows, total, page, pageSize }
}

// 新增
const announceAdd = async (title, content) => {
    const [result] = await pool.query(
        'INSERT INTO announcement (title, content) VALUES (?, ?)',
        [title, content]
    )
    return result.insertId
}

// 更新
const announceUpdate = async (id, title, content) => {
    await pool.query(
        'UPDATE announcement SET title = ?, content = ? WHERE id = ?',
        [title, content, id]
    )
}

// 启停
const announceSetStatus = async (id, status) => {
    await pool.query('UPDATE announcement SET status = ? WHERE id = ?', [Number(status) ? 1 : 0, id])
}

// 删除
const announceDelete = async (id) => {
    await pool.query('DELETE FROM announcement WHERE id = ?', [id])
}

module.exports = {
    announceGetLatest,
    announceManageList,
    announceAdd,
    announceUpdate,
    announceSetStatus,
    announceDelete,
}
