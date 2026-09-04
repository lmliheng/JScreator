/**
 * modules/blog/blogProfile.service —— 博客主页聚合业务（featured 优先 / 最新兜底 + all_total）。
 * 对齐 legacy routes/blog_profile_request.js。
 */
import type { BlogProfileDao } from './blogProfile.dao.js';

export type Fail = { ok: false; status: number; message: string };
export type Ok<T> = { ok: true; value: T };
export type Result<T> = Ok<T> | Fail;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const fail = (status: number, message: string): Fail => ({ ok: false, status, message });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export class BlogProfileService {
    constructor(private readonly dao: BlogProfileDao) {}

    users(page: unknown, pageSize: unknown) {
        return this.dao.getUserList(page, pageSize);
    }

    latest(limit: unknown): Promise<Array<AnyRow>> {
        return this.dao.getLatestArticles(limit);
    }

    hot(limit: unknown): Promise<Array<AnyRow>> {
        return this.dao.getHotArticles(limit);
    }

    /** 主页：用户公开信息 + 精选文章或最新文章 + all_total（全部已发布数，兜底用 articles.total） */
    async profilePage(
        username: string,
        page: unknown,
        pageSize: unknown
    ): Promise<Result<{ user: AnyRow; articles: AnyRow; all_total: number }>> {
        const user = await this.dao.getUserPublicByUsername(username);
        if (!user) {
            return fail(404, '用户不存在');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const featured = user.featured_articles || [];
        let articles: AnyRow;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (Array.isArray(featured) && featured.length) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const list = await this.dao.getArticlesByIds(featured);
            articles = { list, total: list.length, page: 1, pageSize: list.length };
        } else {
            articles = await this.dao.getArticlesByUsername(username, page, pageSize, {});
        }
        let all_total = 0;
        try {
            const countRes = await this.dao.getArticlesByUsername(username, 1, 1, {});
            all_total = countRes.total || 0;
        } catch {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            all_total = (articles.total as number) || 0;
        }
        return ok({ user, articles, all_total });
    }

    /** 用户文章分页（翻页/加载更多），用户不存在 → notfound */
    async userArticles(
        username: string,
        page: unknown,
        pageSize: unknown,
        opts: { keyword?: unknown; category_id?: unknown; sort?: unknown }
    ): Promise<Result<{ list: Array<AnyRow>; total: number; page: number; pageSize: number }>> {
        const user = await this.dao.getUserPublicByUsername(username);
        if (!user) {
            return fail(404, '用户不存在');
        }
        const data = await this.dao.getArticlesByUsername(username, page, pageSize, opts);
        return ok(data);
    }
}
