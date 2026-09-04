/**
 * modules/auth/totp/totp.controller —— /totp/* 响应对齐 legacy（ok 恒含 data 字段，失败 res.status(code)）。
 */
import type { Request, Response } from 'express';
import type { TotpService } from './totp.service.js';
import type { AuthedRequest } from '../../../common/middleware/auth.js';

function fail(res: Response, code: number, message: string): void {
    res.status(code).json({ code, success: false, message });
}

// legacy ok()：恒输出 data（默认 {}；传入 null 时输出 data: null）
function ok(res: Response, data: unknown, message = 'ok'): void {
    res.json({ code: 200, success: true, message, data });
}

function loginUserId(req: Request): number | string | null {
    const user = (req as AuthedRequest).user;
    return user && user.id != null ? user.id : null;
}

export class TotpController {
    constructor(private readonly svc: TotpService) {}

    /** POST /totp/setup */
    setup = async (req: Request, res: Response): Promise<void> => {
        const id = loginUserId(req);
        if (id === null) return fail(res, 401, '未登录或登录过期');
        try {
            const out = await this.svc.setup(id);
            if (out === 'user-missing') return fail(res, 404, '用户不存在');
            ok(res, out, '获取绑定信息成功');
        } catch (e) {
            console.error('TOTP setup 错误:', e);
            fail(res, 500, '服务器内部错误');
        }
    };

    /** POST /totp/confirm */
    confirm = async (req: Request, res: Response): Promise<void> => {
        const id = loginUserId(req);
        if (id === null) return fail(res, 401, '未登录或登录过期');
        const secret = String((req.body ?? {}).secret ?? '');
        const code = String((req.body ?? {}).code ?? '');
        if (!secret || !code) return fail(res, 400, '参数缺失');
        try {
            const okFlag = await this.svc.confirm(id, secret, code);
            if (!okFlag) return fail(res, 400, '验证码不正确，请重试');
            ok(res, null, 'TOTP 绑定成功');
        } catch (e) {
            console.error('TOTP confirm 错误:', e);
            fail(res, 500, '服务器内部错误');
        }
    };

    /** POST /totp/disable */
    disable = async (req: Request, res: Response): Promise<void> => {
        const id = loginUserId(req);
        if (id === null) return fail(res, 401, '未登录或登录过期');
        const code = String((req.body ?? {}).code ?? '');
        try {
            const out = await this.svc.disable(id, code);
            if (out === 'not-bound') return fail(res, 400, '尚未绑定 TOTP');
            if (out === 'code-wrong') return fail(res, 400, '验证码不正确');
            ok(res, null, '已解绑 TOTP');
        } catch (e) {
            console.error('TOTP disable 错误:', e);
            fail(res, 500, '服务器内部错误');
        }
    };

    /** GET /totp/status */
    status = async (req: Request, res: Response): Promise<void> => {
        const id = loginUserId(req);
        if (id === null) return fail(res, 401, '未登录或登录过期');
        try {
            const out = await this.svc.status(id);
            ok(res, out);
        } catch (e) {
            console.error('TOTP status 错误:', e);
            fail(res, 500, '服务器内部错误');
        }
    };

    /** POST /totp/login（公开） */
    login = async (req: Request, res: Response): Promise<void> => {
        const account = String((req.body ?? {}).account ?? '').trim();
        const code = String((req.body ?? {}).code ?? '').trim();
        if (!account || !code) return fail(res, 400, '账号和动态码不能为空');
        try {
            const out = await this.svc.login(account, code);
            if (out === 'no-account') return fail(res, 401, '账号不存在');
            if (out === 'not-bound') return fail(res, 400, '该账号未绑定 TOTP，请先登录后在个人设置中绑定');
            if (out === 'code-wrong') return fail(res, 401, '动态码错误或已过期');
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
                    vipLevel: u.name, // 与 legacy 一致的字段怪癖
                    checkinDay: u.checkinDay,
                    login_time: new Date().toLocaleString(),
                },
            });
        } catch (e) {
            console.error('TOTP login 错误:', e);
            fail(res, 500, '服务器内部错误');
        }
    };
}
