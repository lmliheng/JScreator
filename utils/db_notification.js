const { pool } = require('./connect_db')

/**
 * 通知系统数据库函数
 * 表结构见 docs/conventions.md
 * - notification（通知）
 * - notification_read（已读标记）
 */

/**
 * 插入通知
 * @param {string} title       通知标题
 * @param {string} content     通知内容
 * @param {number} sender_id   发送者（管理员）user id
 * @param {string} target_type 'all' | 'user' | 'role'
 * @param {number|null} target_id target_type='user' 时为 user_id，='role' 时为 role_id
 * @returns {number} 新通知的 notification_id
 */
const notification_add = async (title, content, sender_id, target_type, target_id) => {
    try {
        const sql = 'INSERT INTO notification (title, content, sender_id, target_type, target_id) VALUES (?, ?, ?, ?, ?)'
        const [result] = await pool.query(sql, [title, content, sender_id, target_type, target_id || null])
        return result.insertId
    } catch (error) {
        console.error('插入通知错误:', error)
        throw error
    }
}

/**
 * 查询某用户能收到的通知（含该用户的已读状态）
 * 规则：
 *   - target_type='all' 的
 *   - target_type='user' 且 target_id = user_id 的
 *   - target_type='role' 且 target_id = 该用户 role_id 的
 * @param {number} user_id
 * @returns {Array} 通知列表，每条含 is_read（0/1）
 */
const notification_getForUser = async (user_id) => {
    try {
        const sql = `
            SELECT n.notification_id, n.title, n.content, n.sender_id, n.target_type, n.target_id, n.created_at,
                   COALESCE(nr.is_read, 0) AS is_read
            FROM notification n
            LEFT JOIN notification_read nr
              ON nr.notification_id = n.notification_id AND nr.user_id = ?
            WHERE n.target_type = 'all'
               OR (n.target_type = 'user' AND n.target_id = ?)
               OR (n.target_type = 'role' AND n.target_id = (SELECT role_id FROM user WHERE id = ?))
            ORDER BY n.created_at DESC
        `
        const [rows] = await pool.query(sql, [user_id, user_id, user_id])
        return rows
    } catch (error) {
        console.error('查询用户通知列表错误:', error)
        throw error
    }
}

/**
 * 标记某通知已读（写 notification_read，幂等）
 * @param {number} notification_id
 * @param {number} user_id
 */
const notification_markRead = async (notification_id, user_id) => {
    try {
        const sql = `
            INSERT INTO notification_read (notification_id, user_id, is_read, read_at)
            VALUES (?, ?, 1, NOW())
            ON DUPLICATE KEY UPDATE is_read = 1, read_at = NOW()
        `
        await pool.query(sql, [notification_id, user_id])
        return true
    } catch (error) {
        console.error('标记通知已读错误:', error)
        throw error
    }
}

/**
 * 某用户未读数（能收到但未读的通知数量）
 * @param {number} user_id
 * @returns {number}
 */
const notification_getUnreadCount = async (user_id) => {
    try {
        const sql = `
            SELECT COUNT(*) AS unread_count
            FROM notification n
            LEFT JOIN notification_read nr
              ON nr.notification_id = n.notification_id AND nr.user_id = ?
            WHERE (nr.id IS NULL OR nr.is_read = 0)
              AND (n.target_type = 'all'
                OR (n.target_type = 'user' AND n.target_id = ?)
                OR (n.target_type = 'role' AND n.target_id = (SELECT role_id FROM user WHERE id = ?)))
        `
        const [rows] = await pool.query(sql, [user_id, user_id, user_id])
        return rows[0].unread_count
    } catch (error) {
        console.error('查询用户未读数错误:', error)
        throw error
    }
}

/**
 * 查询某用户的 role_id（用于管理员权限校验）
 * @param {number} user_id
 * @returns {number|null}
 */
const notification_getUserRoleId = async (user_id) => {
    try {
        const sql = 'SELECT role_id FROM user WHERE id = ?'
        const [rows] = await pool.query(sql, [user_id])
        return rows.length === 0 ? null : rows[0].role_id
    } catch (error) {
        console.error('查询用户角色错误:', error)
        throw error
    }
}

module.exports = {
    notification_add,
    notification_getForUser,
    notification_markRead,
    notification_getUnreadCount,
    notification_getUserRoleId
}
