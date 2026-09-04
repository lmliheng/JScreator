/**
 * modules/auth/totp/totp.service —— TOTP（Google Authenticator）绑定与登录业务。
 * 对齐 legacy routes/totp_request.js；otplib 由本地 require 加载（根 node_modules）。
 */
import { createRequire } from 'node:module';
import type { UserRow } from '../../user/user.dao.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require('otplib') as {
    authenticator: {
        generateSecret: () => string;
        keyuri: (account: string, issuer: string, secret: string) => string;
        check: (code: string, secret: string) => boolean;
    };
};

const ISSUER = 'JScreator';

export interface TotpSetupInfo {
    secret: string;
    uri: string;
}

export interface TotpDeps {
    getBasicById: (id: number | string) => Promise<UserRow | null>;
    getTotpSecret: (id: number | string) => Promise<string | null>;
    setTotpSecret: (id: number | string, secret: string | null) => Promise<void>;
    findByAccountForTotp: (account: string) => Promise<UserRow | null>;
    tokenCreator: (user: unknown) => string;
}

export class TotpService {
    constructor(private readonly d: TotpDeps) {}

    async setup(userId: number | string): Promise<TotpSetupInfo | 'user-missing'> {
        const user = await this.d.getBasicById(userId);
        if (!user) {
            return 'user-missing';
        }
        const secret = authenticator.generateSecret();
        // 先返回给前端扫码；确认（confirm）时才写库
        const account = user.username || user.email || String(user.id);
        const uri = authenticator.keyuri(account, ISSUER, secret);
        return { secret, uri };
    }

    /** 确认绑定：验证 6 位码后把 secret 入库 */
    async confirm(userId: number | string, secret: string, code: string): Promise<boolean> {
        const valid = authenticator.check(code, secret);
        if (!valid) {
            return false;
        }
        await this.d.setTotpSecret(userId, secret);
        return true;
    }

    /** 解绑：未绑定 → 'not-bound'；动态码错 → 'code-wrong'；成功置 NULL */
    async disable(userId: number | string, code: string): Promise<'ok' | 'not-bound' | 'code-wrong'> {
        const secret = await this.d.getTotpSecret(userId);
        if (!secret) {
            return 'not-bound';
        }
        if (!authenticator.check(code, secret)) {
            return 'code-wrong';
        }
        await this.d.setTotpSecret(userId, null);
        return 'ok';
    }

    async status(userId: number | string): Promise<{ bound: boolean }> {
        return { bound: (await this.d.getTotpSecret(userId)) !== null };
    }

    /** TOTP 直接登录 */
    async login(account: string, code: string): Promise<{ token: string; user: UserRow } | 'no-account' | 'not-bound' | 'code-wrong'> {
        const user = await this.d.findByAccountForTotp(account);
        if (!user) {
            return 'no-account';
        }
        if (!user.totp_secret) {
            return 'not-bound';
        }
        if (!authenticator.check(String(code).trim(), user.totp_secret)) {
            return 'code-wrong';
        }
        return { token: this.d.tokenCreator(user), user };
    }
}
