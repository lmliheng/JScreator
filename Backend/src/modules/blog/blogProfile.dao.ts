/**
 * modules/blog/blogProfile.dao —— 博客主页公开数据（user 公开字段 + 文章聚合）。
 * 来源：utils/db_blog_profile.js，SQL 与行整形逐行搬运。
 */
import { pool } from '../../db/pool.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export class BlogProfileDao {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private attachCategoryArrays(row: any): any {
        return {
            ...row,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
            category_ids: row.category_ids ? String(row.category_ids).split(',').map(Number) : [],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
            category_names: row.category_names ? String(row.category_names).split(',') : [],
        };
    }

    /** 按 username 查公开信息（不含密码/email；JSON 列防御 parse） */
    async getUserPublicByUsername(username: string): Promise<AnyRow | null> {
        const [rows] = await pool.query(
            `SELECT id, username, avatar, bio, name, area, vip, created_at, socials, featured_articles, github_id
             FROM user WHERE username = ?`,
            [username]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const row = Array.isArray(rows) && rows.length > 0 ? (rows[0] as AnyRow) : null;
        if (!row) return null;
        const parseJson = (v: unknown): unknown => {
            if (Array.isArray(v)) return v;
            if (typeof v === 'string' && v) {
                try {
                    return JSON.parse(v) as unknown;
                } catch {
                    return [];
                }
            }
            return [];
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        row.socials = parseJson(row.socials);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        row.featured_articles = parseJson(row.featured_articles);
        return row;
    }

    /** 按文章 id 数组查已发布文章（保持传入顺序）——主页精选 */
    async getArticlesByIds(ids: unknown): Promise<Array<AnyRow>> {
        if (!Array.isArray(ids) || !ids.length) return [];
        const unique = [
            ...new Set((ids as unknown[]).map(Number).filter(Boolean)),
        ] as number[];
        const placeholders = unique.map(() => '?').join(',');
        const sql = `SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                u.username AS author_name, a.created_at, a.updated_at,
                GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
            FROM article a
            JOIN user u ON a.user = u.id
            LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
            LEFT JOIN article_category ac ON ac.category_id = acm.category_id
            WHERE a.article_id IN (${placeholders}) AND a.status = 1
            GROUP BY a.article_id, a.title, a.content, a.status, a.user, u.username, a.created_at, a.updated_at`;
        const [rows] = await pool.query(sql, unique);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map: Record<number, any> = {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (rows as Array<AnyRow>).forEach((r) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            map[Number(r.article_id)] = this.attachCategoryArrays(r);
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return unique.map((id) => map[id]).filter(Boolean);
    }

    /** 某用户名下已发布文章分页（keyword/category_id/sort），含 total */
    async getArticlesByUsername(
        username: string,
        page: unknown,
        pageSize: unknown,
        opts: { keyword?: unknown; category_id?: unknown; sort?: unknown }
    ): Promise<{ list: Array<AnyRow>; total: number; page: number; pageSize: number }> {
        let p = parseInt(String(page ?? ''), 10) || 1;
        let ps = parseInt(String(pageSize ?? ''), 10) || 10;
        if (p < 1) p = 1;
        if (ps < 1) ps = 10;
        const offset = (p - 1) * ps;

        const where: string[] = ['u.username = ?', 'a.status = 1'];
        const params: unknown[] = [username];
        if (opts.keyword) {
            where.push('a.title LIKE ?');
            params.push(`%${String(opts.keyword)}%`);
        }
        if (opts.category_id) {
            where.push(
                'EXISTS (SELECT 1 FROM articleandcategory_middle acm2 WHERE acm2.article_id = a.article_id AND acm2.category_id = ?)'
            );
            params.push(opts.category_id);
        }
        const whereSql = 'WHERE ' + where.join(' AND ');
        const orderBy = opts.sort === 'asc' ? 'a.created_at ASC' : 'a.created_at DESC';

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total FROM article a JOIN user u ON a.user = u.id ${whereSql}`,
            params
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = countRows[0].total as number;
        const listSql = `SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                u.username AS author_name, a.created_at, a.updated_at,
                GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
            FROM article a
            JOIN user u ON a.user = u.id
            LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
            LEFT JOIN article_category ac ON ac.category_id = acm.category_id
            ${whereSql}
            GROUP BY a.article_id, a.title, a.content, a.status, a.user, u.username, a.created_at, a.updated_at
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?`;
        const [rows] = await pool.query(listSql, [...params, ps, offset]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const list = (rows as Array<AnyRow>).map((r) => this.attachCategoryArrays(r));
        return { list, total, page: p, pageSize: ps };
    }

    /** 有已发布文章的用户列表（文章数降序），博客首页用户入口 */
    async getUserList(page: unknown, pageSize: unknown): Promise<{ list: Array<AnyRow>; total: number; page: number; pageSize: number }> {
        let p = parseInt(String(page ?? ''), 10) || 1;
        let ps = parseInt(String(pageSize ?? ''), 10) || 24;
        if (p < 1) p = 1;
        if (ps < 1) ps = 24;
        const offset = (p - 1) * ps;
        const [countRows] = await pool.query(
            `SELECT COUNT(DISTINCT u.id) AS total FROM user u JOIN article a ON a.user = u.id AND a.status = 1`
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = countRows[0].total as number;
        const listSql = `SELECT u.id, u.username, u.avatar, u.bio, u.name, u.area, u.vip, u.created_at,
                COUNT(a.article_id) AS article_count
            FROM user u
            JOIN article a ON a.user = u.id AND a.status = 1
            GROUP BY u.id, u.username, u.avatar, u.bio, u.name, u.area, u.vip, u.created_at
            ORDER BY article_count DESC, u.created_at DESC
            LIMIT ? OFFSET ?`;
        const [rows] = await pool.query(listSql, [ps, offset]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return { list: rows as Array<AnyRow>, total, page: p, pageSize: ps };
    }

    /** 全站最新已发布文章 */
    async getLatestArticles(limit: unknown): Promise<Array<AnyRow>> {
        let l = parseInt(String(limit ?? ''), 10) || 6;
        if (l < 1) l = 6;
        const [rows] = await pool.query(
            `SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                    u.username AS author_name, u.name AS author_nick, u.avatar AS author_avatar,
                    a.created_at, a.updated_at,
                    GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                    GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
             FROM article a
             JOIN user u ON a.user = u.id
             LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
             LEFT JOIN article_category ac ON ac.category_id = acm.category_id
             WHERE a.status = 1
             GROUP BY a.article_id, a.title, a.content, a.status, a.user, u.username, u.name, u.avatar, a.created_at, a.updated_at
             ORDER BY a.created_at DESC
             LIMIT ?`,
            [l]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return (rows as Array<AnyRow>).map((r) => this.attachCategoryArrays(r));
    }

    /** 全站热议文章（评论数降序） */
    async getHotArticles(limit: unknown): Promise<Array<AnyRow>> {
        let l = parseInt(String(limit ?? ''), 10) || 6;
        if (l < 1) l = 6;
        const [rows] = await pool.query(
            `SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                    u.username AS author_name, u.name AS author_nick, u.avatar AS author_avatar,
                    a.created_at, a.updated_at,
                    COUNT(DISTINCT c.comment_id) AS comment_count,
                    GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                    GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
             FROM article a
             JOIN user u ON a.user = u.id
             LEFT JOIN comment c ON c.article_id = a.article_id
             LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
             LEFT JOIN article_category ac ON ac.category_id = acm.category_id
             WHERE a.status = 1
             GROUP BY a.article_id, a.title, a.content, a.status, a.user, u.username, u.name, u.avatar, a.created_at, a.updated_at
             ORDER BY comment_count DESC, a.created_at DESC
             LIMIT ?`,
            [l]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return (rows as Array<AnyRow>).map((r) => this.attachCategoryArrays(r));
    }
}

export const blogProfileDao = new BlogProfileDao();
