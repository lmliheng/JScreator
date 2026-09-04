/**
 * modules/social/social.controller —— /social/* HTTP 层。每个端点 catch 的 500 文案对齐 legacy。
 */
import type { Request, Response } from 'express';
import type { SocialService, SResult } from './social.service.js';
import type { AuthedRequest } from '../../common/middleware/auth.js';

export interface SocialControllerDeps {
    resolveToken: (token: string | undefined) => { id: number | string } | null;
}

function actorId(req: Request): number | string | null {
    const user = (req as AuthedRequest).user;
    return user && user.id != null ? user.id : null;
}

function render(res: Response, out: SResult): void {
    if (!out.ok) {
        res.status(out.status).json({ code: out.status, success: false, message: out.message });
        return;
    }
    const body: Record<string, unknown> = { code: 200, success: true };
    if (!out.omitMessage) body.message = out.message;
    if (out.data !== undefined) body.data = out.data;
    res.json(body);
}

export class SocialController {
    constructor(
        private readonly svc: SocialService,
        private readonly deps: SocialControllerDeps
    ) {}

    follow = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        try {
            render(res, await this.svc.toggleFollow(id, String(req.params.username)));
        } catch (error) {
            console.error('关注操作错误:', error);
            res.status(500).json({ code: 500, success: false, message: '操作失败' });
        }
    };

    following = async (req: Request, res: Response): Promise<void> => {
        try {
            render(res, await this.svc.followingByUsername(String(req.params.username)));
        } catch (error) {
            console.error('获取关注列表错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取失败' });
        }
    };

    followers = async (req: Request, res: Response): Promise<void> => {
        try {
            render(res, await this.svc.followersByUsername(String(req.params.username)));
        } catch (error) {
            console.error('获取粉丝列表错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取失败' });
        }
    };

    stats = async (req: Request, res: Response): Promise<void> => {
        try {
            const viewer = this.deps.resolveToken(req.headers.authorization);
            render(res, await this.svc.statsByUsername(String(req.params.username), viewer ? viewer.id : null));
        } catch (error) {
            console.error('获取社交统计错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取失败' });
        }
    };

    like = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        try {
            render(res, await this.svc.toggleLike(id, String(req.params.articleId)));
        } catch (error) {
            console.error('点赞操作错误:', error);
            res.status(500).json({ code: 500, success: false, message: '操作失败' });
        }
    };

    status = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        try {
            render(res, await this.svc.statusBatch(id, req.query.ids));
        } catch (error) {
            console.error('查询点赞收藏状态错误:', error);
            res.status(500).json({ code: 500, success: false, message: '查询失败' });
        }
    };

    favorite = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        try {
            render(res, await this.svc.toggleFavorite(id, String(req.params.articleId)));
        } catch (error) {
            console.error('收藏操作错误:', error);
            res.status(500).json({ code: 500, success: false, message: '操作失败' });
        }
    };

    myFavorites = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        try {
            render(res, await this.svc.myFavorites(id));
        } catch (error) {
            console.error('获取收藏列表错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取失败' });
        }
    };

    notifications = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const { page, pageSize } = req.query;
        try {
            render(res, await this.svc.notificationPage(id, page, pageSize));
        } catch (error) {
            console.error('获取通知列表错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取失败' });
        }
    };

    notificationsUnread = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        try {
            render(res, await this.svc.notificationUnread(id));
        } catch (error) {
            console.error('获取未读数错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取失败' });
        }
    };

    notificationsRead = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        try {
            render(res, await this.svc.notificationMarkRead(id, (req.body ?? {}) as { id?: unknown; all?: unknown }));
        } catch (error) {
            console.error('标记通知已读错误:', error);
            res.status(500).json({ code: 500, success: false, message: '操作失败' });
        }
    };

    // ===== 后台管理 =====
    adminLikes = async (req: Request, res: Response): Promise<void> => {
        const { page, pageSize, keyword } = req.query;
        try {
            render(res, await this.svc.adminLikes(page, pageSize, keyword));
        } catch (error) {
            console.error('获取点赞记录错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取失败' });
        }
    };

    adminLikeDelete = async (req: Request, res: Response): Promise<void> => {
        try {
            render(res, await this.svc.adminLikeDelete(req.params.id as string));
        } catch (error) {
            console.error('删除点赞记录错误:', error);
            res.status(500).json({ code: 500, success: false, message: '删除失败' });
        }
    };

    adminFavorites = async (req: Request, res: Response): Promise<void> => {
        const { page, pageSize, keyword } = req.query;
        try {
            render(res, await this.svc.adminFavorites(page, pageSize, keyword));
        } catch (error) {
            console.error('获取收藏记录错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取失败' });
        }
    };

    adminFavoriteDelete = async (req: Request, res: Response): Promise<void> => {
        try {
            render(res, await this.svc.adminFavoriteDelete(req.params.id as string));
        } catch (error) {
            console.error('删除收藏记录错误:', error);
            res.status(500).json({ code: 500, success: false, message: '删除失败' });
        }
    };
}
