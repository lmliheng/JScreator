/**
 * modules/social/social.dao —— follow / article_like / article_favorite / user_notification 参数化 SQL。
 * 来源：utils/db_social.js，逐行搬运。
 */
import { pool } from '../../db/pool.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export class SocialDao {
    // ===== 关注 =====
    async followAdd(followerId: number | string, followeeId: number | string): Promise<void> {
        await pool.query('INSERT IGNORE INTO follow (follower_id, followee_id) VALUES (?, ?)', [followerId, followeeId]);
    }

    async followRemove(followerId: number | string, followeeId: number | string): Promise<void> {
        await pool.query('DELETE FROM follow WHERE follower_id = ? AND followee_id = ?', [followerId, followeeId]);
    }

    async followExists(followerId: number | string, followeeId: number | string): Promise<boolean> {
        const [rows] = await pool.query(
            'SELECT id FROM follow WHERE follower_id = ? AND followee_id = ? LIMIT 1',
            [followerId, followeeId]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0;
    }

    async followListByFollower(userId: number | string): Promise<Array<AnyRow>> {
        const [rows] = await pool.query(
            `SELECT u.id, u.username, u.avatar, u.name, u.bio, u.area, f.created_at AS follow_time
             FROM follow f JOIN user u ON u.id = f.followee_id
             WHERE f.follower_id = ?
             ORDER BY f.created_at DESC`,
            [userId]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as Array<AnyRow>;
    }

    async followListByFollowee(userId: number | string): Promise<Array<AnyRow>> {
        const [rows] = await pool.query(
            `SELECT u.id, u.username, u.avatar, u.name, u.bio, u.area, f.created_at AS follow_time
             FROM follow f JOIN user u ON u.id = f.follower_id
             WHERE f.followee_id = ?
             ORDER BY f.created_at DESC`,
            [userId]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as Array<AnyRow>;
    }

    async followStats(userId: number | string): Promise<{ following: number; followers: number }> {
        const [following] = await pool.query('SELECT COUNT(*) AS c FROM follow WHERE follower_id = ?', [userId]);
        const [followers] = await pool.query('SELECT COUNT(*) AS c FROM follow WHERE followee_id = ?', [userId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return { following: following[0].c as number, followers: followers[0].c as number };
    }

    // ===== 点赞 =====
    async likeToggle(articleId: number | string, userId: number | string): Promise<{ liked: boolean }> {
        const [rows] = await pool.query('SELECT id FROM article_like WHERE article_id = ? AND user_id = ? LIMIT 1', [
            articleId,
            userId,
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (Array.isArray(rows) && rows.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            await pool.query('DELETE FROM article_like WHERE id = ?', [(rows[0] as AnyRow).id]);
            return { liked: false };
        }
        await pool.query('INSERT INTO article_like (article_id, user_id) VALUES (?, ?)', [articleId, userId]);
        return { liked: true };
    }

    async likeExists(articleId: number | string, userId: number | string): Promise<boolean> {
        const [rows] = await pool.query('SELECT id FROM article_like WHERE article_id = ? AND user_id = ? LIMIT 1', [
            articleId,
            userId,
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0;
    }

    async likeCountByArticle(articleId: number | string): Promise<number> {
        const [rows] = await pool.query('SELECT COUNT(*) AS c FROM article_like WHERE article_id = ?', [articleId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return (rows[0] as AnyRow).c as number;
    }

    async likeCountReceived(userId: number | string): Promise<number> {
        const [rows] = await pool.query(
            `SELECT COUNT(*) AS c FROM article_like al JOIN article a ON a.article_id = al.article_id WHERE a.user = ?`,
            [userId]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return (rows[0] as AnyRow).c as number;
    }

    async likeManageList(page: unknown, pageSize: unknown, keyword: unknown): Promise<{ list: Array<AnyRow>; total: number; page: number; pageSize: number }> {
        let p = parseInt(String(page ?? ''), 10) || 1;
        let ps = parseInt(String(pageSize ?? ''), 10) || 10;
        if (p < 1) p = 1;
        if (ps < 1) ps = 10;
        const offset = (p - 1) * ps;
        const where: string[] = ['1=1'];
        const params: unknown[] = [];
        if (keyword) {
            where.push('(a.title LIKE ? OR u.username LIKE ?)');
            const kw = `%${String(keyword)}%`;
            params.push(kw, kw);
        }
        const whereSql = 'WHERE ' + where.join(' AND ');
        const joinSql =
            'FROM article_like al JOIN article a ON a.article_id = al.article_id JOIN user u ON u.id = al.user_id ';
        const [countRows] = await pool.query(`SELECT COUNT(*) AS total ${joinSql}${whereSql}`, params);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = countRows[0].total as number;
        const [rows] = await pool.query(
            `SELECT al.id, al.article_id, a.title AS article_title, a.user AS author_id,
                    u.username AS username, u.name AS nickname, al.created_at
             ${joinSql}${whereSql}
             ORDER BY al.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, ps, offset]
        );
        return { list: rows as Array<AnyRow>, total, page: p, pageSize: ps };
    }

    async likeManageDelete(id: number | string): Promise<void> {
        await pool.query('DELETE FROM article_like WHERE id = ?', [id]);
    }

    // ===== 收藏 =====
    async favoriteToggle(articleId: number | string, userId: number | string): Promise<{ favorited: boolean }> {
        const [rows] = await pool.query('SELECT id FROM article_favorite WHERE article_id = ? AND user_id = ? LIMIT 1', [
            articleId,
            userId,
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (Array.isArray(rows) && rows.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            await pool.query('DELETE FROM article_favorite WHERE id = ?', [(rows[0] as AnyRow).id]);
            return { favorited: false };
        }
        await pool.query('INSERT INTO article_favorite (article_id, user_id) VALUES (?, ?)', [articleId, userId]);
        return { favorited: true };
    }

    async favoriteExists(articleId: number | string, userId: number | string): Promise<boolean> {
        const [rows] = await pool.query('SELECT id FROM article_favorite WHERE article_id = ? AND user_id = ? LIMIT 1', [
            articleId,
            userId,
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0;
    }

    async favoriteCountByArticle(articleId: number | string): Promise<number> {
        const [rows] = await pool.query('SELECT COUNT(*) AS c FROM article_favorite WHERE article_id = ?', [articleId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return (rows[0] as AnyRow).c as number;
    }

    async favoriteListByUser(userId: number | string): Promise<Array<AnyRow>> {
        const [rows] = await pool.query(
            `SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                    u.username AS author_name, a.created_at, a.updated_at,
                    af.created_at AS favorited_at,
                    GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                    GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
             FROM article_favorite af
             JOIN article a ON a.article_id = af.article_id AND a.status = 1
             JOIN user u ON a.user = u.id
             LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
             LEFT JOIN article_category ac ON ac.category_id = acm.category_id
             WHERE af.user_id = ?
             GROUP BY a.article_id, a.title, a.content, a.status, a.user, u.username, a.created_at, a.updated_at, af.created_at
             ORDER BY af.created_at DESC`,
            [userId]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return (rows as Array<AnyRow>).map((r) => ({
            ...r,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            category_ids: r.category_ids ? String(r.category_ids).split(',').map(Number) : [],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            category_names: r.category_names ? String(r.category_names).split(',') : [],
        }));
    }

    async favoriteManageList(page: unknown, pageSize: unknown, keyword: unknown): Promise<{ list: Array<AnyRow>; total: number; page: number; pageSize: number }> {
        let p = parseInt(String(page ?? ''), 10) || 1;
        let ps = parseInt(String(pageSize ?? ''), 10) || 10;
        if (p < 1) p = 1;
        if (ps < 1) ps = 10;
        const offset = (p - 1) * ps;
        const where: string[] = ['1=1'];
        const params: unknown[] = [];
        if (keyword) {
            where.push('(a.title LIKE ? OR u.username LIKE ?)');
            const kw = `%${String(keyword)}%`;
            params.push(kw, kw);
        }
        const whereSql = 'WHERE ' + where.join(' AND ');
        const joinSql =
            'FROM article_favorite af JOIN article a ON a.article_id = af.article_id JOIN user u ON u.id = af.user_id ';
        const [countRows] = await pool.query(`SELECT COUNT(*) AS total ${joinSql}${whereSql}`, params);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = countRows[0].total as number;
        const [rows] = await pool.query(
            `SELECT af.id, af.article_id, a.title AS article_title, a.user AS author_id,
                    u.username AS username, u.name AS nickname, af.created_at
             ${joinSql}${whereSql}
             ORDER BY af.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, ps, offset]
        );
        return { list: rows as Array<AnyRow>, total, page: p, pageSize: ps };
    }

    async favoriteManageDelete(id: number | string): Promise<void> {
        await pool.query('DELETE FROM article_favorite WHERE id = ?', [id]);
    }

    // ===== 互动通知（user_notification） =====
    /** 不给自己发通知 */
    async notificationAdd(userId: number | string, actorId: number | string, type: string, articleId: number | string | null, content: string): Promise<void> {
        if (Number(userId) === Number(actorId)) return;
        await pool.query(
            'INSERT INTO user_notification (user_id, actor_id, type, article_id, content) VALUES (?, ?, ?, ?, ?)',
            [userId, actorId, type, articleId, content]
        );
    }

    async notificationList(userId: number | string, page: unknown, pageSize: unknown): Promise<{ list: Array<AnyRow>; total: number; page: number; pageSize: number }> {
        let p = parseInt(String(page ?? ''), 10) || 1;
        let ps = parseInt(String(pageSize ?? ''), 10) || 20;
        if (p < 1) p = 1;
        if (ps < 1) ps = 20;
        const offset = (p - 1) * ps;
        const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM user_notification WHERE user_id = ?', [userId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = countRows[0].total as number;
        const [rows] = await pool.query(
            `SELECT n.id, n.type, n.article_id, n.content, n.is_read, n.created_at,
                    u.username AS actor_username, u.name AS actor_name, u.avatar AS actor_avatar
             FROM user_notification n JOIN user u ON u.id = n.actor_id
             WHERE n.user_id = ?
             ORDER BY n.created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, ps, offset]
        );
        return { list: rows as Array<AnyRow>, total, page: p, pageSize: ps };
    }

    async notificationUnreadCount(userId: number | string): Promise<number> {
        const [rows] = await pool.query('SELECT COUNT(*) AS c FROM user_notification WHERE user_id = ? AND is_read = 0', [userId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return (rows[0] as AnyRow).c as number;
    }

    async notificationRead(id: number | string, userId: number | string): Promise<void> {
        await pool.query('UPDATE user_notification SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?', [id, userId]);
    }

    async notificationReadAll(userId: number | string): Promise<void> {
        await pool.query('UPDATE user_notification SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0', [userId]);
    }

    // ===== 杂项查询（legacy 路由内联 SQL 参数化） =====
    /** 按 username 查 id */
    async userIdByUsername(username: string): Promise<number | string | null> {
        const [rows] = await pool.query('SELECT id FROM user WHERE username = ? LIMIT 1', [username]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? ((rows[0] as AnyRow).id as number | string) : null;
    }

    /** 文章作者行（点赞/收藏通知用） */
    async articleOwner(articleId: number | string): Promise<{ article_id: number | string; user: number | string } | null> {
        const [rows] = await pool.query('SELECT article_id, user FROM article WHERE article_id = ?', [articleId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? (rows[0] as AnyRow) : null;
    }

    /** 用户名查询（动作人昵称 fallback） */
    async usernameById(id: number | string): Promise<string | null> {
        const [rows] = await pool.query('SELECT username FROM user WHERE id = ?', [id]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? ((rows[0] as AnyRow).username as string) : null;
    }
}

export const socialDao = new SocialDao();
