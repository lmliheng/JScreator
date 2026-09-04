/**
 * modules/auth/email/emailAuth.service —— 邮箱验证码登录业务。
 * 对齐 legacy routes/auth_email.js：内存验证码（5 分钟），邮箱不存在则自动注册（冲突用户名回退）。
 */
import type { UserRow } from '../../user/user.dao.js';

export interface EmailLoginOk {
    token: string;
    user: UserRow;
}

export interface EmailDeps {
    findByEmail: (email: string) => Promise<UserRow | null>;
    registerEmailUser: (username: string, email: string, password: string) => Promise<void>;
    /** utils/emailSender.sendVerificationCode（SMTP 失败内部吞错，与 legacy 一致） */
    sendVerificationCode: (to: string, code: string) => Promise<unknown>;
    tokenCreator: (user: unknown) => string;
}

interface CodeRecord {
    code: string;
    expireAt: number;
}

const CODE_TTL_MS = 5 * 60 * 1000;

export class EmailAuthService {
    /** 内存验证码存储：email -> { code, expireAt }（单进程，与 legacy 相同语义） */
    private readonly codeStore = new Map<string, CodeRecord>();

    constructor(private readonly d: EmailDeps) {}

    private generateCode(): string {
        return String(Math.floor(100000 + Math.random() * 900000));
    }

    private randomPassword(): string {
        return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    /** 生成并“发送”验证码（真正发送动作在 deps，失败抛错由 controller 决定是否 500） */
    async sendCode(email: string): Promise<void> {
        const code = this.generateCode();
        this.codeStore.set(email, { code, expireAt: Date.now() + CODE_TTL_MS });
        await this.d.sendVerificationCode(email, code);
    }

    /** 校验验证码：正确且未过期返回 true 并立即消费（删除）；否则 false */
    validateCode(email: string, code: string): boolean {
        const rec = this.codeStore.get(email);
        if (!rec || String(rec.code) !== String(code) || Date.now() > rec.expireAt) {
            return false;
        }
        this.codeStore.delete(email);
        return true;
    }

    /** 验证码通过后：取用户，不存在则自动注册（含 username 冲突回退），返回 token+user */
    async login(email: string): Promise<EmailLoginOk | 'register-failed'> {
        let user = await this.d.findByEmail(email);
        if (!user) {
            let username = (email.split('@')[0] || 'user').slice(0, 50);
            try {
                await this.d.registerEmailUser(username, email, this.randomPassword());
            } catch {
                // username 冲突时用时间戳兜底（与 legacy 一致）
                username = ('u' + Date.now()).slice(0, 50);
                await this.d.registerEmailUser(username, email, this.randomPassword());
            }
            user = await this.d.findByEmail(email);
            if (!user) {
                return 'register-failed';
            }
        }
        return { token: this.d.tokenCreator(user), user };
    }
}
