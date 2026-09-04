/**
 * modules/openapi/apiKey.dao —— api_key 表参数化 SQL + SHA256 存储（对齐 utils/db_api_key.js）。
 * 安全：库中只存 key_hash + key_prefix；明文仅创建时返回一次。
 */
import { createHash, randomBytes } from 'node:crypto';
import { pool } from '../../db/pool.js';

export interface ApiKeyRow {
    id: number | string;
    user_id: number | string;
    name: string;
    key_prefix: string;
    scopes: string;
    status: number;
    last_used_at?: Date | null;
    created_at?: Date | null;
}

function sha256(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
}

export class ApiKeyDao {
    generatePlainKey(): string {
        return 'sk_' + randomBytes(24).toString('hex');
    }

    async create(userId: number | string, name: string | undefined, scopes?: string): Promise<{ plain: string; keyPrefix: string; scopes: string }> {
        const plain = this.generatePlainKey();
        const keyHash = sha256(plain);
        const keyPrefix = plain.slice(0, 10);
        const finalScopes = scopes ?? 'read';
        await pool.query('INSERT INTO api_key (user_id, name, key_hash, key_prefix, scopes) VALUES (?, ?, ?, ?, ?)', [
            userId,
            name || '未命名',
            keyHash,
            keyPrefix,
            finalScopes,
        ]);
        return { plain, keyPrefix, scopes: finalScopes };
    }

    async listByUser(userId: number | string): Promise<ApiKeyRow[]> {
        const [rows] = await pool.query(
            `SELECT id, name, key_prefix, scopes, status, last_used_at, created_at
             FROM api_key WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as ApiKeyRow[];
    }

    async setStatus(id: number | string, userId: number | string, status: unknown): Promise<void> {
        await pool.query('UPDATE api_key SET status = ? WHERE id = ? AND user_id = ?', [Number(status) ? 1 : 0, id, userId]);
    }

    async delete(id: number | string, userId: number | string): Promise<void> {
        await pool.query('DELETE FROM api_key WHERE id = ? AND user_id = ?', [id, userId]);
    }

    /** 按明文校验：返回 { user_id, scopes } 或 null；通过时异步更新时间戳（不阻塞） */
    async verify(plain: string | undefined): Promise<{ user_id: number; scopes: string } | null> {
        if (!plain || !plain.startsWith('sk_')) return null;
        const keyHash = sha256(plain);
        const [rows] = await pool.query('SELECT id, user_id, scopes, status FROM api_key WHERE key_hash = ? LIMIT 1', [
            keyHash,
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const row = Array.isArray(rows) && rows.length > 0 ? (rows[0] as ApiKeyRow) : null;
        if (!row || Number(row.status) !== 1) return null;
        pool.query('UPDATE api_key SET last_used_at = NOW() WHERE id = ?', [row.id]).catch(() => {});
        return { user_id: Number(row.user_id), scopes: String(row.scopes || 'read') };
    }
}

export const apiKeyDao = new ApiKeyDao();
