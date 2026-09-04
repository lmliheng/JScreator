/**
 * modules/oauth/oauth.service —— OAuth 2.0 授权服务器业务（授权码+PKCE / Client Credentials / 管理端）。
 * 对齐 legacy routes/oauth_request.js + utils/db_oauth.js（含响应怪癖与 400 文本错误）。
 *
 * 约定：方法返回 { status, body }（JSON）或 { status, text }（纯文本）/ { redirect }（302）。
 * DB 异常向上抛，由 controller 按各端点 legacy 文案兜底 500。
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import type { OauthClientRow } from './oauth.dao.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken') as {
    sign: (payload: unknown, secret: string, opts: unknown) => string;
};

type JsonResult = { status: number; body: Record<string, unknown> };
type TextResult = { status: number; text: string };
type RedirectResult = { redirect: string };

export interface ClientInput {
    name?: unknown;
    description?: unknown;
    redirect_uris?: unknown;
    scopes?: unknown;
    grant_types?: unknown;
    logo?: unknown;
}

/** service 归一化后的客户端字段（写入 DAO 前的形状） */
export interface ClientNormalized {
    name: string;
    description: string;
    redirect_uris: string;
    scopes: string;
    grant_types: string;
    logo: string;
}

function toRedirectList(v: unknown): string {
    return Array.isArray(v) ? (v as string[]).join(',') : v ? String(v) : '';
}

export interface OauthDeps {
    listClients: () => Promise<Array<Record<string, unknown>>>;
    createClient: (data: ClientNormalized) => Promise<{ id: number | string; client_id: string; client_secret: string | null }>;
    updateClient: (id: number | string, data: ClientNormalized) => Promise<void>;
    getClientByClientId: (clientId: string) => Promise<OauthClientRow | null>;
    setClientStatus: (id: number | string, status: unknown) => Promise<void>;
    deleteClient: (id: number | string) => Promise<void>;
    createCode: (
        clientId: string,
        userId: number | string,
        scope: string,
        challenge: string | null,
        redirectUri: string
    ) => Promise<string>;
    consumeCode: (
        code: string
    ) => Promise<{ code: OauthClientRow & { scope?: string } } | { error: string; message: string } | null>;
}

export class OauthService {
    constructor(private readonly d: OauthDeps) {}

    private static isAllowedRedirect(client: OauthClientRow, uri: string): boolean {
        const allowed = String(client.redirect_uris || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        return allowed.includes(uri);
    }

    private issueAccessToken(payload: Record<string, unknown>): string {
        // 与 utils/db_oauth.js issueAccessToken 一致：typ=oauth-access + jti
        const jti = createHash('sha256').update(String(Math.random())).digest('hex').slice(0, 16);
        return jwt.sign({ ...payload, typ: 'oauth-access', jti }, process.env.JWT_SECRET || 'test', { expiresIn: 3600 });
    }

    private err(status: number, message: string, error?: string): JsonResult {
        const body: Record<string, unknown> = { code: status, success: false, message };
        if (error !== undefined) body.error = error;
        return { status, body };
    }

    // ================= 管理端 =================

    async listClients(): Promise<JsonResult> {
        const list = await this.d.listClients();
        return { status: 200, body: { code: 200, success: true, message: '获取成功', data: { list } } };
    }

    async createClient(input: ClientInput): Promise<JsonResult> {
        const name = input.name ? String(input.name) : '';
        if (!name) {
            return { status: 400, body: { code: 400, success: false, message: '应用名称不能为空' } };
        }
        const grantTypes = String(input.grant_types ?? 'authorization_code,client_credentials');
        if (grantTypes.includes('authorization_code') && !input.redirect_uris) {
            return { status: 400, body: { code: 400, success: false, message: '授权码模式需要填写回调 URI' } };
        }
        const result = await this.d.createClient({
            name,
            description: input.description !== undefined ? String(input.description) : '',
            redirect_uris: toRedirectList(input.redirect_uris),
            scopes: input.scopes !== undefined ? String(input.scopes) : 'read',
            grant_types: grantTypes,
            logo: input.logo !== undefined ? String(input.logo) : '',
        });        const data: Record<string, unknown> = { ...result };
        if (result.client_secret) {
            data.note = 'client_secret 只显示这一次，请妥善保存';
        }
        return { status: 200, body: { code: 200, success: true, message: '创建成功', data } };
    }

    async updateClient(idRaw: unknown, input: ClientInput): Promise<JsonResult> {
        const id = Number(idRaw);
        const name = input.name ? String(input.name) : '';
        if (!id || !name) {
            return { status: 400, body: { code: 400, success: false, message: '参数缺失' } };
        }
        await this.d.updateClient(id, {
            name,
            description: input.description !== undefined ? String(input.description) : '',
            redirect_uris: toRedirectList(input.redirect_uris),
            scopes: input.scopes !== undefined ? String(input.scopes) : 'read',
            grant_types: String(input.grant_types ?? 'authorization_code,client_credentials'),
            logo: input.logo !== undefined ? String(input.logo) : '',
        });
        return { status: 200, body: { code: 200, success: true, message: '更新成功' } };
    }

    async setClientStatus(idRaw: unknown, status: unknown): Promise<JsonResult> {
        await this.d.setClientStatus(idRaw as number | string, status);
        return { status: 200, body: { code: 200, success: true, message: '操作成功' } };
    }

    async deleteClient(idRaw: unknown): Promise<JsonResult> {
        await this.d.deleteClient(idRaw as number | string);
        return { status: 200, body: { code: 200, success: true, message: '删除成功' } };
    }

    // ================= 授权端点（GET /oauth/authorize） =================

    async authorize(input: {
        client_id?: unknown;
        redirect_uri?: unknown;
        response_type?: unknown;
        code_challenge?: unknown;
        state?: unknown;
        scope?: unknown;
        userId: number | string | null;
        queryString: string;
    }): Promise<JsonResult | TextResult | RedirectResult> {
        const client_id = input.client_id ? String(input.client_id) : '';
        const redirect_uri = input.redirect_uri ? String(input.redirect_uri) : '';
        if (!client_id || !redirect_uri) {
            return { status: 400, text: '参数缺失：需要 client_id 与 redirect_uri' };
        }
        const client = await this.d.getClientByClientId(client_id);
        if (!client || Number(client.status) !== 1) {
            return { status: 400, text: '无效的客户端' };
        }
        if (!OauthService.isAllowedRedirect(client, redirect_uri)) {
            return { status: 400, text: 'redirect_uri 不在白名单' };
        }
        if (input.response_type !== 'code') {
            return { status: 400, text: '仅支持 response_type=code' };
        }
        if (input.userId === null) {
            const loginUrl = `/login?redirect=${encodeURIComponent('/oauth/authorize?' + input.queryString)}`;
            return { redirect: loginUrl };
        }
        const code = await this.d.createCode(
            client.client_id,
            input.userId,
            input.scope ? String(input.scope) : 'read',
            input.code_challenge ? String(input.code_challenge) : null,
            redirect_uri
        );
        const cb = new URL(redirect_uri);
        cb.searchParams.set('code', code);
        if (input.state !== undefined && input.state !== null) {
            cb.searchParams.set('state', String(input.state));
        }
        return { redirect: cb.toString() };
    }

    // ================= Token 端点（POST /oauth/token） =================

    async token(body: {
        grant_type?: unknown;
        code?: unknown;
        code_verifier?: unknown;
        client_id?: unknown;
        client_secret?: unknown;
        redirect_uri?: unknown;
    }): Promise<JsonResult> {
        const grant_type = body.grant_type ? String(body.grant_type) : '';
        if (grant_type === 'authorization_code') {
            const code = body.code ? String(body.code) : '';
            if (!code) {
                return this.err(400, '缺少授权码', 'invalid_request');
            }
            const consumed = await this.d.consumeCode(code);
            if (!consumed) {
                return this.err(400, '授权码无效', 'invalid_grant');
            }
            if ('error' in consumed) {
                return this.err(400, consumed.message, consumed.error);
            }
            const rec = consumed.code;
            const client = await this.d.getClientByClientId(rec.client_id as string);
            if (!client || Number(client.status) !== 1) {
                return this.err(400, '无效的客户端', 'invalid_client');
            }
            if (rec.code_challenge) {
                if (!this.pkceVerify(String(body.code_verifier ?? ''), rec.code_challenge as string)) {
                    return this.err(400, 'PKCE 校验失败', 'invalid_grant');
                }
            }
            const scope = rec.scope ? String(rec.scope) : 'read';
            const accessToken = this.issueAccessToken({
                user_id: Number(rec.user_id),
                client_id: client.client_id,
                scope,
            });
            return { status: 200, body: { access_token: accessToken, token_type: 'Bearer', expires_in: 3600, scope } };
        }
        if (grant_type === 'client_credentials') {
            const client_id = body.client_id ? String(body.client_id) : '';
            const client_secret = body.client_secret ? String(body.client_secret) : '';
            if (!client_id || !client_secret) {
                return this.err(400, '缺少客户端凭证', 'invalid_client');
            }
            const client = await this.d.getClientByClientId(client_id);
            if (!client || Number(client.status) !== 1 || !client.client_secret) {
                return this.err(401, '无效的客户端', 'invalid_client');
            }
            // 常量时间比较 secret（与 legacy 一致：长度不一致会抛错走 500）
            const ok = timingSafeEqual(Buffer.from(client_secret), Buffer.from(String(client.client_secret)));
            if (!ok) {
                return this.err(401, '客户端密钥错误', 'invalid_client');
            }
            const scope = client.scopes ? String(client.scopes) : 'read';
            const accessToken = this.issueAccessToken({
                user_id: null,
                client_id: client.client_id,
                scope,
                type: 'client_credentials',
            });
            return { status: 200, body: { access_token: accessToken, token_type: 'Bearer', expires_in: 3600, scope } };
        }
        return this.err(400, '不支持的 grant_type', 'unsupported_grant_type');
    }

    private pkceVerify(codeVerifier: string, codeChallenge: string, method = 'S256'): boolean {
        if (!codeVerifier || !codeChallenge) return false;
        if (String(method || 'S256').toUpperCase() === 'S256') {
            const hash = createHash('sha256').update(codeVerifier).digest('base64url');
            return hash === codeChallenge;
        }
        return codeVerifier === codeChallenge;
    }
}
