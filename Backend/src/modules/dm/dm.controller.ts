/**
 * modules/dm/dm.controller —— /dm/* HTTP 层（登录用户；响应无 message 的端点与 legacy 一致）。
 */
import type { Request, Response } from 'express';
import type { DmService } from './dm.service.js';
import type { AuthedRequest } from '../../common/middleware/auth.js';

function actorId(req: Request): number | string | null {
    const user = (req as AuthedRequest).user;
    return user && user.id != null ? user.id : null;
}

export class DmController {
    constructor(private readonly svc: DmService) {}

    conversations = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        try {
            const list = await this.svc.conversations(id);
            res.json({ code: 200, success: true, data: { list } });
        } catch (e) {
            console.error('DM 会话列表错误:', e);
            res.status(500).json({ code: 500, success: false, message: '获取失败' });
        }
    };

    messages = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const otherId = Number(req.params.otherId);
        const { page, pageSize } = req.query;
        try {
            const list = await this.svc.messages(id, otherId, page, pageSize);
            res.json({ code: 200, success: true, data: { list } });
        } catch (e) {
            console.error('DM 消息错误:', e);
            res.status(500).json({ code: 500, success: false, message: '获取失败' });
        }
    };

    unreadCount = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        try {
            const count = await this.svc.unreadCount(id);
            res.json({ code: 200, success: true, data: { count } });
        } catch {
            res.status(500).json({ code: 500, success: false, message: '获取失败' });
        }
    };

    read = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const other_id = (req.body ?? {}).other_id;
        if (!other_id) {
            res.status(400).json({ code: 400, success: false, message: '参数缺失' });
            return;
        }
        try {
            await this.svc.markRead(id, Number(other_id));
            res.json({ code: 200, success: true, message: 'ok' });
        } catch {
            res.status(500).json({ code: 500, success: false, message: '操作失败' });
        }
    };
}
