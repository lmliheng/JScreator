/**
 * modules/comment/comment.controller —— 评论 HTTP 层。
 */
import type { Request, Response } from 'express';
import type { CommentService } from './comment.service.js';

export interface CommentControllerDeps {
    /** 可选登录解析（发表评论允许匿名，与 legacy getLoginUser 一致） */
    resolveToken: (token: string | undefined) => { id: number | string } | null;
}

function render(res: Response, result: { ok: false; status: number; message: string } | { ok: true; value: unknown }, successBody: unknown): void {
    if (!result.ok) {
        res.status(result.status).json({ code: result.status, success: false, message: result.message });
        return;
    }
    res.json(successBody);
}

export class CommentController {
    constructor(
        private readonly svc: CommentService,
        private readonly deps: CommentControllerDeps
    ) {}

    /** GET /comment/list/:articleId（公开） */
    list = async (req: Request, res: Response): Promise<void> => {
        const article_id = Number(req.params.articleId);
        if (!article_id) {
            res.status(400).json({ code: 400, success: false, message: '文章id不能为空' });
            return;
        }
        const { page, pageSize } = req.query;
        try {
            const data = await this.svc.listByArticle(article_id, page, pageSize);
            res.json({ code: 200, success: true, message: '获取成功', data });
        } catch (error) {
            console.error('获取评论列表错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取评论列表失败' });
        }
    };

    /** POST /comment/add（公开，可匿名） */
    add = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        try {
            const viewer = this.deps.resolveToken(req.headers.authorization);
            const out = await this.svc.create({
                article_id: body.article_id,
                content: body.content,
                parent_id: body.parent_id != null ? body.parent_id : undefined,
                nickname: body.nickname != null ? body.nickname : undefined,
                actorId: viewer ? viewer.id : null,
            });
            if (!out.ok) {
                res.status(out.status).json({ code: out.status, success: false, message: out.message });
                return;
            }
            res.json({ code: 200, success: true, message: '评论成功', data: out.value });
        } catch (error) {
            console.error('发表评论错误:', error);
            res.status(500).json({ code: 500, success: false, message: '发表评论失败' });
        }
    };

    /** GET /comment/manage/list（admin） */
    manageList = async (req: Request, res: Response): Promise<void> => {
        const { page, pageSize, article_id, keyword } = req.query;
        try {
            const data = await this.svc.manageList({ page, pageSize, article_id, keyword });
            res.json({ code: 200, success: true, message: '获取成功', data });
        } catch (error) {
            console.error('评论管理-获取列表错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取评论列表失败' });
        }
    };

    /** PUT /comment/manage/update（admin） */
    manageUpdate = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as { comment_id?: unknown; content?: unknown; nickname?: unknown };
        try {
            const out = await this.svc.manageUpdate(body.comment_id, { content: body.content, nickname: body.nickname });
            render(res, out, { code: 200, success: true, message: '更新成功' });
        } catch (error) {
            console.error('评论管理-更新错误:', error);
            res.status(500).json({ code: 500, success: false, message: '更新失败' });
        }
    };

    /** DELETE /comment/manage/delete（admin，级联） */
    manageDelete = async (req: Request, res: Response): Promise<void> => {
        const comment_ids = (req.body ?? {}).comment_ids;
        try {
            const out = await this.svc.manageDeleteCascade(comment_ids);
            if (!out.ok) {
                res.status(out.status).json({ code: out.status, success: false, message: out.message });
                return;
            }
            res.json({
                code: 200,
                success: true,
                message: `删除成功（${out.value.deleted} 条）`,
                data: { deleted: out.value.deleted },
            });
        } catch (error) {
            console.error('评论管理-删除错误:', error);
            res.status(500).json({ code: 500, success: false, message: '删除失败' });
        }
    };
}
