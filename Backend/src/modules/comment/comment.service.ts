/**
 * modules/comment/comment.service —— 评论业务（创建校验序列、管理列表/更新/级联删除）。
 * 校验顺序与文案对齐 legacy routes/comment_request.js。
 */
import { commentDao } from './comment.dao.js';
import { articleDao } from '../article/article.dao.js';

export type Fail = { ok: false; status: number; message: string };
export type Ok<T> = { ok: true; value: T };
export type Result<T> = Ok<T> | Fail;

export const fail = (status: number, message: string): Fail => ({ ok: false, status, message });
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export class CommentService {
    constructor(private readonly dao = commentDao, private readonly art = articleDao) {}

    /** 文章评论树（公开） */
    listByArticle(articleId: number, page: unknown, pageSize: unknown) {
        return this.dao.getByArticle(articleId, { page, pageSize });
    }

    /** 发表评论（actorId 可空=匿名）。按 legacy 顺序做全部校验。 */
    async create(input: {
        article_id?: unknown;
        content?: unknown;
        parent_id?: unknown;
        nickname?: unknown;
        actorId: number | string | null;
    }): Promise<Result<{ comment_id: number | string }>> {
        const articleIdRaw = input.article_id;
        const contentRaw = input.content;
        if (!articleIdRaw || !contentRaw) {
            return fail(400, '文章id和评论内容不能为空');
        }
        const article_id = Number(articleIdRaw);
        const article = await this.art.articleGetById(article_id);
        if (!article) {
            return fail(404, '文章不存在');
        }
        // 父评论（若提供）存在且属于同一文章
        if (input.parent_id != null) {
            const parent = await this.dao.commentGetById(Number(input.parent_id));
            if (!parent || Number(parent.article_id) !== article_id) {
                return fail(400, '父评论不存在或不属于该文章');
            }
        }
        // 登录用户：user_id 取 actor，昵称用用户名；匿名：昵称必填
        let user_id: number | string | null = null;
        let final_nickname = input.nickname != null ? String(input.nickname) : null;
        if (input.actorId != null) {
            user_id = input.actorId;
            const username = await this.dao.usernameById(input.actorId);
            if (username) final_nickname = username;
        }
        if (user_id == null && !final_nickname) {
            return fail(400, '匿名评论需要填写昵称');
        }
        // ---- 防垃圾校验 ----
        const text = String(contentRaw || '').trim();
        if (!text) {
            return fail(400, '评论内容不能为空');
        }
        if (text.length > 500) {
            return fail(400, '评论内容最多 500 字');
        }
        const condensed = text.replace(/\s+/g, '');
        if (/^\d+$/.test(condensed) && condensed.length >= 6) {
            return fail(400, '评论内容过于简单，请认真填写');
        }
        // 匿名昵称校验：2-20 字符，不能纯数字
        if (user_id == null) {
            const nick = String(final_nickname || '').trim();
            if (nick.length < 2 || nick.length > 20) {
                return fail(400, '昵称需 2-20 个字符');
            }
            if (/^\d+$/.test(nick)) {
                return fail(400, '昵称不能是纯数字');
            }
        }
        const comment_id = await this.dao.add({
            article_id,
            user_id,
            nickname: final_nickname,
            content: text,
            parent_id: input.parent_id != null ? Number(input.parent_id) : null,
        });
        return ok({ comment_id });
    }

    /** 管理端列表 */
    async manageList(filter: { page?: unknown; pageSize?: unknown; article_id?: unknown; keyword?: unknown }) {
        return this.dao.manageList(filter);
    }

    async manageUpdate(commentId: unknown, body: { content?: unknown; nickname?: unknown }): Promise<Result<{ comment_id: number }>> {
        if (!commentId) {
            return fail(400, 'comment_id 不能为空');
        }
        if (body.content === undefined && body.nickname === undefined) {
            return fail(400, '没有需要更新的字段');
        }
        await this.dao.update(Number(commentId), body);
        return ok({ comment_id: Number(commentId) });
    }

    /** 级联删除多条（与 legacy 一致：逐条统计计数） */
    async manageDeleteCascade(commentIds: unknown): Promise<Result<{ deleted: number }>> {
        if (!Array.isArray(commentIds) || commentIds.length === 0) {
            return fail(400, 'comment_ids 不能为空');
        }
        let deleted = 0;
        for (const id of commentIds as Array<number | string>) {
            deleted += await this.dao.deleteCascade(Number(id));
        }
        return ok({ deleted });
    }
}
