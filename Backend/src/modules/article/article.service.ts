/**
 * modules/article/article.service —— 文章/分类业务（可见性、归属/权限、AI 总结触发）。
 * 对齐 legacy routes/article_request.js 的分支语义。
 */
import type { ArticleDao } from './article.dao.js';

export type Fail = { ok: false; status: number; message: string };
export type Ok<T> = { ok: true; value: T };
export type Result<T> = Ok<T> | Fail;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const fail = (status: number, message: string): Fail => ({ ok: false, status, message });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRow = any;

export interface ArticleDeps {
    dao: ArticleDao;
    /** 异步 AI 总结（utils/ai_summary 桥）；返回 truthy 表示成功 */
    summarizeAndSave: (articleId: number, input: { title: string; content: string }) => Promise<unknown>;
}

export class ArticleService {
    constructor(private readonly d: ArticleDeps) {}

    isAdminOrEditor(userId: number | string): Promise<boolean> {
        return this.d.dao.isAdminOrEditor(userId);
    }

    list(filter: unknown): Promise<{ list: Array<AnyRow>; total: number; page: number; pageSize: number }> {
        return this.d.dao.list(filter as never);
    }

    archive(username?: string): Promise<Array<AnyRow>> {
        return this.d.dao.archive(username);
    }

    /** 详情 + 可见性：不存在或（未发布且非作者/admin）→ 404 */
    async detailForViewer(articleId: number, viewerId: number | string | null): Promise<Result<AnyRow>> {
        const article = await this.d.dao.detail(articleId);
        if (!article) {
            return fail(404, '文章不存在');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (article.status !== 1) {
            const allowed = viewerId != null && (Number(article.user_id) === Number(viewerId) || (await this.d.dao.isAdminOrEditor(viewerId)));
            if (!allowed) {
                return fail(404, '文章不存在');
            }
        }
        return ok(article);
    }

    /** 新增（发布状态时异步触发 AI 总结，不阻塞响应） */
    async create(
        userId: number | string,
        input: { title: string; content: string; categoryIds?: unknown; statusRaw?: unknown }
    ): Promise<{ article_id: number | string }> {
        const status = input.statusRaw === undefined ? 1 : Number(input.statusRaw);
        const article_id = await this.d.dao.add({
            user_id: userId,
            title: input.title,
            content: input.content,
            status,
            category_ids: input.categoryIds,
        });
        if (Number(status) === 1) {
            this.d
                .summarizeAndSave(Number(article_id), { title: input.title, content: input.content })
                .then(() => {})
                .catch(() => {});
        }
        return { article_id };
    }

    /** 更新（作者本人或 admin/editor）；发布状态刷新 AI 总结 */
    async updateAs(
        actorId: number | string,
        articleId: number,
        fields: { title?: unknown; content?: unknown; statusRaw?: unknown; categoryIds?: unknown }
    ): Promise<Result<{ article_id: number }>> {
        const article = await this.d.dao.articleGetById(articleId);
        if (!article) {
            return fail(404, '文章不存在');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const isOwner = Number(article.user) === Number(actorId);
        if (!isOwner && !(await this.d.dao.isAdminOrEditor(actorId))) {
            return fail(403, '无权限操作该文章');
        }
        const status = fields.statusRaw === undefined ? undefined : Number(fields.statusRaw);
        await this.d.dao.update(articleId, {
            title: fields.title,
            content: fields.content,
            status,
            category_ids: fields.categoryIds,
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const nextStatus = status === undefined ? article.status : status;
        if (Number(nextStatus) === 1) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const title = fields.title !== undefined ? String(fields.title) : String(article.title);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const content = fields.content !== undefined ? String(fields.content) : String(article.content);
            this.d
                .summarizeAndSave(articleId, { title, content })
                .then(() => {})
                .catch(() => {});
        }
        return ok({ article_id: articleId });
    }

    async removeAs(actorId: number | string, articleId: number): Promise<Result<{ article_id: number }>> {
        const article = await this.d.dao.articleGetById(articleId);
        if (!article) {
            return fail(404, '文章不存在');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const isOwner = Number(article.user) === Number(actorId);
        if (!isOwner && !(await this.d.dao.isAdminOrEditor(actorId))) {
            return fail(403, '无权限操作该文章');
        }
        await this.d.dao.remove(articleId);
        return ok({ article_id: articleId });
    }

    mine(userId: number | string, page: unknown, pageSize: unknown) {
        return this.d.dao.mine(userId, page, pageSize);
    }

    /** 手动重新生成 AI 总结（作者本人或 admin/editor）；失败返回 500 结果 */
    async regenerateAiSummary(actorId: number | string, articleId: number): Promise<Result<unknown>> {
        const article = await this.d.dao.detail(articleId);
        if (!article) {
            return fail(404, '文章不存在');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const isOwner = Number(article.user_id) === Number(actorId);
        if (!isOwner && !(await this.d.dao.isAdminOrEditor(actorId))) {
            return fail(403, '无权限操作该文章');
        }
        const result = await this.d.summarizeAndSave(articleId, {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            title: article.title as string,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            content: article.content as string,
        });
        if (!result) {
            return fail(500, 'AI 总结生成失败，请重试或检查 LLM 配置');
        }
        return ok(result);
    }

    // ================= 分类 =================

    categoryList(): Promise<Array<AnyRow>> {
        return this.d.dao.categoryGetAll();
    }

    /** 新增分类：仅 admin/editor */
    async categoryAdd(actorId: number | string, categoryName: string): Promise<Result<{ category_name: string }>> {
        if (!(await this.d.dao.isAdminOrEditor(actorId))) {
            return fail(403, '权限不足，仅管理员或编辑可创建分类');
        }
        await this.d.dao.categoryAdd(categoryName, actorId);
        return ok({ category_name: categoryName });
    }

    /** 更新分类：作者本人或 admin/editor */
    async categoryUpdate(
        actorId: number | string,
        categoryId: number | string,
        categoryName: string
    ): Promise<Result<{ category_id: number | string }>> {
        const category = await this.d.dao.categoryGetById(categoryId);
        if (!category) {
            return fail(404, '分类不存在');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const isOwner = Number(category.user) === Number(actorId);
        if (!isOwner && !(await this.d.dao.isAdminOrEditor(actorId))) {
            return fail(403, '无权限操作该分类');
        }
        if (isOwner) {
            await this.d.dao.categoryUpdateOwn(categoryId, categoryName, actorId);
        } else {
            await this.d.dao.categoryUpdateAny(categoryId, categoryName);
        }
        return ok({ category_id: categoryId });
    }

    /** 删除分类：作者本人或 admin/editor */
    async categoryDelete(
        actorId: number | string,
        categoryId: number | string
    ): Promise<Result<{ category_id: number | string }>> {
        const category = await this.d.dao.categoryGetById(categoryId);
        if (!category) {
            return fail(404, '分类不存在');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const isOwner = Number(category.user) === Number(actorId);
        if (!isOwner && !(await this.d.dao.isAdminOrEditor(actorId))) {
            return fail(403, '无权限操作该分类');
        }
        if (isOwner) {
            await this.d.dao.categoryDeleteOwn(categoryId, actorId);
        } else {
            await this.d.dao.categoryDeleteAny(categoryId);
        }
        return ok({ category_id: categoryId });
    }
}
