/**
 * modules/article/article.dao —— article / article_category / articleandcategory_middle 参数化 SQL。
 * 来源：utils/db_article.js + utils/db_curd.js 分类函数，SQL 与行整形逐行搬运。
 * P4：跨表写（新增/更新分类中间表、级联删除）走 withTransaction。
 */
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export interface RoleRow {
    id: number | string;
    username: string;
    role_id?: number | null;
    role_name?: string | null;
}

export class ArticleDao {
    /** 用户角色行（isAdminOrEditor 用） */
    async getUserRoleById(user_id: number | string): Promise<RoleRow | null> {
        const [rows] = await pool.query(
            `SELECT u.id, u.username, u.role_id, r.role_name
             FROM user u LEFT JOIN role r ON u.role_id = r.role_id
             WHERE u.id = ?`,
            [user_id]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? (rows[0] as RoleRow) : null;
    }

    /** admin/editor 用 role_name 判断（兼容 admin=1/editor=3 与 admin=1/editor=2 两套编号） */
    async isAdminOrEditor(user_id: number | string): Promise<boolean> {
        const role = await this.getUserRoleById(user_id);
        if (!role) return false;
        const name = String(role.role_name || '').trim();
        return ['admin', 'editor', '超级管理员', '编辑'].includes(name);
    }

    async articleGetById(article_id: number): Promise<AnyRow | null> {
        const [rows] = await pool.query('SELECT * FROM article WHERE article_id = ?', [article_id]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? (rows[0] as AnyRow) : null;
    }

    async articleGetCategories(article_id: number): Promise<Array<{ category_id: number; category_name: string }>> {
        const [rows] = await pool.query(
            `SELECT ac.category_id, ac.category_name
             FROM articleandcategory_middle acm
             JOIN article_category ac ON ac.category_id = acm.category_id
             WHERE acm.article_id = ?
             ORDER BY ac.category_id ASC`,
            [article_id]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as Array<{ category_id: number; category_name: string }>;
    }

    /** 组装分类字段：GROUP_CONCAT 字符串 → 数组 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private attachCategoryArrays(row: any): any {
        return {
            ...row,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
            category_ids: row.category_ids ? String(row.category_ids).split(',').map(Number) : [],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
            category_names: row.category_names ? String(row.category_names).split(',') : [],
        };
    }

    /** 公开文章列表（分页+按分类+关键词+author；status 规则同 legacy） */
    async list(filter: {
        page?: unknown;
        pageSize?: unknown;
        category_id?: unknown;
        keyword?: unknown;
        status?: unknown;
        author?: unknown;
    }): Promise<{ list: Array<AnyRow>; total: number; page: number; pageSize: number }> {
        let page = parseInt(String(filter.page ?? ''), 10) || 1;
        let pageSize = parseInt(String(filter.pageSize ?? ''), 10) || 10;
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;
        const offset = (page - 1) * pageSize;
        const status = filter.status;

        const where: string[] = [];
        const params: unknown[] = [];
        if (status === undefined || status === '' || status === null) {
            where.push('a.status = 1');
        } else if (status !== 'all') {
            where.push('a.status = ?');
            params.push(Number(status));
        }
        if (filter.keyword) {
            where.push('(a.title LIKE ? OR a.content LIKE ?)');
            const kw = `%${String(filter.keyword)}%`;
            params.push(kw, kw);
        }
        if (filter.author) {
            where.push('EXISTS (SELECT 1 FROM user u WHERE u.id = a.user AND (u.name LIKE ? OR u.username LIKE ?))');
            const aw = `%${String(filter.author)}%`;
            params.push(aw, aw);
        }
        if (filter.category_id) {
            where.push(
                'EXISTS (SELECT 1 FROM articleandcategory_middle acm WHERE acm.article_id = a.article_id AND acm.category_id = ?)'
            );
            params.push(filter.category_id);
        }
        const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

        const [countRows] = await pool.query(`SELECT COUNT(DISTINCT a.article_id) AS total FROM article a ${whereSql}`, params);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = countRows[0].total as number;

        const listSql = `SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                COALESCE(NULLIF(u.name, ''), u.username) AS author_name, a.created_at, a.updated_at,
                COUNT(DISTINCT al.id) AS like_count,
                COUNT(DISTINCT af.id) AS favorite_count,
                GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
            FROM article a
            LEFT JOIN user u ON a.user = u.id
            LEFT JOIN article_like al ON al.article_id = a.article_id
            LEFT JOIN article_favorite af ON af.article_id = a.article_id
            LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
            LEFT JOIN article_category ac ON ac.category_id = acm.category_id
            ${whereSql}
            GROUP BY a.article_id, a.title, a.content, a.status, a.user, COALESCE(NULLIF(u.name, ''), u.username), a.created_at, a.updated_at
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?`;
        const [rows] = await pool.query(listSql, [...params, pageSize, offset]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const list = (rows as Array<AnyRow>).map((r) => ({
            ...this.attachCategoryArrays(r),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            like_count: Number(r.like_count) || 0,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            favorite_count: Number(r.favorite_count) || 0,
        }));
        return { list, total, page, pageSize };
    }

    /** 文章详情（作者/分类/正文/AI 总结） */
    async detail(article_id: number): Promise<AnyRow | null> {
        const [rows] = await pool.query(
            `SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                    COALESCE(NULLIF(u.name, ''), u.username) AS author_name,
                    u.username AS author_username,
                    u.avatar AS author_avatar,
                    u.bio AS author_bio,
                    a.ai_summary,
                    a.created_at, a.updated_at
             FROM article a LEFT JOIN user u ON a.user = u.id
             WHERE a.article_id = ?`,
            [article_id]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const article = Array.isArray(rows) && rows.length > 0 ? (rows[0] as AnyRow) : null;
        if (!article) return null;
        // mysql2 对 JSON 自动 parse；字符串则 JSON.parse
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (article.ai_summary && typeof article.ai_summary === 'string') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                article.ai_summary = JSON.parse(article.ai_summary);
            } catch {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                article.ai_summary = null;
            }
        }
        const cats = await this.articleGetCategories(article_id);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        article.category_ids = cats.map((c) => c.category_id);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        article.category_names = cats.map((c) => c.category_name);
        return article;
    }

    private async setCategories(article_id: number, category_ids: unknown, conn?: unknown): Promise<void> {
        const q = conn ?? pool;
        const uniqueIds = [
            ...new Set((Array.isArray(category_ids) ? category_ids : [])
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                .map(Number)
                .filter(Boolean)),
        ];
        for (const category_id of uniqueIds) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await q.query('INSERT INTO articleandcategory_middle (article_id, category_id) VALUES (?, ?)', [
                article_id,
                category_id,
            ]);
        }
    }

    /** 新增文章：插入文章 + 写分类中间表（事务） */
    async add(input: {
        user_id: number | string;
        title: string;
        content: string;
        status: number;
        category_ids?: unknown;
    }): Promise<number | string> {
        return withTransaction(pool, async (conn) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const [result] = await conn.query('INSERT INTO article (title, content, user, status) VALUES (?, ?, ?, ?)', [
                input.title,
                input.content,
                input.user_id,
                input.status,
            ]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const article_id = result.insertId as number;
            await this.setCategories(article_id, input.category_ids, conn);
            return article_id;
        });
    }

    /** 更新文章（字段可选；category_ids 传入则整体替换中间表）——跨语句走事务 */
    async update(
        article_id: number,
        fields: { title?: unknown; content?: unknown; status?: unknown; category_ids?: unknown }
    ): Promise<void> {
        await withTransaction(pool, async (conn) => {
            const setClauses: string[] = [];
            const params: unknown[] = [];
            if (fields.title !== undefined) {
                setClauses.push('title = ?');
                params.push(fields.title);
            }
            if (fields.content !== undefined) {
                setClauses.push('content = ?');
                params.push(fields.content);
            }
            if (fields.status !== undefined) {
                setClauses.push('status = ?');
                params.push(fields.status);
            }
            if (setClauses.length > 0) {
                params.push(article_id);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                await conn.query(`UPDATE article SET ${setClauses.join(', ')} WHERE article_id = ?`, params);
            }
            if (fields.category_ids !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                await conn.query('DELETE FROM articleandcategory_middle WHERE article_id = ?', [article_id]);
                await this.setCategories(article_id, fields.category_ids, conn);
            }
        });
    }

    /** 删除文章（先清评论防孤儿；中间表靠外键级联）——事务 */
    async remove(article_id: number): Promise<void> {
        await withTransaction(pool, async (conn) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await conn.query('DELETE FROM comment WHERE article_id = ?', [article_id]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await conn.query('DELETE FROM article WHERE article_id = ?', [article_id]);
        });
    }

    /** 当前用户自己的文章列表（含草稿/仅自己可见） */
    async mine(
        user_id: number | string,
        page: unknown,
        pageSize: unknown
    ): Promise<{ list: Array<AnyRow>; total: number; page: number; pageSize: number }> {
        let p = parseInt(String(page ?? ''), 10) || 1;
        let ps = parseInt(String(pageSize ?? ''), 10) || 10;
        if (p < 1) p = 1;
        if (ps < 1) ps = 10;
        const offset = (p - 1) * ps;
        const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM article WHERE user = ?', [user_id]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = countRows[0].total as number;
        const listSql = `SELECT a.article_id, a.title, a.content, a.status, a.user AS user_id,
                COALESCE(NULLIF(u.name, ''), u.username) AS author_name, a.created_at, a.updated_at,
                GROUP_CONCAT(DISTINCT ac.category_id ORDER BY ac.category_id ASC) AS category_ids,
                GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
            FROM article a
            LEFT JOIN user u ON a.user = u.id
            LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
            LEFT JOIN article_category ac ON ac.category_id = acm.category_id
            WHERE a.user = ?
            GROUP BY a.article_id, a.title, a.content, a.status, a.user, COALESCE(NULLIF(u.name, ''), u.username), a.created_at, a.updated_at
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?`;
        const [rows] = await pool.query(listSql, [user_id, ps, offset]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const list = (rows as Array<AnyRow>).map((r) => this.attachCategoryArrays(r));
        return { list, total, page: p, pageSize: ps };
    }

    /** 归档：公开文章平铺（可选 username），按时间倒序 */
    async archive(username?: string): Promise<Array<AnyRow>> {
        let sql = `SELECT a.article_id, a.title, a.created_at,
                COALESCE(NULLIF(u.name, ''), u.username) AS author_name,
                u.username AS author_username,
                GROUP_CONCAT(DISTINCT ac.category_name ORDER BY ac.category_id ASC) AS category_names
            FROM article a
            LEFT JOIN user u ON a.user = u.id
            LEFT JOIN articleandcategory_middle acm ON acm.article_id = a.article_id
            LEFT JOIN article_category ac ON ac.category_id = acm.category_id
            WHERE a.status = 1`;
        const params: unknown[] = [];
        if (username) {
            sql += ' AND u.username = ?';
            params.push(username);
        }
        sql += ` GROUP BY a.article_id, a.title, a.created_at, COALESCE(NULLIF(u.name, ''), u.username), u.username
            ORDER BY a.created_at DESC`;
        const [rows] = await pool.query(sql, params);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as Array<AnyRow>;
    }

    // ================= 分类 =================

    async categoryGetById(category_id: number | string): Promise<AnyRow | null> {
        const [rows] = await pool.query('SELECT * FROM article_category WHERE category_id = ?', [category_id]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? (rows[0] as AnyRow) : null;
    }

    /** 全部分类（含创建人 author_name），db_curd.article_category_getAll */
    async categoryGetAll(): Promise<Array<AnyRow>> {
        const [rows] = await pool.query(
            `SELECT c.category_id, c.category_name, c.created_at, c.updated_at, c.user,
                    COALESCE(NULLIF(u.name, ''), u.username) AS author_name
             FROM article_category c
             LEFT JOIN user u ON u.id = c.user
             ORDER BY c.category_id ASC`
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as Array<AnyRow>;
    }

    async categoryAdd(category_name: string, user_id: number | string): Promise<void> {
        await pool.query('INSERT INTO article_category (category_name, user) VALUES (?, ?)', [category_name, user_id]);
    }

    /** 更新自己创建的分类 */
    async categoryUpdateOwn(category_id: number | string, category_name: string, user_id: number | string): Promise<void> {
        await pool.query('UPDATE article_category SET category_name = ? WHERE category_id = ? and user = ?', [
            category_name,
            category_id,
            user_id,
        ]);
    }

    /** 删除自己创建的分类 */
    async categoryDeleteOwn(category_id: number | string, user_id: number | string): Promise<void> {
        await pool.query('DELETE FROM article_category WHERE category_id = ? and user = ?', [category_id, user_id]);
    }

    /** 更新任意分类（admin/editor） */
    async categoryUpdateAny(category_id: number | string, category_name: string): Promise<void> {
        await pool.query('UPDATE article_category SET category_name = ? WHERE category_id = ?', [category_name, category_id]);
    }

    /** 删除任意分类（admin/editor） */
    async categoryDeleteAny(category_id: number | string): Promise<void> {
        await pool.query('DELETE FROM article_category WHERE category_id = ?', [category_id]);
    }
}

export const articleDao = new ArticleDao();
