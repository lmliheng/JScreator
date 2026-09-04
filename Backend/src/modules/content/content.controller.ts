/**
 * modules/content/content.controller —— 广告 / 公告 HTTP 层。
 */
import type { Request, Response } from 'express';
import type { ContentDao } from './content.dao.js';

function fail(res: Response, code: number, message: string): void {
    res.status(code).json({ code, success: false, message });
}

const AD_POSITIONS = ['article_top', 'article_bottom', 'home_mid'];

export class AdController {
    constructor(private readonly dao: ContentDao) {}

    slots = async (req: Request, res: Response): Promise<void> => {
        const position = req.query.position ? String(req.query.position) : '';
        if (!position || !AD_POSITIONS.includes(position)) {
            return fail(res, 400, '无效的广告位');
        }
        try {
            const ad = await this.dao.adGetByPosition(position);
            res.json({ code: 200, success: true, message: '获取成功', data: { ad } });
        } catch (error) {
            console.error('获取广告错误:', error);
            fail(res, 500, '获取广告失败');
        }
    };

    click = async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        if (!id) return fail(res, 400, '无效的广告');
        try {
            await this.dao.adIncrementClick(id);
            res.json({ code: 200, success: true, message: 'ok' });
        } catch (error) {
            console.error('广告点击统计错误:', error);
            fail(res, 500, '统计失败');
        }
    };

    manageList = async (req: Request, res: Response): Promise<void> => {
        const { page, pageSize, keyword, position } = req.query;
        try {
            const data = await this.dao.adManageList(page, pageSize, keyword, position);
            res.json({ code: 200, success: true, message: '获取成功', data });
        } catch (error) {
            console.error('获取广告列表错误:', error);
            fail(res, 500, '获取失败');
        }
    };

    manageDetail = async (req: Request, res: Response): Promise<void> => {
        try {
            const ad = await this.dao.adGetById(req.params.id as string);
            if (!ad) return fail(res, 404, '广告不存在');
            res.json({ code: 200, success: true, message: '获取成功', data: ad });
        } catch (error) {
            console.error('获取广告详情错误:', error);
            fail(res, 500, '获取失败');
        }
    };

    manageAdd = async (req: Request, res: Response): Promise<void> => {
        const title = String((req.body ?? {}).title ?? '');
        if (!title) return fail(res, 400, '广告标题不能为空');
        try {
            const id = await this.dao.adAdd(req.body as Record<string, unknown>);
            res.json({ code: 200, success: true, message: '新增成功', data: { id } });
        } catch (error) {
            console.error('新增广告错误:', error);
            fail(res, 500, '新增失败');
        }
    };

    manageUpdate = async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        if (!id) return fail(res, 400, '无效的广告');
        try {
            await this.dao.adUpdate(id, req.body as Record<string, unknown>);
            res.json({ code: 200, success: true, message: '更新成功' });
        } catch (error) {
            console.error('更新广告错误:', error);
            fail(res, 500, '更新失败');
        }
    };

    manageStatus = async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        const status = (req.body ?? {}).status;
        if (!id || status === undefined) return fail(res, 400, '参数缺失');
        try {
            await this.dao.adSetStatus(id, status);
            res.json({ code: 200, success: true, message: '操作成功' });
        } catch (error) {
            console.error('广告启停错误:', error);
            fail(res, 500, '操作失败');
        }
    };

    manageDelete = async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        if (!id) return fail(res, 400, '无效的广告');
        try {
            await this.dao.adDelete(id);
            res.json({ code: 200, success: true, message: '删除成功' });
        } catch (error) {
            console.error('删除广告错误:', error);
            fail(res, 500, '删除失败');
        }
    };
}

export class AnnouncementController {
    constructor(private readonly dao: ContentDao) {}

    latest = async (_req: Request, res: Response): Promise<void> => {
        try {
            const announcement = await this.dao.announceGetLatest();
            res.json({ code: 200, success: true, message: '获取成功', data: { announcement } });
        } catch (error) {
            console.error('获取公告错误:', error);
            fail(res, 500, '获取公告失败');
        }
    };

    manageList = async (req: Request, res: Response): Promise<void> => {
        const { page, pageSize, keyword, status } = req.query;
        try {
            const data = await this.dao.announceManageList(page, pageSize, keyword, status);
            res.json({ code: 200, success: true, message: '获取成功', data });
        } catch (error) {
            console.error('获取公告列表错误:', error);
            fail(res, 500, '获取失败');
        }
    };

    manageAdd = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as { title?: unknown; content?: unknown };
        const title = body.title ? String(body.title) : '';
        const content = body.content !== undefined && body.content !== null ? String(body.content) : '';
        if (!title || !title.trim()) return fail(res, 400, '公告标题不能为空');
        if (!content || !content.trim()) return fail(res, 400, '公告内容不能为空');
        try {
            const id = await this.dao.announceAdd(title.trim(), content);
            res.json({ code: 200, success: true, message: '发布成功', data: { id } });
        } catch (error) {
            console.error('新增公告错误:', error);
            fail(res, 500, '发布失败');
        }
    };

    manageUpdate = async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        const body = (req.body ?? {}) as { title?: unknown; content?: unknown };
        const title = body.title ? String(body.title) : '';
        const content = body.content !== undefined && body.content !== null ? String(body.content) : '';
        if (!id || !title || !content) return fail(res, 400, '参数缺失');
        try {
            await this.dao.announceUpdate(id, title.trim(), content);
            res.json({ code: 200, success: true, message: '更新成功' });
        } catch (error) {
            console.error('更新公告错误:', error);
            fail(res, 500, '更新失败');
        }
    };

    manageStatus = async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        const status = (req.body ?? {}).status;
        if (!id || status === undefined) return fail(res, 400, '参数缺失');
        try {
            await this.dao.announceSetStatus(id, status);
            res.json({ code: 200, success: true, message: '操作成功' });
        } catch (error) {
            console.error('公告启停错误:', error);
            fail(res, 500, '操作失败');
        }
    };

    manageDelete = async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        if (!id) return fail(res, 400, '无效的公告');
        try {
            await this.dao.announceDelete(id);
            res.json({ code: 200, success: true, message: '删除成功' });
        } catch (error) {
            console.error('删除公告错误:', error);
            fail(res, 500, '删除失败');
        }
    };
}
