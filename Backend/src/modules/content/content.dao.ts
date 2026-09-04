/**
 * modules/content/content.dao —— ad / announcement 表参数化 SQL。
 * 来源：utils/db_ad.js + utils/db_announcement.js，逐行搬运。
 */
import { pool } from '../../db/pool.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export class ContentDao {
    // ===== 广告 =====
    async adGetByPosition(position: string): Promise<AnyRow | null> {
        const [rows] = await pool.query(
            `SELECT id, title, type, image_url, text_title, text_desc, link_url, position, click_count
             FROM ad
             WHERE position = ? AND status = 1
             ORDER BY sort_order ASC, id ASC
             LIMIT 1`,
            [position]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? (rows[0] as AnyRow) : null;
    }

    async adIncrementClick(id: number): Promise<boolean> {
        const [result] = await pool.query('UPDATE ad SET click_count = click_count + 1 WHERE id = ?', [id]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return (result.affectedRows as number) > 0;
    }

    async adManageList(page: unknown, pageSize: unknown, keyword: unknown, position: unknown): Promise<{ list: Array<AnyRow>; total: number; page: number; pageSize: number }> {
        let p = parseInt(String(page ?? ''), 10) || 1;
        let ps = parseInt(String(pageSize ?? ''), 10) || 10;
        if (p < 1) p = 1;
        if (ps < 1) ps = 10;
        const offset = (p - 1) * ps;
        const where: string[] = ['1=1'];
        const params: unknown[] = [];
        if (keyword) {
            where.push('title LIKE ?');
            params.push(`%${String(keyword)}%`);
        }
        if (position) {
            where.push('position = ?');
            params.push(position);
        }
        const whereSql = 'WHERE ' + where.join(' AND ');
        const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ad ${whereSql}`, params);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = countRows[0].total as number;
        const [rows] = await pool.query(
            `SELECT id, title, type, image_url, text_title, text_desc, link_url,
                    position, sort_order, status, click_count, created_at, updated_at
             FROM ad ${whereSql}
             ORDER BY sort_order ASC, id DESC
             LIMIT ? OFFSET ?`,
            [...params, ps, offset]
        );
        return { list: rows as Array<AnyRow>, total, page: p, pageSize: ps };
    }

    async adAdd(data: Record<string, unknown>): Promise<number | string> {
        const [result] = await pool.query(
            `INSERT INTO ad (title, type, image_url, text_title, text_desc, link_url, position, sort_order, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.title,
                data.type ?? 'image',
                data.image_url ?? '',
                data.text_title ?? '',
                data.text_desc ?? '',
                data.link_url ?? '',
                data.position ?? 'article_top',
                Number(data.sort_order ?? 0) || 0,
                Number(data.status ?? 1) ? 1 : 0,
            ]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return result.insertId as number;
    }

    async adUpdate(id: number, data: Record<string, unknown>): Promise<void> {
        await pool.query(
            `UPDATE ad
             SET title = ?, type = ?, image_url = ?, text_title = ?, text_desc = ?,
                 link_url = ?, position = ?, sort_order = ?, status = ?
             WHERE id = ?`,
            [
                data.title,
                data.type ?? 'image',
                data.image_url ?? '',
                data.text_title ?? '',
                data.text_desc ?? '',
                data.link_url ?? '',
                data.position ?? 'article_top',
                Number(data.sort_order ?? 0) || 0,
                Number(data.status ?? 1) ? 1 : 0,
                id,
            ]
        );
    }

    async adSetStatus(id: number, status: unknown): Promise<void> {
        await pool.query('UPDATE ad SET status = ? WHERE id = ?', [Number(status) ? 1 : 0, id]);
    }

    async adDelete(id: number): Promise<void> {
        await pool.query('DELETE FROM ad WHERE id = ?', [id]);
    }

    async adGetById(id: number | string): Promise<AnyRow | null> {
        const [rows] = await pool.query('SELECT * FROM ad WHERE id = ?', [id]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? (rows[0] as AnyRow) : null;
    }

    // ===== 公告 =====
    async announceGetLatest(): Promise<AnyRow | null> {
        const [rows] = await pool.query(
            `SELECT id, title, content, created_at
             FROM announcement
             WHERE status = 1
             ORDER BY created_at DESC, id DESC
             LIMIT 1`
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? (rows[0] as AnyRow) : null;
    }

    async announceManageList(page: unknown, pageSize: unknown, keyword: unknown, status: unknown): Promise<{ list: Array<AnyRow>; total: number; page: number; pageSize: number }> {
        let p = parseInt(String(page ?? ''), 10) || 1;
        let ps = parseInt(String(pageSize ?? ''), 10) || 10;
        if (p < 1) p = 1;
        if (ps < 1) ps = 10;
        const offset = (p - 1) * ps;
        const where: string[] = ['1=1'];
        const params: unknown[] = [];
        if (keyword) {
            where.push('title LIKE ?');
            params.push(`%${String(keyword)}%`);
        }
        if (status === '0' || status === '1') {
            where.push('status = ?');
            params.push(Number(status));
        }
        const whereSql = 'WHERE ' + where.join(' AND ');
        const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM announcement ${whereSql}`, params);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = countRows[0].total as number;
        const [rows] = await pool.query(
            `SELECT id, title, content, status, created_at, updated_at
             FROM announcement ${whereSql}
             ORDER BY created_at DESC, id DESC
             LIMIT ? OFFSET ?`,
            [...params, ps, offset]
        );
        return { list: rows as Array<AnyRow>, total, page: p, pageSize: ps };
    }

    async announceAdd(title: string, content: unknown): Promise<number | string> {
        const [result] = await pool.query('INSERT INTO announcement (title, content) VALUES (?, ?)', [title, content]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return result.insertId as number;
    }

    async announceUpdate(id: number, title: string, content: unknown): Promise<void> {
        await pool.query('UPDATE announcement SET title = ?, content = ? WHERE id = ?', [title, content, id]);
    }

    async announceSetStatus(id: number, status: unknown): Promise<void> {
        await pool.query('UPDATE announcement SET status = ? WHERE id = ?', [Number(status) ? 1 : 0, id]);
    }

    async announceDelete(id: number): Promise<void> {
        await pool.query('DELETE FROM announcement WHERE id = ?', [id]);
    }
}

export const contentDao = new ContentDao();
