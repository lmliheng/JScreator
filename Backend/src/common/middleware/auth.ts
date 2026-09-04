/**
 * common/middleware/auth：鉴权与角色校验（与根 utils/authMiddleware.js 语义一致）。
 * P3 起供 TS 路由使用；legacy 路由迁移完成前仍各自使用手写鉴权。
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { loadTokenValidator } from '../../legacy.js';

export interface TokenPayload {
    id: number;
    role_id?: number;
}

function parseToken(token: string | undefined): TokenPayload | null {
    const decoded = loadTokenValidator()(token);
    if (!decoded || typeof decoded !== 'object' || (decoded as { id?: unknown }).id === undefined) {
        return null;
    }
    return decoded as TokenPayload;
}

export type AuthedRequest = Request & { user?: TokenPayload };

/** 鉴权中间件：解析 Authorization: Bearer <token>；成功 req.user = decoded，失败 401 */
export const verifyToken: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const user = parseToken(req.headers.authorization);
    if (user === null) {
        res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
        return;
    }
    (req as AuthedRequest).user = user;
    next();
};

/** 角色校验：requireRole(1, 3) 表示只允许 role_id 为 1 或 3 的用户；需在 verifyToken 之后调用 */
export function requireRole(...roleIds: number[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as AuthedRequest).user;
        if (!user || !roleIds.includes(Number(user.role_id))) {
            res.status(403).json({ code: 403, success: false, message: '权限不足' });
            return;
        }
        next();
    };
}

/** 管理端守卫：verifyToken 之后查库确认 role_id === 1（对齐 legacy requireAdmin 语义） */
export function adminOnly(getRoleId: (id: number | string) => Promise<number | null>): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        const id = (req as AuthedRequest).user?.id;
        if (id == null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const role = await getRoleId(id);
        if (Number(role) !== 1) {
            res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员可操作' });
            return;
        }
        next();
    };
}
