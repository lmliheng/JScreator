/**
 * modules/openapi/apiKey.service —— API Key 管理业务（/api-keys*）。
 * 对齐 legacy routes/api_key_request.js；write 权限仅 admin(1)/editor(3) 可建。
 */
import type { ApiKeyRow } from './apiKey.dao.js';

export interface ApiKeyDeps {
    create: (userId: number | string, name: string | undefined, scopes?: string) => Promise<{ plain: string; keyPrefix: string; scopes: string }>;
    listByUser: (userId: number | string) => Promise<ApiKeyRow[]>;
    setStatus: (id: number | string, userId: number | string, status: unknown) => Promise<void>;
    delete: (id: number | string, userId: number | string) => Promise<void>;
    getRoleId: (userId: number | string) => Promise<number | null>;
}

export type ApiKeyCreateOutcome =
    | { ok: true; plain: string; keyPrefix: string; scopes: string }
    | { ok: false; status: number; message: string };

export class ApiKeyService {
    constructor(private readonly d: ApiKeyDeps) {}

    async create(userId: number | string, name: string | undefined, scopesRaw: unknown): Promise<ApiKeyCreateOutcome> {
        let scope = 'read';
        if (scopesRaw && String(scopesRaw).includes('write')) {
            const roleId = await this.d.getRoleId(userId);
            if (roleId === 1 || roleId === 3) {
                scope = 'read,write';
            } else {
                return { ok: false, status: 403, message: '仅管理员/编辑可创建写权限 Key' };
            }
        }
        const result = await this.d.create(userId, name, scope);
        return { ok: true, plain: result.plain, keyPrefix: result.keyPrefix, scopes: result.scopes };
    }

    list(userId: number | string): Promise<ApiKeyRow[]> {
        return this.d.listByUser(userId);
    }

    setStatus(id: number | string, userId: number | string, status: unknown): Promise<void> {
        return this.d.setStatus(id, userId, status);
    }

    remove(id: number | string, userId: number | string): Promise<void> {
        return this.d.delete(id, userId);
    }
}
