/**
 * modules/oauth/oauth.dao —— oauth_client / oauth_code 表的参数化 SQL。
 * 来源：utils/db_oauth.js（SQL 原样搬运；随机串生成放 DAO，逻辑同 legacy）。
 * P4：授权码消费（查码 + 标记已用）走事务。
 */
import { randomBytes } from 'node:crypto';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export interface OauthClientRow extends AnyRow {}

export interface OauthCodeRow extends AnyRow {}

function randomHex(bytes: number): string {
    return randomBytes(bytes).toString('hex');
}

export class OauthDao {
    async listClients(): Promise<Array<Record<string, unknown>>> {
        const [rows] = await pool.query(
            `SELECT id, client_id, name, description, redirect_uris, scopes, grant_types, logo, status, created_at
             FROM oauth_client ORDER BY created_at DESC`
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return (rows as Array<Record<string, unknown>>).map((r) => ({ ...r, client_secret_hidden: true }));
    }

    async createClient(data: {
        name: string;
        description?: string;
        redirect_uris?: string | string[];
        scopes?: string;
        grant_types?: string;
        logo?: string;
    }): Promise<{ id: number | string; client_id: string; client_secret: string | null }> {
        const clientId = 'oa_' + randomHex(16);
        const clientSecret =
            data.grant_types && data.grant_types.includes('client_credentials') ? randomHex(24) : null;
        const redirects = Array.isArray(data.redirect_uris) ? data.redirect_uris.join(',') : data.redirect_uris || '';
        const [result] = await pool.query(
            `INSERT INTO oauth_client (client_id, client_secret, name, description, redirect_uris, scopes, grant_types, logo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                clientId,
                clientSecret,
                data.name,
                data.description || '',
                redirects,
                data.scopes || 'read',
                data.grant_types || 'authorization_code,client_credentials',
                data.logo || '',
            ]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return { id: result.insertId as number, client_id: clientId, client_secret: clientSecret };
    }

    async updateClient(
        id: number | string,
        data: {
            name: string;
            description?: string;
            redirect_uris?: string | string[];
            scopes?: string;
            grant_types?: string;
            logo?: string;
        }
    ): Promise<void> {
        const redirects = Array.isArray(data.redirect_uris) ? data.redirect_uris.join(',') : data.redirect_uris || '';
        await pool.query(
            `UPDATE oauth_client
             SET name = ?, description = ?, redirect_uris = ?, scopes = ?, grant_types = ?, logo = ?
             WHERE id = ?`,
            [
                data.name,
                data.description || '',
                redirects,
                data.scopes || 'read',
                data.grant_types || 'authorization_code,client_credentials',
                data.logo || '',
                id,
            ]
        );
    }

    async getClientByClientId(clientId: string): Promise<OauthClientRow | null> {
        const [rows] = await pool.query('SELECT * FROM oauth_client WHERE client_id = ? LIMIT 1', [clientId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Array.isArray(rows) && rows.length > 0 ? (rows[0] as OauthClientRow) : null;
    }

    async setClientStatus(id: number | string, status: unknown): Promise<void> {
        await pool.query('UPDATE oauth_client SET status = ? WHERE id = ?', [Number(status) ? 1 : 0, id]);
    }

    async deleteClient(id: number | string): Promise<void> {
        await pool.query('DELETE FROM oauth_client WHERE id = ?', [id]);
    }

    /** 生成并落库授权码（ttlMs 默认 10 分钟，与 legacy 一致） */
    async createCode(
        clientId: string,
        userId: number | string,
        scope: string,
        challenge: string | null,
        redirectUri: string,
        ttlMs = 10 * 60 * 1000
    ): Promise<string> {
        const code = randomHex(24);
        const expiresAt = new Date(Date.now() + ttlMs);
        await pool.query(
            `INSERT INTO oauth_code (code, client_id, user_id, scope, code_challenge, redirect_uri, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [code, clientId, userId, scope || 'read', challenge, redirectUri]
        );
        return code;
    }

    /** 消费授权码：不存在 → null；已用/过期 → {error,message}；成功标记 used 并返回 {code:rec}（事务） */
    async consumeCode(
        code: string
    ): Promise<{ code: OauthCodeRow } | { error: string; message: string } | null> {
        return withTransaction(pool, async (conn) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const [rows] = await conn.query('SELECT * FROM oauth_code WHERE code = ? LIMIT 1', [code]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const rec = Array.isArray(rows) && rows.length > 0 ? (rows[0] as OauthCodeRow) : null;
            if (!rec) return null;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (Number(rec.used) === 1) return { error: 'invalid_grant', message: '授权码已使用' };
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            if (new Date(rec.expires_at).getTime() < Date.now()) return { error: 'invalid_grant', message: '授权码已过期' };
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await conn.query('UPDATE oauth_code SET used = 1 WHERE id = ?', [rec.id]);
            return { code: rec };
        });
    }
}

export const oauthDao = new OauthDao();
