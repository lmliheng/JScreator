/**
 * modules/user/user.controller —— 用户域 HTTP 层。响应与状态码逐字段对齐 legacy routes/user_request.js。
 */
import type { Request, Response } from 'express';
import type { UserService } from './user.service.js';
import type { AuthedRequest } from '../../common/middleware/auth.js';

export interface UserControllerDeps {
    /** 解析 Authorization 返回 {id}；无效返回 null（tokenValidator 语义） */
    resolveToken: (token: string | undefined) => { id: number | string } | null;
}

function fail(res: Response, status: number, message: string): void {
    res.status(status).json({ code: status, success: false, message });
}

function actorId(req: Request): number | string | null {
    const user = (req as AuthedRequest).user;
    return user && user.id != null ? user.id : null;
}

function pickFields(body: Record<string, unknown>, keys: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
        if (body[k] !== undefined) out[k] = body[k];
    }
    return out;
}

export class UserController {
    constructor(
        private readonly svc: UserService,
        private readonly deps: UserControllerDeps
    ) {}

    /** GET /sys/profile（特殊：invalid token 走 500 文案，与 legacy 一致） */
    profile = async (req: Request, res: Response): Promise<void> => {
        try {
            const decoded = this.deps.resolveToken(req.headers.authorization);
            if (!decoded) {
                // legacy：无效 token 在 db 层抛错 → catch 输出 code500（HTTP200）
                res.json({ code: 500, success: false, message: '获取用户信息失败' });
                return;
            }
            const out = await this.svc.profile(decoded.id);
            if (out === null) {
                res.json({ code: 401, success: false, message: '找不到用户信息，是否未登录或登录过期' });
                return;
            }
            res.json({
                code: 200,
                success: true,
                message: '获取用户信息成功',
                user_info: {
                    user_detail: out.user_detail,
                    user_permission: out.user_permission,
                    login_time: new Date().toLocaleString(),
                },
            });
        } catch (error) {
            console.error('获取用户信息错误:', error);
            res.json({ code: 500, success: false, message: '获取用户信息失败' });
        }
    };

    /** PUT /userInfo：本人或管理员 */
    updateSelf = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) return fail(res, 401, '未登录或登录过期');
        const body = (req.body ?? {}) as Record<string, unknown>;
        const targetId = body.id;
        if (!targetId) return fail(res, 400, '用户id不能为空');
        try {
            if (!(await this.svc.canEditTarget(targetId as number | string, id))) {
                return fail(res, 403, '权限不足，仅可修改自己的主页设置');
            }
            await this.svc.updateSelfProfile(
                targetId as number | string,
                pickFields(body, ['username', 'email', 'bio', 'vip', 'checkinDay', 'name', 'area', 'avatar', 'socials', 'featured_articles'])
            );
            res.json({ code: 200, success: true, message: '更新用户信息成功' });
        } catch (error) {
            console.error('更新用户信息错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    /** POST /userInfo/unbind-github */
    unbindGithub = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) return fail(res, 401, '未登录或登录过期');
        try {
            await this.svc.unbindGithub(id);
            res.json({ code: 200, success: true, message: '已解除 GitHub 绑定' });
        } catch (error) {
            console.error('解除 GitHub 绑定错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    /** POST /resetPassword（本人） */
    resetMyPassword = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) return fail(res, 401, '未登录或登录过期');
        const password = String((req.body ?? {}).password ?? '');
        if (!password) return fail(res, 400, '密码不能为空');
        try {
            await this.svc.resetMyPassword(id, password);
            res.json({ code: 200, success: true, message: '重置用户密码成功' });
        } catch (error) {
            console.error('重置用户密码错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    // ================= 用户管理（管理员） =================

    listUsers = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(String(req.query.page ?? ''), 10) || 1;
            const pageSize = parseInt(String(req.query.pageSize ?? req.query.page_size ?? ''), 10) || 10;
            const keyword = String(req.query.keyword ?? '').trim();
            const result = await this.svc.list(page, pageSize, keyword);
            res.json({
                code: 200,
                success: true,
                message: '获取用户列表成功',
                data: {
                    list: result.list,
                    total: result.total,
                    page: result.page,
                    pageSize: result.pageSize,
                    size: result.list.length,
                },
            });
        } catch (error) {
            console.error('获取用户列表错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    detailUser = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = await this.svc.detail(req.params.id as number | string);
            if (!user) {
                res.status(404).json({ code: 404, success: false, message: '用户不存在' });
                return;
            }
            res.json({ code: 200, success: true, message: '获取用户详情成功', data: user });
        } catch (error) {
            console.error('获取用户详情错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    addUser = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as { username?: unknown; email?: unknown; password?: unknown; role_id?: unknown };
        const username = body.username ? String(body.username) : '';
        const email = body.email ? String(body.email) : '';
        const password = body.password ? String(body.password) : '';
        if (!username || !email || !password) {
            return fail(res, 400, '用户名、邮箱、密码不能为空');
        }
        try {
            const out = await this.svc.add({ username, email, password, roleId: body.role_id });
            if (!out.ok) {
                return fail(res, 400, out.message);
            }
            res.json({ code: 200, success: true, message: '新增用户成功', data: { id: out.id } });
        } catch (error) {
            console.error('新增用户错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    updateByAdmin = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const id = body.id;
        if (!id) return fail(res, 400, '用户id不能为空');
        try {
            const updated = await this.svc.updateByAdmin(
                id as number | string,
                pickFields(body, ['username', 'email', 'role_id', 'bio', 'vip', 'checkinDay', 'name', 'area', 'avatar'])
            );
            if (!updated) {
                return fail(res, 400, '没有需要更新的字段');
            }
            res.json({ code: 200, success: true, message: '更新用户成功' });
        } catch (error) {
            console.error('更新用户错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    resetByAdmin = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as { id?: unknown; password?: unknown };
        const id = body.id ? String(body.id) : '';
        const password = body.password ? String(body.password) : '';
        if (!id || !password) {
            return fail(res, 400, '用户id和新密码不能为空');
        }
        try {
            await this.svc.adminResetPassword(id, password);
            res.json({ code: 200, success: true, message: '重置密码成功' });
        } catch (error) {
            console.error('重置密码错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    deleteUser = async (req: Request, res: Response): Promise<void> => {
        const id = (req.body ?? {}).id;
        if (!id) return fail(res, 400, '用户id不能为空');
        try {
            await this.svc.remove(id as number | string);
            res.json({ code: 200, success: true, message: '删除用户成功' });
        } catch (error) {
            console.error('删除用户错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    deleteBatch = async (req: Request, res: Response): Promise<void> => {
        const me = actorId(req);
        if (me === null) return fail(res, 401, '未登录或登录过期');
        const ids = (req.body ?? {}).ids;
        if (!Array.isArray(ids) || ids.length === 0) {
            return fail(res, 400, '请选择要删除的用户');
        }
        try {
            const filtered = (ids as Array<number | string>).filter((x) => Number(x) !== Number(me));
            if (filtered.length === 0) {
                return fail(res, 400, '不能删除自己');
            }
            const affected = await this.svc.removeBatch(filtered);
            res.json({ code: 200, success: true, message: `已删除 ${affected} 个用户` });
        } catch (error) {
            console.error('批量删除用户错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };
}
