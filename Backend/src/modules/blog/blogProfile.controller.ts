/**
 * modules/blog/blogProfile.controller —— /blog/* HTTP 层，成功/失败响应对齐 legacy。
 */
import type { Request, Response } from 'express';
import type { BlogProfileService } from './blogProfile.service.js';

function render(res: Response, result: { ok: false; status: number; message: string } | { ok: true }, successBody: unknown): void {
    if (!result.ok) {
        res.status(result.status).json({ code: result.status, success: false, message: result.message });
        return;
    }
    res.json(successBody);
}

export class BlogProfileController {
    constructor(private readonly svc: BlogProfileService) {}

    users = async (req: Request, res: Response): Promise<void> => {
        const { page, pageSize } = req.query;
        try {
            const data = await this.svc.users(page, pageSize);
            res.json({ code: 200, success: true, message: '获取成功', data });
        } catch (error) {
            console.error('获取用户列表错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取用户列表失败' });
        }
    };

    feed = async (req: Request, res: Response): Promise<void> => {
        const { limit } = req.query;
        try {
            const list = await this.svc.latest(limit);
            res.json({ code: 200, success: true, message: '获取成功', data: { list } });
        } catch (error) {
            console.error('获取全站最新文章错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取最新文章失败' });
        }
    };

    hot = async (req: Request, res: Response): Promise<void> => {
        const { limit } = req.query;
        try {
            const list = await this.svc.hot(limit);
            res.json({ code: 200, success: true, message: '获取成功', data: { list } });
        } catch (error) {
            console.error('获取热议文章错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取热门文章失败' });
        }
    };

    profile = async (req: Request, res: Response): Promise<void> => {
        const { username } = req.params;
        const { page, pageSize } = req.query;
        try {
            const out = await this.svc.profilePage(String(username), page, pageSize);
            if (!out.ok) {
                res.status(out.status).json({ code: out.status, success: false, message: out.message });
                return;
            }
            res.json({ code: 200, success: true, message: '获取成功', data: out.value });
        } catch (error) {
            console.error('获取博客主页错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取博客主页失败' });
        }
    };

    articles = async (req: Request, res: Response): Promise<void> => {
        const { username } = req.params;
        const { page, pageSize, keyword, category_id, sort } = req.query;
        try {
            const out = await this.svc.userArticles(String(username), page, pageSize, {
                keyword,
                category_id,
                sort,
            });
            if (!out.ok) {
                res.status(out.status).json({ code: out.status, success: false, message: out.message });
                return;
            }
            res.json({ code: 200, success: true, message: '获取成功', data: out.value });
        } catch (error) {
            console.error('获取用户文章列表错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取用户文章列表失败' });
        }
    };
}
