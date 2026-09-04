/**
 * modules/openapi/openapi.controller —— /api-keys*（登录用户管理自己的 key）+ /api/v1/*（外部开放接口）。
 */
import type { Request, Response } from 'express';
import type { ApiKeyService } from './apiKey.service.js';
import type { OpenApiService } from './openApi.service.js';
import type { AuthedRequest } from '../../common/middleware/auth.js';

function fail(res: Response, code: number, message: string): void {
    res.status(code).json({ code, success: false, message });
}

function userId(req: Request): number | string | null {
    const user = (req as AuthedRequest).user;
    return user && user.id != null ? user.id : null;
}

export class ApiKeyController {
    constructor(private readonly svc: ApiKeyService) {}

    list = async (req: Request, res: Response): Promise<void> => {
        const id = userId(req);
        if (id === null) return fail(res, 401, '未登录或登录过期');
        try {
            const list = await this.svc.list(id);
            res.json({ code: 200, success: true, message: '获取成功', data: { list } });
        } catch (e) {
            console.error('获取 API key 列表错误:', e);
            fail(res, 500, '获取失败');
        }
    };

    create = async (req: Request, res: Response): Promise<void> => {
        const id = userId(req);
        if (id === null) return fail(res, 401, '未登录或登录过期');
        const body = (req.body ?? {}) as { name?: unknown; scopes?: unknown };
        try {
            const out = await this.svc.create(id, body.name ? String(body.name) : undefined, body.scopes);
            if (!out.ok) {
                return fail(res, out.status, out.message);
            }
            res.json({
                code: 200,
                success: true,
                message: '创建成功（明文只显示这一次，请妥善保存）',
                data: { plain: out.plain, prefix: out.keyPrefix, scopes: out.scopes },
            });
        } catch (e) {
            console.error('创建 API key 错误:', e);
            fail(res, 500, '创建失败');
        }
    };

    setStatus = async (req: Request, res: Response): Promise<void> => {
        const id = userId(req);
        if (id === null) return fail(res, 401, '未登录或登录过期');
        const status = (req.body ?? {}).status;
        try {
            await this.svc.setStatus(req.params.id as number | string, id, status);
            res.json({ code: 200, success: true, message: '操作成功' });
        } catch (e) {
            console.error('更新 API key 状态错误:', e);
            fail(res, 500, '操作失败');
        }
    };

    remove = async (req: Request, res: Response): Promise<void> => {
        const id = userId(req);
        if (id === null) return fail(res, 401, '未登录或登录过期');
        try {
            await this.svc.remove(req.params.id as number | string, id);
            res.json({ code: 200, success: true, message: '删除成功' });
        } catch (e) {
            console.error('删除 API key 错误:', e);
            fail(res, 500, '删除失败');
        }
    };
}

interface ApiKeyUser {
    user_id: number;
    scopes: string;
}

export class OpenApiController {
    constructor(private readonly svc: OpenApiService) {}

    listArticles = async (req: Request, res: Response): Promise<void> => {
        const { page, pageSize, keyword, category_id } = req.query;
        try {
            const data = await this.svc.list({ page, pageSize, keyword, category_id });
            res.json({ code: 200, success: true, message: '获取成功', data });
        } catch (e) {
            console.error('API 文章列表错误:', e);
            fail(res, 500, '获取失败');
        }
    };

    detailArticle = async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        if (!id) return fail(res, 400, '文章 id 不能为空');
        try {
            const out = await this.svc.detail(id);
            if (out === 'notfound') return fail(res, 404, '文章不存在或未发布');
            res.json({ code: 200, success: true, message: '获取成功', data: out.data });
        } catch (e) {
            console.error('API 文章详情错误:', e);
            fail(res, 500, '获取失败');
        }
    };

    getUser = async (req: Request, res: Response): Promise<void> => {
        try {
            const out = await this.svc.user(String(req.params.username));
            if (out === 'notfound') return fail(res, 404, '用户不存在');
            res.json({ code: 200, success: true, message: '获取成功', data: out.data });
        } catch (e) {
            console.error('API 用户查询错误:', e);
            fail(res, 500, '获取失败');
        }
    };

    publishArticle = async (req: Request, res: Response): Promise<void> => {
        const apiUser = (req as Request & { apiKeyUser?: ApiKeyUser }).apiKeyUser;
        const body = (req.body ?? {}) as { title?: unknown; content?: unknown; category_ids?: unknown; status?: unknown };
        const title = body.title ? String(body.title) : '';
        const content = body.content ? String(body.content) : '';
        if (!title || !content) return fail(res, 400, '标题和内容不能为空');
        try {
            const out = await this.svc.publish({
                userId: apiUser ? apiUser.user_id : 0,
                title,
                content,
                categoryIds: body.category_ids,
                statusRaw: body.status,
            });
            res.json({ code: 200, success: true, message: '发布成功', data: out });
        } catch (e) {
            console.error('API 发布文章错误:', e);
            fail(res, 500, '发布失败');
        }
    };
}
