/**
 * modules/auth/auth.service —— 登录/注册业务规则。
 * 行为对齐 legacy routes/login_request.js 与 register_request.js（含 message 文案）；
 * 密码哈希/比对与 ID 生成复用既有 utils（crypto_password / id_creator），保证与存量数据兼容。
 */
import type { UserId, UserRow } from '../user/user.dao.js';

export interface LoginOk {
    token: string;
    user: UserRow;
}

export interface RegisterOk {
    token: string;
    id: UserId;
    username: string;
    email: string;
}

export interface CredentialFailure {
    code: 400;
    message: string;
}

export type RegisterOutcome = RegisterOk | CredentialFailure;

export interface AuthDeps {
    findByEmail: (email: string) => Promise<UserRow | null>;
    findByUsername: (username: string) => Promise<UserRow | null>;
    existsByEmail: (email: string) => Promise<boolean>;
    existsByUsername: (username: string) => Promise<boolean>;
    insertUser: (id: UserId, username: string, email: string, passwordHash: string) => Promise<void>;
    /** SHA256（crypto_password.ToHash），必须与存量哈希算法一致 */
    ToHash: (password: string) => string;
    ComparePassword: (password: string, hashedPassword: string) => boolean;
    /** JWT 签发（token_creator.tokenCreator，仅取 id/role_id；其余字段忽略） */
    tokenCreator: (user: unknown) => string;
    generateId: () => UserId;
}

export class AuthService {
    constructor(private readonly d: AuthDeps) {}

    /** 邮箱登录：账号不存在或密码错 → null（对应 legacy 401 分支） */
    async loginByEmail(email: string, password: string): Promise<LoginOk | null> {
        const user = await this.d.findByEmail(email);
        if (!user || !this.d.ComparePassword(password, user.password)) {
            return null;
        }
        return { token: this.d.tokenCreator(user), user };
    }

    /** 用户名登录：同上 */
    async loginByUsername(username: string, password: string): Promise<LoginOk | null> {
        const user = await this.d.findByUsername(username);
        if (!user || !this.d.ComparePassword(password, user.password)) {
            return null;
        }
        return { token: this.d.tokenCreator(user), user };
    }

    /** 注册：查重 → 哈希 → 落库 → 发 token（校验字段缺失由 controller 负责，与 legacy 一致） */
    async register(username: string, email: string, password: string): Promise<RegisterOutcome> {
        if (await this.d.existsByEmail(email)) {
            return { code: 400, message: '邮箱已存在' };
        }
        if (await this.d.existsByUsername(username)) {
            return { code: 400, message: '用户名已存在' };
        }
        const id = this.d.generateId();
        const hash = this.d.ToHash(password);
        await this.d.insertUser(id, username, email, hash);
        const token = this.d.tokenCreator({ id, username, email });
        return { token, id, username, email };
    }
}
