/**
 * modules/notification/notification.routes —— 用户侧（list/unread/read）+ 管理侧（add/update/delete，admin）。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import { verifyToken } from '../../common/middleware/auth.js';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { BroadcastNotificationController } from './notification.controller.js';

/** 广播通知管理守卫：管理员文案与 legacy 一致 */
function adminNotif(getRoleId: (id: number | string) => Promise<number | null>): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        const id = (req as Request & { user?: { id: number | string } }).user?.id;
        if (id == null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const role = await getRoleId(id);
        if (Number(role) !== 1) {
            res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员可发布通知' });
            return;
        }
        next();
    };
}

export function notificationRoutes(
    ctrl: BroadcastNotificationController,
    getRoleId: (id: number | string) => Promise<number | null>
): Router {
    const admin = [verifyToken, adminNotif(getRoleId)] as RequestHandler[];
    const r = Router();
    r.post('/notification/add', ...admin, asyncHandler(ctrl.add.bind(ctrl)));
    r.get('/notification/list', verifyToken, asyncHandler(ctrl.list.bind(ctrl)));
    r.get('/notification/unread-count', verifyToken, asyncHandler(ctrl.unreadCount.bind(ctrl)));
    r.post('/notification/read', verifyToken, asyncHandler(ctrl.read.bind(ctrl)));
    r.put('/notification/update', ...admin, asyncHandler(ctrl.update.bind(ctrl)));
    r.delete('/notification/delete', ...admin, asyncHandler(ctrl.remove.bind(ctrl)));
    return r;
}
