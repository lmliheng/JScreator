const { pool } = require('./connect_db')

/**
 * 广告数据层：管理员手动发布的广告
 * 表：ad（title/type/image_url/text_title/text_desc/link_url/position/sort_order/status/click_count）
 */

// 某位置排序最靠前的启用广告（公开展示用）
const adGetByPosition = async (position) => {
    const [rows] = await pool.query(
        `SELECT id, title, type, image_url, text_title, text_desc, link_url, position, click_count
         FROM ad
         WHERE position = ? AND status = 1
         ORDER BY sort_order ASC, id ASC
         LIMIT 1`,
        [position]
    )
    return rows[0] || null
}

// 点击统计 +1（返回是否成功，供跳转前调用）
const adIncrementClick = async (id) => {
    const [result] = await pool.query('UPDATE ad SET click_count = click_count + 1 WHERE id = ?', [id])
    return result.affectedRows > 0
}

// 管理端列表（分页 + 关键词搜索标题 + 位置筛选）
const adManageList = async (page = 1, pageSize = 10, keyword = '', position = '') => {
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
    if (position) {
        where.push('position = ?')
        params.push(position)
    }
    const whereSql = 'WHERE ' + where.join(' AND ')

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ad ${whereSql}`, params)
    const total = countRows[0].total

    const [rows] = await pool.query(
        `SELECT id, title, type, image_url, text_title, text_desc, link_url,
                position, sort_order, status, click_count, created_at, updated_at
         FROM ad
         ${whereSql}
         ORDER BY sort_order ASC, id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
    )
    return { list: rows, total, page, pageSize }
}

// 新增广告
const adAdd = async (data) => {
    const {
        title, type = 'image', image_url = '', text_title = '', text_desc = '',
        link_url = '', position = 'article_top', sort_order = 0, status = 1,
    } = data
    const [result] = await pool.query(
        `INSERT INTO ad (title, type, image_url, text_title, text_desc, link_url, position, sort_order, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, type, image_url, text_title, text_desc, link_url, position, Number(sort_order) || 0, Number(status) ? 1 : 0]
    )
    return result.insertId
}

// 更新广告
const adUpdate = async (id, data) => {
    const {
        title, type = 'image', image_url = '', text_title = '', text_desc = '',
        link_url = '', position = 'article_top', sort_order = 0, status = 1,
    } = data
    await pool.query(
        `UPDATE ad
         SET title = ?, type = ?, image_url = ?, text_title = ?, text_desc = ?,
             link_url = ?, position = ?, sort_order = ?, status = ?
         WHERE id = ?`,
        [title, type, image_url, text_title, text_desc, link_url, position, Number(sort_order) || 0, Number(status) ? 1 : 0, id]
    )
}

// 启停切换
const adSetStatus = async (id, status) => {
    await pool.query('UPDATE ad SET status = ? WHERE id = ?', [Number(status) ? 1 : 0, id])
}

// 删除
const adDelete = async (id) => {
    await pool.query('DELETE FROM ad WHERE id = ?', [id])
}

// 按 id 查单条（编辑回显）
const adGetById = async (id) => {
    const [rows] = await pool.query('SELECT * FROM ad WHERE id = ?', [id])
    return rows[0] || null
}

module.exports = {
    adGetByPosition,
    adIncrementClick,
    adManageList,
    adAdd,
    adUpdate,
    adSetStatus,
    adDelete,
    adGetById,
}
