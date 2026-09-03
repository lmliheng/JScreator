const { pool } = require('./connect_db')

/**
 * 用户私信（DM）数据层
 * 表：message（sender_id/receiver_id/content/is_read/read_at/created_at）
 */

const msgSend = async (senderId, receiverId, content) => {
    const [result] = await pool.query(
        'INSERT INTO message (sender_id, receiver_id, content) VALUES (?, ?, ?)',
        [senderId, receiverId, String(content).slice(0, 2000)]
    )
    return result.insertId
}

// 两个用户之间的会话消息（双向），倒序取最新一页再翻转成时间正序
const msgConversation = async (userA, userB, page = 1, pageSize = 30) => {
    page = parseInt(page, 10) || 1
    pageSize = parseInt(pageSize, 10) || 30
    const offset = (page - 1) * pageSize
    const [rows] = await pool.query(
        `SELECT id, sender_id, receiver_id, content, is_read, created_at
         FROM message
         WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
        [userA, userB, userB, userA, pageSize, offset]
    )
    rows.reverse()
    return rows
}

// 会话列表：与每个用户最后一条消息 + 未读数
const msgConversationList = async (userId) => {
    const [rows] = await pool.query(
        `SELECT
            m.id, m.sender_id, m.receiver_id, m.content, m.created_at,
            u.username AS other_username, u.name AS other_name, u.avatar AS other_avatar,
            (SELECT COUNT(*) FROM message un WHERE un.receiver_id = ? AND un.sender_id = u.id AND un.is_read = 0) AS unread
         FROM message m
         JOIN (
            SELECT GREATEST(sender_id, receiver_id) AS a, LEAST(sender_id, receiver_id) AS b,
                   MAX(id) AS max_id
            FROM message
            WHERE sender_id = ? OR receiver_id = ?
            GROUP BY a, b
         ) latest ON m.id = latest.max_id
         JOIN user u ON u.id = IF(m.sender_id = ?, m.receiver_id, m.sender_id)
         ORDER BY m.created_at DESC`,
        [userId, userId, userId, userId]
    )
    return rows
}

// 未读总数
const msgUnreadTotal = async (userId) => {
    const [rows] = await pool.query('SELECT COUNT(*) AS c FROM message WHERE receiver_id = ? AND is_read = 0', [userId])
    return rows[0].c
}

// 标记会话已读（对方发给我的全部标已读）
const msgMarkRead = async (userId, otherId) => {
    await pool.query(
        'UPDATE message SET is_read = 1, read_at = NOW() WHERE receiver_id = ? AND sender_id = ? AND is_read = 0',
        [userId, otherId]
    )
}

module.exports = { msgSend, msgConversation, msgConversationList, msgUnreadTotal, msgMarkRead }
