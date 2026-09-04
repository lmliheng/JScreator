/**
 * modules/auth/github/githubAuth.service —— GitHub OAuth 登录/绑定业务。
 * 对齐 legacy routes/auth_github.js：跳转授权页、回调换 token、自动注册/绑定、302 回前端。
 * 网络请求复用根 node_modules 的 axios（与 legacy 同库同行为）。
 */
import { createRequire } from 'node:module';
import type { UserRow } from '../../user/user.dao.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const axios = require('axios') as {
    post: (url: string, data: unknown, opts?: unknown) => Promise<{ data: { access_token?: string } }>;
    get: (url: string, opts: unknown) => Promise<{ data: GithubUser }>;
};

export interface GithubUser {
    id: number;
    login?: string;
    name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
}

export interface GithubDeps {
    getByGithubId: (githubId: number | string) => Promise<UserRow | null>;
    registerGithubUser: (input: {
        github_id: number | string;
        username: string;
        name?: string | null;
        email?: string | null;
        password: string;
        avatar?: string | null;
    }) => Promise<void>;
    setGithubId: (userId: number | string, githubId: number | string) => Promise<void>;
    tokenValidator: (token?: string) => unknown;
    tokenCreator: (user: unknown) => string;
}

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_USER = 'https://api.github.com/user';

export class GithubAuthService {
    private readonly clientId = process.env.GITHUB_CLIENT_ID;
    private readonly clientSecret = process.env.GITHUB_CLIENT_SECRET;
    private readonly callbackUrl = process.env.GITHUB_CALLBACK_URL || 'http://127.0.0.1:7000/auth/github/callback';
    private readonly frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';

    constructor(private readonly d: GithubDeps) {}

    private randomPassword(): string {
        return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    private buildAuthorizeUrl(state: string): string {
        return (
            GITHUB_AUTHORIZE +
            '?client_id=' +
            encodeURIComponent(String(this.clientId)) +
            '&redirect_uri=' +
            encodeURIComponent(this.callbackUrl) +
            '&scope=' +
            encodeURIComponent('read:user user:email') +
            '&state=' +
            encodeURIComponent(state)
        );
    }

    /** GET /auth/github：登录模式授权跳转 */
    loginAuthorizeUrl(redirect: unknown): string {
        const state = redirect || this.frontendUrl + '/login';
        return this.buildAuthorizeUrl(String(state));
    }

    /** GET /auth/github/bind：绑定模式授权跳转（state 携带 {mode:'bind', token, redirect}） */
    bindAuthorizeUrl(redirect: unknown, token: unknown): string {
        const r = redirect || this.frontendUrl + '/login';
        const state = JSON.stringify({ mode: 'bind', token: token || '', redirect: r });
        return this.buildAuthorizeUrl(state);
    }

    /** GET /auth/github/callback：处理回调并返回 302 目标 URL（内部异常一律 error=github_login_failed，与 legacy 一致） */
    async handleCallback(code: unknown, state: unknown): Promise<string> {
        // state 可能是绑定模式 JSON 或登录模式 redirect URL
        let bindMode: { mode?: string; token?: string; redirect?: string } | null = null;
        let frontend = state ? String(state) : this.frontendUrl + '/login';
        if (state !== undefined) {
            try {
                const parsed = JSON.parse(String(state)) as { mode?: string; token?: string; redirect?: string };
                if (parsed && parsed.mode === 'bind') {
                    bindMode = parsed;
                    frontend = parsed.redirect || this.frontendUrl + '/login';
                }
            } catch {
                /* 非 JSON：登录模式 */
            }
        }
        const sep = frontend.includes('?') ? '&' : '?';
        if (!code) {
            return frontend + sep + 'error=github_no_code';
        }
        try {
            // 用 code 换 access_token
            const tokenRes = await axios.post(
                GITHUB_TOKEN_URL,
                {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    code: String(code),
                    redirect_uri: this.callbackUrl,
                },
                { headers: { Accept: 'application/json' } }
            );
            const accessToken = tokenRes.data && tokenRes.data.access_token;
            if (!accessToken) {
                return frontend + sep + 'error=github_token_failed';
            }

            // 拿 GitHub 用户信息
            const userRes = await axios.get(GITHUB_API_USER, {
                headers: { Authorization: 'Bearer ' + accessToken, 'User-Agent': 'jscreator' },
            });
            const gh: GithubUser = userRes.data;

            // ===== 绑定模式：把 github_id 写入当前登录账号 =====
            if (bindMode) {
                const decoded = this.d.tokenValidator(bindMode.token);
                const decodedObj = decoded && typeof decoded === 'object' ? (decoded as { id?: unknown }) : null;
                if (!decodedObj || decodedObj.id === undefined) {
                    return frontend + sep + 'error=github_bind_login_expired';
                }
                const existing = await this.d.getByGithubId(gh.id);
                if (existing && Number(existing.id) !== Number(decodedObj.id)) {
                    return frontend + sep + 'error=github_bind_conflict';
                }
                await this.d.setGithubId(decodedObj.id as number | string, gh.id);
                return frontend + sep + 'success=github_bind_ok';
            }

            // 查已绑定用户，否则自动注册
            let user = await this.d.getByGithubId(gh.id);
            if (!user) {
                let username = String(gh.login || 'gh' + gh.id).slice(0, 50);
                const payload = {
                    github_id: gh.id,
                    name: gh.login ?? null,
                    email: gh.email ?? null,
                    avatar: gh.avatar_url ?? null,
                };
                try {
                    await this.d.registerGithubUser({ ...payload, username, password: this.randomPassword() });
                } catch {
                    // username 冲突时改用 gh{id}
                    username = String('gh' + gh.id).slice(0, 50);
                    await this.d.registerGithubUser({ ...payload, username, password: this.randomPassword() });
                }
                user = await this.d.getByGithubId(gh.id);
                if (!user) {
                    return frontend + sep + 'error=github_register_failed';
                }
            }

            // 签发本站 JWT，重定向回前端
            const token = this.d.tokenCreator(user);
            return (
                frontend +
                sep +
                'token=' +
                encodeURIComponent(token) +
                '&username=' +
                encodeURIComponent(user.username)
            );
        } catch (error) {
            console.error('GitHub 登录错误:', (error as Error).message);
            return frontend + sep + 'error=github_login_failed';
        }
    }
}
