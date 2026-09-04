/**
 * modules/auth/email/emailAuth.controller —— /email/send-code、/email/login。
 * 响应体逐字段对齐 legacy routes/auth_email.js。
 */
import type { Request, Response } from 'express';
import type { EmailAuthService } from './emailAuth.service.js';

interface EmailBody {
    email?: unknown;
    code?: unknown;
}

export class EmailAuthController {
    constructor(private readonly svc: EmailAuthService) {}

    /** POST /email/send-code */
    sendCode = async (req: Request, res: Response): Promise<void> => {
        const email = String((req.body ?? {}).email ?? '').trim();
        if (!email) {
            res.status(400).json({ code: 400, success: false, message: '邮箱不能为空' });
            return;
        }
        try {
            await this.svc.sendCode(email);
            res.json({ code: 200, success: true, message: '验证码已发送，请查收邮件' });
        } catch (e) {
            console.error('发送验证码错误:', (e as Error).message);
            res.status(500).json({ code: 500, success: false, message: '验证码发送失败' });
        }
    };

    /** POST /email/login */
    login = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as EmailBody;
        const email = body.email ? String(body.email) : '';
        const code = body.code ? String(body.code) : '';
        if (!email || !code) {
            res.status(400).json({ code: 400, success: false, message: '邮箱和验证码不能为空' });
            return;
        }
        if (!this.svc.validateCode(email, code)) {
            res.status(400).json({ code: 400, success: false, message: '验证码错误或已过期' });
            return;
        }
        try {
            const out = await this.svc.login(email);
            if (out === 'register-failed') {
                res.status(500).json({ code: 500, success: false, message: '注册失败' });
                return;
            }
            const u = out.user;
            res.json({
                code: 200,
                success: true,
                message: '登录成功',
                token: out.token,
                user: {
                    id: u.id,
                    username: u.username,
                    email: u.email,
                    role_id: u.role_id,
                    avatar: u.avatar,
                    name: u.name,
                },
            });
        } catch (e) {
            console.error('邮箱登录错误:', (e as Error).message);
            res.status(500).json({ code: 500, success: false, message: '服务器内部错误' });
        }
    };
}
