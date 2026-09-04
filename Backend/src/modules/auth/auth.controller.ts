/**
 * modules/auth/auth.controller —— 登录/注册 HTTP 层。
 * 响应体逐字段对齐 legacy routes/login_request.js & register_request.js（含状态码怪癖：
 * 校验失败 HTTP200 + body.code=400；username 登录 catch 也是 HTTP200 + body.code=500；email 登录 catch 无 code）。
 */
import type { Request, Response } from 'express';
import type { AuthService } from './auth.service.js';

interface LoginBody {
    email?: unknown;
    username?: unknown;
    password?: unknown;
}

interface RegisterBody {
    register_mode?: unknown;
    username?: unknown;
    email?: unknown;
    password?: unknown;
}

function loginTime(): string {
    return new Date().toLocaleString();
}

export class AuthController {
    constructor(private readonly svc: AuthService) {}

    /** POST /sys/login */
    login = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as LoginBody;
        if (body.email) {
            // ---- 邮箱登录 ----
            try {
                const out = await this.svc.loginByEmail(String(body.email), String(body.password ?? ''));
                if (out === null) {
                    res.status(401).json({ code: 401, success: false, message: '邮箱或密码错误' });
                    return;
                }
                const u = out.user;
                res.json({
                    code: 200,
                    success: true,
                    message: '登录成功',
                    token: out.token,
                    user_info: {
                        id: u.id,
                        username: u.username,
                        email: u.email,
                        role_id: u.role_id,
                        avatar: u.avatar,
                        login_time: loginTime(),
                    },
                });
            } catch (error) {
                console.error('登录错误:', error);
                res.status(500).json({ success: false, message: '服务器内部错误' });
            }
            return;
        }
        // ---- 用户名登录 ----
        try {
            const out = await this.svc.loginByUsername(String(body.username ?? ''), String(body.password ?? ''));
            if (out === null) {
                res.status(401).json({ code: 401, success: false, message: '用户名或密码错误' });
                return;
            }
            const u = out.user;
            res.json({
                code: 200,
                success: true,
                message: '登录成功',
                token: out.token,
                user_info: {
                    id: u.id,
                    username: u.username,
                    email: u.email,
                    role_id: u.role_id,
                    avatar: u.avatar,
                    bio: u.bio,
                    area: u.area,
                    name: u.name,
                    vipLevel: u.name, // 与 legacy 一致的字段怪癖：vipLevel 实为 name
                    checkinDay: u.checkinDay,
                    login_time: loginTime(),
                },
            });
        } catch (error) {
            console.error('登录错误:', error);
            res.json({ code: 500, success: false, message: '登录失败' });
        }
    };

    /** POST /sys/register */
    register = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as RegisterBody;
        const mode = body.register_mode ? String(body.register_mode) : '';
        if (mode === 'email') {
            // 与 legacy 一致：邮箱注册模式为占位
            res.json({ code: 200, success: true, message: '邮箱注册模式，未开发' });
            return;
        }
        // mode === ''（简单注册）为主路径；未知 mode 也走主路径（legacy 会无响应，属行为修正）
        const username = body.username ? String(body.username) : undefined;
        const email = body.email ? String(body.email) : undefined;
        const password = body.password ? String(body.password) : undefined;
        if (!username || !email || !password) {
            res.json({ code: 400, success: false, message: '用户名、邮箱或密码不能为空' });
            return;
        }
        try {
            const out = await this.svc.register(username, email, password);
            if ('code' in out) {
                res.json({ code: out.code, success: false, message: out.message });
                return;
            }
            res.json({
                code: 200,
                success: true,
                message: '注册成功',
                token: out.token,
                user_info: { id: out.id, username: out.username, email: out.email },
            });
        } catch (error) {
            console.error('注册用户错误:', error);
            res.status(500).send('注册用户失败');
        }
    };
}
