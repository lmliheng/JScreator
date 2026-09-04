/**
 * modules/article/article.controller —— 文章/分类 HTTP 层。
 * 成功/失败响应与 legacy routes/article_request.js 逐字段一致（失败统一 {code,success:false,message}）。
 */
import type { Request, Response } from 'express';
import type { ArticleService } from './article.service.js';
import type { AuthedRequest } from '../../common/middleware/auth.js';

export interface ArticleControllerDeps {
    /** 可选登录解析（detail 可见性用；legacy getLoginUser 语义） */
    resolveToken: (token: string | undefined) => { id: number | string } | null;
}

function actorId(req: Request): number | string | null {
    const user = (req as AuthedRequest).user;
    return user && user.id != null ? user.id : null;
}

function render(res: Response, result: { ok: true; value?: unknown } | { ok: false; status: number; message: string }, successBody: unknown): void {
    if (!result.ok) {
        res.status(result.status).json({ code: result.status, success: false, message: result.message });
        return;
    }
    res.json(successBody);
}

export class ArticleController {
    constructor(
        private readonly svc: ArticleService,
        private readonly deps: ArticleControllerDeps
    ) {}

    list = async (req: Request, res: Response): Promise<void> => {
        const { page, pageSize, category_id, keyword, status, author } = req.query;
        try {
            const data = await this.svc.list({ page, pageSize, category_id, keyword, status, author });
            res.json({ code: 200, success: true, message: '获取成功', data });
        } catch (error) {
            console.error('获取文章列表错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取文章列表失败' });
        }
    };

    archive = async (req: Request, res: Response): Promise<void> => {
        const { username } = req.query;
        try {
            const list = await this.svc.archive(username !== undefined ? String(username) : undefined);
            res.json({ code: 200, success: true, message: '获取成功', data: { list } });
        } catch (error) {
            console.error('获取归档文章错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取归档文章失败' });
        }
    };

    detail = async (req: Request, res: Response): Promise<void> => {
        const article_id = Number(req.params.id);
        if (!article_id) {
            res.status(400).json({ code: 400, success: false, message: '文章id不能为空' });
            return;
        }
        try {
            const viewer = this.deps.resolveToken(req.headers.authorization);
            const out = await this.svc.detailForViewer(article_id, viewer ? viewer.id : null);
            if (!out.ok) {
                res.status(out.status).json({ code: out.status, success: false, message: out.message });
                return;
            }
            res.json({ code: 200, success: true, message: '获取成功', data: out.value });
        } catch (error) {
            console.error('查询文章详情错误:', error);
            res.status(500).json({ code: 500, success: false, message: '查询文章详情失败' });
        }
    };

    add = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const body = (req.body ?? {}) as { title?: unknown; content?: unknown; category_ids?: unknown; status?: unknown };
        const title = body.title ? String(body.title) : '';
        const content = body.content ? String(body.content) : '';
        if (!title || !content) {
            res.status(400).json({ code: 400, success: false, message: '标题和内容不能为空' });
            return;
        }
        try {
            const out = await this.svc.create(id, { title, content, categoryIds: body.category_ids, statusRaw: body.status });
            res.json({ code: 200, success: true, message: '添加成功', data: out });
        } catch (error) {
            console.error('添加文章错误:', error);
            res.status(500).json({ code: 500, success: false, message: '添加文章失败' });
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const article_id = Number(req.params.id);
        if (!article_id) {
            res.status(400).json({ code: 400, success: false, message: '文章id不能为空' });
            return;
        }
        const body = (req.body ?? {}) as { title?: unknown; content?: unknown; category_ids?: unknown; status?: unknown };
        try {
            const out = await this.svc.updateAs(id, article_id, {
                title: body.title !== undefined ? String(body.title) : undefined,
                content: body.content !== undefined ? String(body.content) : undefined,
                statusRaw: body.status,
                categoryIds: body.category_ids,
            });
            render(res, out, { code: 200, success: true, message: '更新成功', data: { article_id } });
        } catch (error) {
            console.error('更新文章错误:', error);
            res.status(500).json({ code: 500, success: false, message: '更新文章失败' });
        }
    };

    remove = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const article_id = Number(req.params.id);
        if (!article_id) {
            res.status(400).json({ code: 400, success: false, message: '文章id不能为空' });
            return;
        }
        try {
            const out = await this.svc.removeAs(id, article_id);
            render(res, out, { code: 200, success: true, message: '删除成功', data: { article_id } });
        } catch (error) {
            console.error('删除文章错误:', error);
            res.status(500).json({ code: 500, success: false, message: '删除文章失败' });
        }
    };

    mine = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const { page, pageSize } = req.query;
        try {
            const data = await this.svc.mine(id, page, pageSize);
            res.json({ code: 200, success: true, message: '获取成功', data });
        } catch (error) {
            console.error('获取本人文章错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取本人文章失败' });
        }
    };

    regenerateSummary = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const article_id = Number(req.params.id);
        if (!article_id) {
            res.status(400).json({ code: 400, success: false, message: '文章id不能为空' });
            return;
        }
        try {
            const out = await this.svc.regenerateAiSummary(id, article_id);
            if (!out.ok) {
                res.status(out.status).json({ code: out.status, success: false, message: out.message });
                return;
            }
            res.json({ code: 200, success: true, message: 'AI 总结已生成', data: { ai_summary: out.value } });
        } catch (error) {
            console.error('重新生成 AI 总结错误:', error);
            res.status(500).json({ code: 500, success: false, message: '操作失败' });
        }
    };

    // ================= 分类 =================

    categoryList = async (_req: Request, res: Response): Promise<void> => {
        try {
            const list = await this.svc.categoryList();
            res.json({ code: 200, success: true, message: '获取成功', data: { list } });
        } catch (error) {
            console.error('获取分类列表错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取分类列表失败' });
        }
    };

    categoryAdd = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const category_name = String((req.body ?? {}).category_name ?? '');
        if (!category_name) {
            res.status(400).json({ code: 400, success: false, message: '分类名称不能为空' });
            return;
        }
        try {
            const out = await this.svc.categoryAdd(id, category_name);
            render(res, out, { code: 200, success: true, message: '添加成功', data: { category_name } });
        } catch (error) {
            console.error('添加分类错误:', error);
            res.status(500).json({ code: 500, success: false, message: '添加分类失败' });
        }
    };

    categoryUpdate = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const body = (req.body ?? {}) as { category_id?: unknown; category_name?: unknown };
        const category_id = body.category_id ? String(body.category_id) : '';
        const category_name = body.category_name ? String(body.category_name) : '';
        if (!category_id || !category_name) {
            res.status(400).json({ code: 400, success: false, message: '分类id和分类名称不能为空' });
            return;
        }
        try {
            const out = await this.svc.categoryUpdate(id, category_id, category_name);
            render(res, out, { code: 200, success: true, message: '更新成功', data: { category_id } });
        } catch (error) {
            console.error('更新分类错误:', error);
            res.status(500).json({ code: 500, success: false, message: '更新分类失败' });
        }
    };

    categoryDelete = async (req: Request, res: Response): Promise<void> => {
        const id = actorId(req);
        if (id === null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const category_id = String((req.body ?? {}).category_id ?? '');
        if (!category_id) {
            res.status(400).json({ code: 400, success: false, message: '分类id不能为空' });
            return;
        }
        try {
            const out = await this.svc.categoryDelete(id, category_id);
            render(res, out, { code: 200, success: true, message: '删除成功', data: { category_id } });
        } catch (error) {
            console.error('删除分类错误:', error);
            res.status(500).json({ code: 500, success: false, message: '删除分类失败' });
        }
    };
}
