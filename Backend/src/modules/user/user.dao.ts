/**
 * modules/user/user.dao —— user 表的参数化 SQL。
 * 覆盖 auth 域（login/register/email/totp/github）所需子集；
 * 来源：utils/db_curd.js 对应函数，SQL 原样搬运（参数化）。
 * 密码比对等业务规则放 service，不放 DAO。
 */
import { pool } from '../../db/pool.js';

export type UserId = number | string;

export interface UserRow {
    id: UserId;
    username: string;
    email: string | null;
    password: string;
    role_id?: number | null;
    avatar?: string | null;
    bio?: string | null;
    area?: string | null;
    name?: string | null;
    checkinDay?: number | null;
    totp_secret?: string | null;
    github_id?: number | string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(row: any): UserRow {
    return row as UserRow;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstRow(result: any): UserRow | null {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const rows = result?.[0];
    return Array.isArray(rows) && rows.length > 0 ? toRow(rows[0]) : null;
}

export class UserDao {
    async findByEmail(email: string): Promise<UserRow | null> {
        return firstRow(await pool.query('SELECT * FROM user WHERE email = ?', [email]));
    }

    async findByUsername(username: string): Promise<UserRow | null> {
        return firstRow(await pool.query('SELECT * FROM user WHERE username = ?', [username]));
    }

    async existsByEmail(email: string): Promise<boolean> {
        return (await this.findByEmail(email)) !== null;
    }

    async existsByUsername(username: string): Promise<boolean> {
        return (await this.findByUsername(username)) !== null;
    }

    async insertUser(id: UserId, username: string, email: string, passwordHash: string): Promise<void> {
        await pool.query('INSERT INTO user (id, username, email, password) VALUES (?, ?, ?, ?)', [
            id,
            username,
            email,
            passwordHash,
        ]);
    }

    /** 邮箱验证码自动注册（db_curd.user_registerEmail：username 同时写入 name，role_id=2） */
    async registerEmailUser(username: string, email: string, password: string): Promise<void> {
        await pool.query('INSERT INTO user (username, name, email, password, role_id) VALUES (?, ?, ?, ?, 2)', [
            username,
            username,
            email,
            password,
        ]);
    }

    /** TOTP setup：查 id/username/email */
    async getBasicById(id: UserId): Promise<UserRow | null> {
        return firstRow(await pool.query('SELECT id, username, email FROM user WHERE id = ?', [id]));
    }

    /** TOTP confirm/status/disable：读 totp_secret（NULL 表示未绑定） */
    async getTotpSecret(id: UserId): Promise<string | null> {
        const row = await firstRow(await pool.query('SELECT totp_secret FROM user WHERE id = ?', [id]));
        return row ? (row.totp_secret ?? null) : null;
    }

    async setTotpSecret(id: UserId, secret: string | null): Promise<void> {
        await pool.query('UPDATE user SET totp_secret = ? WHERE id = ?', [secret, id]);
    }

    /** TOTP 直接登录：账号（用户名或邮箱）定位用户（db_curd/totp_request 原 SQL） */
    async findByAccountForTotp(account: string): Promise<UserRow | null> {
        return firstRow(
            await pool.query(
                'SELECT id, username, email, role_id, avatar, bio, area, name, totp_secret, checkinDay FROM user WHERE username = ? OR email = ? LIMIT 1',
                [account, account]
            )
        );
    }

    /** GitHub 登录：按 github_id 查用户（db_curd.user_getByGithubId） */
    async getByGithubId(githubId: number | string): Promise<UserRow | null> {
        return firstRow(await pool.query('SELECT * FROM user WHERE github_id = ?', [githubId]));
    }

    /** GitHub 自动注册（db_curd.user_registerGithub：role_id=2） */
    async registerGithubUser(input: {
        github_id: number | string;
        username: string;
        name?: string | null;
        email?: string | null;
        password: string;
        avatar?: string | null;
    }): Promise<void> {
        await pool.query(
            'INSERT INTO user (username, name, email, github_id, password, avatar, role_id) VALUES (?, ?, ?, ?, ?, ?, 2)',
            [input.username, input.name ?? null, input.email ?? null, input.github_id, input.password, input.avatar ?? null]
        );
    }

    async setGithubId(userId: UserId, githubId: number | string): Promise<void> {
        await pool.query('UPDATE user SET github_id = ? WHERE id = ?', [githubId, userId]);
    }

    /** 权限校验用：查用户 role_id */
    async getRoleId(id: UserId): Promise<number | null> {
        const row = await firstRow(await pool.query('SELECT role_id FROM user WHERE id = ?', [id]));
        return row && row.role_id != null ? Number(row.role_id) : null;
    }

    // ================= user 域（/sys/profile、/userInfo、/user-manage/*） =================

    /** /sys/profile：用户 + 角色 + 权限 join 行（db_curd.getUserInfoByToken，参数化） */
    async profileRows(userId: UserId): Promise<Array<Record<string, unknown>>> {
        const [rows] = await pool.query(
            `SELECT u.username, u.email, u.id, u.avatar, u.created_at, u.name, u.vip, u.area, u.bio, u.checkinDay,
                    r.role_name, r.role_id, p.permission_name, p.permission_id
             FROM user u
             JOIN role r ON u.role_id = r.role_id
             JOIN roleandpermission_middle rp ON rp.role_id = r.role_id
             JOIN permission p ON p.permission_id = rp.permission_id
             WHERE u.id = ?`,
            [userId]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as Array<Record<string, unknown>>;
    }

    /** /sys/profile 统计：已发布文章数、评论数 */
    async getUserStats(userId: UserId): Promise<{ article_count: number; comment_count: number }> {
        const [artRows] = await pool.query('SELECT COUNT(*) AS c FROM article WHERE `user` = ? AND status = 1', [userId]);
        const [cmtRows] = await pool.query('SELECT COUNT(*) AS c FROM comment WHERE user_id = ?', [userId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return { article_count: artRows[0].c as number, comment_count: cmtRows[0].c as number };
    }

    async setPasswordHash(id: UserId, passwordHash: string): Promise<void> {
        await pool.query('UPDATE user SET password = ? WHERE id = ?', [passwordHash, id]);
    }

    /** 真分页列表（db_curd.user_getAllByPage） */
    async listPage(
        page: number,
        pageSize: number,
        keyword: string
    ): Promise<{ list: Array<Record<string, unknown>>; total: number; page: number; pageSize: number }> {
        const where: string[] = [];
        const params: unknown[] = [];
        if (keyword) {
            const kw = `%${keyword}%`;
            where.push('(u.username LIKE ? OR u.email LIKE ? OR u.name LIKE ?)');
            params.push(kw, kw, kw);
        }
        const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const offset = (page - 1) * pageSize;
        const listSql = `SELECT u.id, u.username, u.email, u.avatar, u.created_at, u.updated_at, u.name, u.area, u.bio, u.vip, u.checkinDay, r.role_id, r.role_name
            FROM user u JOIN role r ON u.role_id = r.role_id ${whereSql}
            ORDER BY u.id DESC LIMIT ? OFFSET ?`;
        const countSql = `SELECT COUNT(*) AS total FROM user u JOIN role r ON u.role_id = r.role_id ${whereSql}`;
        const [rows] = await pool.query(listSql, [...params, pageSize, offset]);
        const [countRows] = await pool.query(countSql, params);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return { list: rows as Array<Record<string, unknown>>, total: countRows[0].total as number, page, pageSize };
    }

    /** 新增用户（db_curd.user_add；password 已哈希；id 用表自增） */
    async addUser(username: string, email: string, passwordHash: string, roleId?: unknown): Promise<number | string> {
        const hasRole = roleId !== undefined && roleId !== null && roleId !== '';
        const sql = hasRole
            ? 'INSERT INTO user (username, email, password, role_id) VALUES (?, ?, ?, ?)'
            : 'INSERT INTO user (username, email, password) VALUES (?, ?, ?)';
        const params = hasRole ? [username, email, passwordHash, roleId] : [username, email, passwordHash];
        const [result] = await pool.query(sql, params);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return result.insertId as number;
    }

    async deleteById(id: UserId): Promise<void> {
        await pool.query('DELETE FROM user WHERE id = ?', [id]);
    }

    async deleteBatchByIds(ids: Array<number | string>): Promise<number> {
        const placeholders = ids.map(() => '?').join(',');
        const [result] = await pool.query(`DELETE FROM user WHERE id IN (${placeholders})`, ids);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return result.affectedRows as number;
    }

    /** 详情（db_curd.user_getById，LEFT JOIN role，JSON 列防御性 parse） */
    async getDetailById(id: UserId): Promise<Record<string, unknown> | null> {
        const [rows] = await pool.query(
            `SELECT u.id, u.username, u.email, u.avatar, u.bio, u.vip, u.checkinDay, u.name, u.area,
                    u.socials, u.featured_articles, u.github_id,
                    u.created_at, u.updated_at, u.role_id, r.role_name
             FROM user u LEFT JOIN role r ON u.role_id = r.role_id
             WHERE u.id = ?`,
            [id]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const row = Array.isArray(rows) && rows.length > 0 ? (rows[0] as Record<string, unknown>) : null;
        if (!row) return null;
        const parseJson = (v: unknown): unknown[] => {
            if (v == null) return [];
            if (Array.isArray(v)) return v;
            if (typeof v === 'string') {
                try {
                    const p = JSON.parse(v) as unknown;
                    return Array.isArray(p) ? p : [];
                } catch {
                    return [];
                }
            }
            return [];
        };
        row.socials = parseJson(row.socials);
        row.featured_articles = parseJson(row.featured_articles);
        return row;
    }

    /** 动态字段更新（db_curd.user_updateProfile；无字段可更新返回 false；socials/featured_articles 序列化） */
    async updateProfile(id: UserId, fields: Record<string, unknown>): Promise<boolean> {
        const allowed = ['username', 'email', 'role_id', 'bio', 'vip', 'checkinDay', 'name', 'area', 'avatar', 'socials', 'featured_articles'];
        const setClauses: string[] = [];
        const params: unknown[] = [];
        for (const key of allowed) {
            if (fields[key] !== undefined) {
                let val: unknown = fields[key];
                if (key === 'socials' || key === 'featured_articles') {
                    val = JSON.stringify(Array.isArray(val) ? val : []);
                }
                setClauses.push(`${key} = ?`);
                params.push(val);
            }
        }
        if (setClauses.length === 0) {
            return false;
        }
        params.push(id);
        await pool.query(`UPDATE user SET ${setClauses.join(', ')} WHERE id = ?`, params);
        return true;
    }

    async clearGithubId(id: UserId): Promise<void> {
        await pool.query('UPDATE user SET github_id = NULL WHERE id = ?', [id]);
    }
}

export const userDao = new UserDao();
