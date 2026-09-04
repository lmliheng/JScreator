/**
 * modules/notification/notification.dao —— 平台广播通知（notification + notification_read）。
 * 来源：utils/db_notification.js，逐行搬运。
 */
import { pool } from '../../db/pool.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export class BroadcastDao {
    /** 插入广播通知（管理员发布） */
    async add(data: {
        title: string;
        content: string;
        senderId: number | string;
        targetType: string;
        targetId?: number | string | null;
        type?: string;
        importance?: string;
    }): Promise<number | string> {
        const [result] = await pool.query(
            'INSERT INTO notification (title, content, type, importance, sender_id, target_type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                data.title,
                data.content,
                data.type ?? 'announcement',
                data.importance ?? 'medium',
                data.senderId,
                data.targetType,
                data.targetId ?? null,
            ]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return result.insertId as number;
    }

    /** 用户可见通知列表（含已读状态）——规则同 legacy */
    async getForUser(userId: number | string): Promise<Array<AnyRow>> {
        const [rows] = await pool.query(
            `SELECT n.notification_id, n.title, n.content, n.type, n.importance, n.sender_id, n.target_type, n.target_id, n.created_at,
                    COALESCE(nr.is_read, 0) AS is_read
             FROM notification n
             LEFT JOIN notification_read nr ON nr.notification_id = n.notification_id AND nr.user_id = ?
             WHERE n.target_type = 'all'
                OR (n.target_type = 'user' AND n.target_id = ?)
                OR (n.target_type = 'role' AND n.target_id = (SELECT role_id FROM user WHERE id = ?))
             ORDER BY n.created_at DESC`,
            [userId, userId, userId]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as Array<AnyRow>;
    }

    async markRead(notificationId: number | string, userId: number | string): Promise<void> {
        await pool.query(
            `INSERT INTO notification_read (notification_id, user_id, is_read, read_at)
             VALUES (?, ?, 1, NOW())
             ON DUPLICATE KEY UPDATE is_read = 1, read_at = NOW()`,
            [notificationId, userId]
        );
    }

    async getUnreadCount(userId: number | string): Promise<number> {
        const [rows] = await pool.query(
            `SELECT COUNT(*) AS unread_count
             FROM notification n
             LEFT JOIN notification_read nr ON nr.notification_id = n.notification_id AND nr.user_id = ?
             WHERE (nr.id IS NULL OR nr.is_read = 0)
               AND (n.target_type = 'all'
                 OR (n.target_type = 'user' AND n.target_id = ?)
                 OR (n.target_type = 'role' AND n.target_id = (SELECT role_id FROM user WHERE id = ?)))`,
            [userId, userId, userId]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return (rows[0] as AnyRow).unread_count as number;
    }

    async getById(notificationId: number | string): Promise<AnyRow | null> {
        const [rows] = await pool.query('SELECT * FROM notification WHERE notification_id = ?', [notificationId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? (rows[0] as AnyRow) : null;
    }

    /** 动态字段更新；无字段返回 false */
    async update(notificationId: number | string, fields: Record<string, unknown>): Promise<boolean> {
        const allowed = ['title', 'content', 'target_type', 'target_id', 'type', 'importance'];
        const setClauses: string[] = [];
        const params: unknown[] = [];
        for (const key of allowed) {
            if (fields[key] !== undefined) {
                setClauses.push(`${key} = ?`);
                params.push(key === 'target_id' && fields[key] == null ? null : fields[key]);
            }
        }
        if (setClauses.length === 0) return false;
        params.push(notificationId);
        await pool.query(`UPDATE notification SET ${setClauses.join(', ')} WHERE notification_id = ?`, params);
        return true;
    }

    async remove(notificationId: number | string): Promise<void> {
        await pool.query('DELETE FROM notification WHERE notification_id = ?', [notificationId]);
    }
}

export const broadcastDao = new BroadcastDao();
