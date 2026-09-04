/**
 * modules/comment/comment.dao —— comment 表参数化 SQL + 树形组装。
 * 来源：utils/db_comment.js，SQL 与树逻辑逐行搬运。
 * P4：级联删除（收集子树 + DELETE）走事务。
 */
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export interface CommentTreeOptions {
    page?: unknown;
    pageSize?: unknown;
    maxChildren?: number;
}

export class CommentDao {
    async usernameById(user_id: number | string): Promise<string | null> {
        const [rows] = await pool.query('SELECT username FROM user WHERE id = ?', [user_id]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? ((rows[0] as AnyRow).username as string) : null;
    }

    async commentGetById(comment_id: number): Promise<AnyRow | null> {
        const [rows] = await pool.query('SELECT * FROM comment WHERE comment_id = ?', [comment_id]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? (rows[0] as AnyRow) : null;
    }

    async add(input: {
        article_id: number;
        user_id: number | string | null;
        nickname: string | null;
        content: string;
        parent_id: number | null;
    }): Promise<number | string> {
        const [result] = await pool.query(
            'INSERT INTO comment (article_id, user_id, nickname, content, parent_id) VALUES (?, ?, ?, ?, ?)',
            [input.article_id, input.user_id, input.nickname, input.content, input.parent_id]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return result.insertId as number;
    }

    /** 文章评论树：顶层分页 + children 嵌套（楼中楼最多 maxChildren） */
    async getByArticle(article_id: number, opts: CommentTreeOptions = {}): Promise<{
        list: Array<AnyRow>;
        total: number;
        page: number;
        pageSize: number;
    }> {
        // 文章作者 user id（作者标志用）
        const [aRows] = await pool.query('SELECT `user` FROM article WHERE article_id = ?', [article_id]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const articleAuthorId = Array.isArray(aRows) && aRows.length > 0 ? (aRows[0] as AnyRow).user : null;

        const [rows] = await pool.query(
            `SELECT c.comment_id, c.article_id, c.user_id, c.nickname, c.content, c.parent_id, c.created_at,
                    COALESCE(NULLIF(u.name, ''), u.username) AS display_name
             FROM comment c
             LEFT JOIN user u ON u.id = c.user_id
             WHERE c.article_id = ?
             ORDER BY c.created_at ASC, c.comment_id ASC`,
            [article_id]
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map: Record<number, any> = {};
        const roots: Array<AnyRow> = [];
        const maxChildren = opts.maxChildren ?? 50;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        (rows as Array<AnyRow>).forEach((row: AnyRow) => {
            row.children = [];
            // 显示名：登录用户用 name 优先，无则 username；匿名评论用存的昵称
            if (row.user_id != null && row.display_name) {
                row.nickname = row.display_name;
            }
            // 作者标志：评论者就是文章作者
            row.is_author = row.user_id != null && Number(row.user_id) === Number(articleAuthorId);
            delete row.display_name;
            map[Number(row.comment_id)] = row;
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        (rows as Array<AnyRow>).forEach((row: AnyRow) => {
            if (row.parent_id != null && map[Number(row.parent_id)]) {
                map[Number(row.parent_id)].children.push(row);
            } else {
                roots.push(row);
            }
        });
        roots.forEach((root: AnyRow) => {
            if (root.children.length > maxChildren) {
                root.children = root.children.slice(root.children.length - maxChildren);
            }
        });
        const total = roots.length;
        const pageNum = Math.max(1, parseInt(String(opts.page ?? ''), 10) || 1);
        const size = Math.max(1, parseInt(String(opts.pageSize ?? ''), 10) || 20);
        const list = roots.slice((pageNum - 1) * size, pageNum * size);
        return { list, total, page: pageNum, pageSize: size };
    }

    /** 管理端评论列表（分页 + 按文章/关键词，含文章标题） */
    async manageList(opts: { page?: unknown; pageSize?: unknown; article_id?: unknown; keyword?: unknown }): Promise<{
        list: Array<AnyRow>;
        total: number;
        page: number;
        pageSize: number;
    }> {
        const where: string[] = [];
        const params: unknown[] = [];
        if (opts.article_id) {
            where.push('c.article_id = ?');
            params.push(opts.article_id);
        }
        if (opts.keyword) {
            where.push('(c.content LIKE ? OR c.nickname LIKE ?)');
            const kw = `%${String(opts.keyword)}%`;
            params.push(kw, kw);
        }
        const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM comment c ${whereSql}`, params);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = countRows[0].total as number;
        const pageNum = Math.max(1, parseInt(String(opts.page ?? ''), 10) || 1);
        const size = Math.max(1, parseInt(String(opts.pageSize ?? ''), 10) || 10);
        const offset = (pageNum - 1) * size;
        const [rows] = await pool.query(
            `SELECT c.comment_id, c.article_id, c.user_id, c.nickname, c.content, c.parent_id, c.created_at,
                    a.title AS article_title,
                    COALESCE(NULLIF(u.name, ''), u.username) AS display_name
             FROM comment c
             LEFT JOIN article a ON a.article_id = c.article_id
             LEFT JOIN user u ON u.id = c.user_id
             ${whereSql}
             ORDER BY c.comment_id DESC
             LIMIT ? OFFSET ?`,
            [...params, size, offset]
        );
        return { list: rows as Array<AnyRow>, total, page: pageNum, pageSize: size };
    }

    async update(comment_id: number, fields: { content?: unknown; nickname?: unknown }): Promise<boolean> {
        const setClauses: string[] = [];
        const params: unknown[] = [];
        if (fields.content !== undefined) {
            setClauses.push('content = ?');
            params.push(String(fields.content));
        }
        if (fields.nickname !== undefined) {
            setClauses.push('nickname = ?');
            params.push(String(fields.nickname));
        }
        if (setClauses.length === 0) return false;
        params.push(comment_id);
        await pool.query(`UPDATE comment SET ${setClauses.join(', ')} WHERE comment_id = ?`, params);
        return true;
    }

    /** 级联删除（含全部楼中楼子评论），返回删除条数（与 legacy 一致：含自身计数）——事务 */
    async deleteCascade(comment_id: number): Promise<number> {
        return withTransaction(pool, async (conn) => {
            const toDelete = [comment_id];
            let frontier = [comment_id];
            while (frontier.length) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                const [rows] = await conn.query('SELECT comment_id FROM comment WHERE parent_id IN (?)', [frontier]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                const ids = (rows as Array<AnyRow>).map((r) => Number(r.comment_id));
                if (!ids.length) break;
                toDelete.push(...ids);
                frontier = ids;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await conn.query('DELETE FROM comment WHERE comment_id IN (?)', [toDelete]);
            return toDelete.length;
        });
    }
}

export const commentDao = new CommentDao();
