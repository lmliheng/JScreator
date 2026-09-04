/**
 * modules/notification/notification.controller —— 平台广播通知 HTTP 层（/notification/*）。
 * 响应对齐 legacy routes/notification_request.js（管理员专用接口的校验在 controller）。
 */
import type { Request, Response } from 'express';
import type { BroadcastDao } from './notification.dao.js';

function fail(res: Response, code: number, message: string): void {
    res.status(code).json({ code, success: false, message });
}

const VALID_TARGET_TYPES = ['all', 'user', 'role'];
const VALID_NOTIF_TYPES = ['system', 'announcement', 'reminder'];
const VALID_IMPORTANCE = ['high', 'medium', 'low'];

export class BroadcastNotificationController {
    constructor(private readonly dao: BroadcastDao) {}

    /** POST /notification/add（admin 发布） */
    add = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as {
            title?: unknown;
            content?: unknown;
            target_type?: unknown;
            target_id?: unknown;
            type?: unknown;
            importance?: unknown;
        };
        const senderId = (req as Request & { user?: { id: number | string } }).user?.id;
        if (senderId == null) return fail(res, 401, '未登录或登录过期');
        const title = body.title ? String(body.title) : '';
        const content = body.content ? String(body.content) : '';
        if (!title || !content) return fail(res, 400, '标题和内容不能为空');
        const target_type = body.target_type ? String(body.target_type) : '';
        if (!VALID_TARGET_TYPES.includes(target_type)) {
            return fail(res, 400, "target_type 必须为 'all' | 'user' | 'role'");
        }
        if (target_type !== 'all' && !body.target_id) {
            return fail(res, 400, "target_type 为 'user' 或 'role' 时必须提供 target_id");
        }
        const notifType = body.type && VALID_NOTIF_TYPES.includes(String(body.type)) ? String(body.type) : 'announcement';
        const importance = body.importance && VALID_IMPORTANCE.includes(String(body.importance)) ? String(body.importance) : 'medium';
        try {
            const notification_id = await this.dao.add({
                title,
                content,
                senderId,
                targetType: target_type,
                targetId: body.target_id != null ? String(body.target_id) : null,
                type: notifType,
                importance,
            });
            res.json({ code: 200, success: true, message: '通知发布成功', data: { notification_id } });
        } catch (error) {
            console.error('发布通知错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    /** GET /notification/list（当前用户可见列表，不分页） */
    list = async (req: Request, res: Response): Promise<void> => {
        const userId = (req as Request & { user?: { id: number | string } }).user?.id;
        if (userId == null) return fail(res, 401, '未登录或登录过期');
        try {
            const list = await this.dao.getForUser(userId);
            res.json({ code: 200, success: true, message: '获取通知列表成功', data: { list, total: list.length } });
        } catch (error) {
            console.error('获取通知列表错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    /** GET /notification/unread-count */
    unreadCount = async (req: Request, res: Response): Promise<void> => {
        const userId = (req as Request & { user?: { id: number | string } }).user?.id;
        if (userId == null) return fail(res, 401, '未登录或登录过期');
        try {
            const unread_count = await this.dao.getUnreadCount(userId);
            res.json({ code: 200, success: true, message: '获取未读数成功', data: { unread_count } });
        } catch (error) {
            console.error('获取未读数错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    /** POST /notification/read */
    read = async (req: Request, res: Response): Promise<void> => {
        const userId = (req as Request & { user?: { id: number | string } }).user?.id;
        if (userId == null) return fail(res, 401, '未登录或登录过期');
        const notification_id = (req.body ?? {}).notification_id;
        if (!notification_id) return fail(res, 400, 'notification_id 不能为空');
        try {
            await this.dao.markRead(notification_id as number | string, userId);
            res.json({ code: 200, success: true, message: '标记已读成功', data: { notification_id } });
        } catch (error) {
            console.error('标记已读错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    /** PUT /notification/update（admin） */
    update = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const notification_id = body.notification_id;
        if (!notification_id) return fail(res, 400, 'notification_id 不能为空');
        try {
            const updated = await this.dao.update(notification_id as number | string, {
                title: body.title,
                content: body.content,
                target_type: body.target_type,
                target_id: body.target_id,
                type: body.type,
                importance: body.importance,
            });
            if (!updated) return fail(res, 400, '没有需要更新的字段');
            res.json({ code: 200, success: true, message: '更新通知成功' });
        } catch (error) {
            console.error('更新通知错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    /** DELETE /notification/delete（admin） */
    remove = async (req: Request, res: Response): Promise<void> => {
        const notification_id = (req.body ?? {}).notification_id;
        if (!notification_id) return fail(res, 400, 'notification_id 不能为空');
        try {
            await this.dao.remove(notification_id as number | string);
            res.json({ code: 200, success: true, message: '删除通知成功' });
        } catch (error) {
            console.error('删除通知错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };
}
