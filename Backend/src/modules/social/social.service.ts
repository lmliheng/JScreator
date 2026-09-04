/**
 * modules/social/social.service —— 关注/点赞/收藏/互动通知业务编排。
 * 对齐 legacy routes/social_request.js 分支与文案。
 */
import { socialDao } from './social.dao.js';

export type SResult =
    | { ok: true; message: string; data?: unknown; omitMessage?: boolean }
    | { ok: false; status: number; message: string };

export const sFail = (status: number, message: string): SResult => ({ ok: false, status, message });
export const sOk = (message: string, data?: unknown): SResult => (data === undefined ? { ok: true, message } : { ok: true, message, data });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export class SocialService {
    constructor(private readonly dao = socialDao) {}

    /** POST /social/follow/:username（toggle） */
    async toggleFollow(actorId: number | string, username: string): Promise<SResult> {
        const followeeId = await this.dao.userIdByUsername(username);
        if (!followeeId) {
            return sFail(404, '用户不存在');
        }
        if (Number(followeeId) === Number(actorId)) {
            return sFail(400, '不能关注自己');
        }
        const existed = await this.dao.followExists(actorId, followeeId);
        if (existed) {
            await this.dao.followRemove(actorId, followeeId);
            return sOk('已取消关注', { following: false });
        }
        await this.dao.followAdd(actorId, followeeId);
        await this.dao.notificationAdd(followeeId, actorId, 'follow', null, '关注了你');
        return sOk('关注成功', { following: true });
    }

    /** 关注列表（公开） */
    async followingByUsername(username: string): Promise<SResult> {
        const uid = await this.dao.userIdByUsername(username);
        if (!uid) return sFail(404, '用户不存在');
        const list = await this.dao.followListByFollower(uid);
        return sOk('获取成功', { list });
    }

    /** 粉丝列表（公开） */
    async followersByUsername(username: string): Promise<SResult> {
        const uid = await this.dao.userIdByUsername(username);
        if (!uid) return sFail(404, '用户不存在');
        const list = await this.dao.followListByFollowee(uid);
        return sOk('获取成功', { list });
    }

    /** 社交统计（公开；actorId 可空决定 isFollowing） */
    async statsByUsername(username: string, actorId: number | string | null): Promise<SResult> {
        const uid = await this.dao.userIdByUsername(username);
        if (!uid) return sFail(404, '用户不存在');
        const stats = await this.dao.followStats(uid);
        const liked = await this.dao.likeCountReceived(uid);
        let isFollowing = false;
        if (actorId != null) {
            isFollowing = await this.dao.followExists(actorId, uid);
        }
        return sOk('获取成功', { ...stats, liked, isFollowing });
    }

    /** POST /social/like/:articleId（toggle + 通知作者） */
    async toggleLike(actorId: number | string, articleId: number | string): Promise<SResult> {
        const article = await this.dao.articleOwner(articleId);
        if (!article) return sFail(404, '文章不存在');
        const result = await this.dao.likeToggle(articleId, actorId);
        if (result.liked) {
            const actorName = (await this.dao.usernameById(actorId)) || '有人';
            await this.dao.notificationAdd(article.user, actorId, 'like', Number(articleId), `点赞了你的文章 #${articleId}`);
            void actorName;
        }
        const count = await this.dao.likeCountByArticle(articleId);
        return sOk(result.liked ? '点赞成功' : '已取消点赞', { ...result, count });
    }

    /** GET /social/status（ids 批量；legacy 响应无 message 字段） */
    async statusBatch(actorId: number | string, idsRaw: unknown): Promise<SResult> {
        const data = async (): Promise<{ likes: number[]; favorites: number[] }> => {
            if (!idsRaw) return { likes: [], favorites: [] };
            const idArr = String(idsRaw)
                .split(',')
                .map(Number)
                .filter(Boolean);
            if (!idArr.length) return { likes: [], favorites: [] };
            const likes: Array<number> = [];
            const favorites: Array<number> = [];
            for (const id of idArr) {
                if (await this.dao.likeExists(id, actorId)) likes.push(id);
                if (await this.dao.favoriteExists(id, actorId)) favorites.push(id);
            }
            return { likes, favorites };
        };
        return { ok: true, message: '', data: await data(), omitMessage: true };
    }

    /** POST /social/favorite/:articleId（toggle + 通知作者） */
    async toggleFavorite(actorId: number | string, articleId: number | string): Promise<SResult> {
        const article = await this.dao.articleOwner(articleId);
        if (!article) return sFail(404, '文章不存在');
        const result = await this.dao.favoriteToggle(articleId, actorId);
        if (result.favorited) {
            await this.dao.notificationAdd(article.user, actorId, 'favorite', Number(articleId), `收藏了你的文章 #${articleId}`);
        }
        const count = await this.dao.favoriteCountByArticle(articleId);
        return sOk(result.favorited ? '收藏成功' : '已取消收藏', { ...result, count });
    }

    /** GET /social/my-favorites */
    async myFavorites(actorId: number | string): Promise<SResult> {
        const list = await this.dao.favoriteListByUser(actorId);
        return sOk('获取成功', { list });
    }

    /** GET /social/notifications */
    async notificationPage(actorId: number | string, page: unknown, pageSize: unknown): Promise<SResult> {
        const data = await this.dao.notificationList(actorId, page, pageSize);
        return sOk('获取成功', data);
    }

    /** GET /social/notifications/unread-count */
    async notificationUnread(actorId: number | string): Promise<SResult> {
        const count = await this.dao.notificationUnreadCount(actorId);
        return sOk('获取成功', { count });
    }

    /** POST /social/notifications/read */
    async notificationMarkRead(actorId: number | string, body: { id?: unknown; all?: unknown }): Promise<SResult> {
        if (body.all) {
            await this.dao.notificationReadAll(actorId);
        } else if (body.id) {
            await this.dao.notificationRead(Number(body.id), actorId);
        } else {
            return sFail(400, '参数缺失');
        }
        return sOk('已标记已读');
    }

    // ===== 后台管理（admin） =====
    async adminLikes(page: unknown, pageSize: unknown, keyword: unknown): Promise<SResult> {
        const data = await this.dao.likeManageList(page, pageSize, keyword);
        return sOk('获取成功', data);
    }

    async adminLikeDelete(id: number | string): Promise<SResult> {
        await this.dao.likeManageDelete(id);
        return sOk('删除成功');
    }

    async adminFavorites(page: unknown, pageSize: unknown, keyword: unknown): Promise<SResult> {
        const data = await this.dao.favoriteManageList(page, pageSize, keyword);
        return sOk('获取成功', data);
    }

    async adminFavoriteDelete(id: number | string): Promise<SResult> {
        await this.dao.favoriteManageDelete(id);
        return sOk('删除成功');
    }
}
