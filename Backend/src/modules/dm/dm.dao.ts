/**
 * modules/dm/dm.dao —— message 表参数化 SQL（REST 侧：会话/历史/未读/已读）。
 * 来源：utils/db_message.js（msgSend 属 WS 写路径，暂由 legacy WS 使用，P5 收编）。
 */
import { pool } from '../../db/pool.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export class DmDao {
    /** 两用户会话消息（倒序取最新一页后翻转为时间正序） */
    async conversation(userA: number | string, userB: number | string, page: unknown, pageSize: unknown): Promise<Array<AnyRow>> {
        let p = parseInt(String(page ?? ''), 10) || 1;
        let ps = parseInt(String(pageSize ?? ''), 10) || 30;
        const offset = (p - 1) * ps;
        const [rows] = await pool.query(
            `SELECT id, sender_id, receiver_id, content, is_read, created_at
             FROM message
             WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
             ORDER BY id DESC
             LIMIT ? OFFSET ?`,
            [userA, userB, userB, userA, ps, offset]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        (rows as Array<AnyRow>).reverse();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as Array<AnyRow>;
    }

    /** 会话列表：每会话最后一条 + 未读数 */
    async conversationList(userId: number | string): Promise<Array<AnyRow>> {
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
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as Array<AnyRow>;
    }

    async unreadTotal(userId: number | string): Promise<number> {
        const [rows] = await pool.query('SELECT COUNT(*) AS c FROM message WHERE receiver_id = ? AND is_read = 0', [userId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return (rows[0] as AnyRow).c as number;
    }

    async markRead(userId: number | string, otherId: number): Promise<void> {
        await pool.query(
            'UPDATE message SET is_read = 1, read_at = NOW() WHERE receiver_id = ? AND sender_id = ? AND is_read = 0',
            [userId, otherId]
        );
    }

    /** WS 发消息（utils/db_message.msgSend：content 截断 2000） */
    async send(senderId: number | string, receiverId: number | string, content: string): Promise<number | string> {
        const [result] = await pool.query('INSERT INTO message (sender_id, receiver_id, content) VALUES (?, ?, ?)', [
            senderId,
            receiverId,
            String(content).slice(0, 2000),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return result.insertId as number;
    }
}

export const dmDao = new DmDao();
