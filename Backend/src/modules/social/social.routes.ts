/**
 * modules/social/social.routes —— 关注/点赞/收藏等需登录；following/followers/stats 公开；后台 admin。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import { adminOnly, verifyToken } from '../../common/middleware/auth.js';
import type { RequestHandler } from 'express';
import type { SocialController } from './social.controller.js';

export function socialRoutes(
    ctrl: SocialController,
    getRoleId: (id: number | string) => Promise<number | null>
): Router {
    const admin = [verifyToken, adminOnly(getRoleId)] as RequestHandler[];
    const r = Router();
    // 公开（stats 可选登录，controller 内解析）
    r.get('/social/following/:username', asyncHandler(ctrl.following.bind(ctrl)));
    r.get('/social/followers/:username', asyncHandler(ctrl.followers.bind(ctrl)));
    r.get('/social/stats/:username', asyncHandler(ctrl.stats.bind(ctrl)));
    // 登录
    r.post('/social/follow/:username', verifyToken, asyncHandler(ctrl.follow.bind(ctrl)));
    r.post('/social/like/:articleId', verifyToken, asyncHandler(ctrl.like.bind(ctrl)));
    r.get('/social/status', verifyToken, asyncHandler(ctrl.status.bind(ctrl)));
    r.post('/social/favorite/:articleId', verifyToken, asyncHandler(ctrl.favorite.bind(ctrl)));
    r.get('/social/my-favorites', verifyToken, asyncHandler(ctrl.myFavorites.bind(ctrl)));
    r.get('/social/notifications', verifyToken, asyncHandler(ctrl.notifications.bind(ctrl)));
    r.get('/social/notifications/unread-count', verifyToken, asyncHandler(ctrl.notificationsUnread.bind(ctrl)));
    r.post('/social/notifications/read', verifyToken, asyncHandler(ctrl.notificationsRead.bind(ctrl)));
    // 管理端
    r.get('/social/admin/likes', ...admin, asyncHandler(ctrl.adminLikes.bind(ctrl)));
    r.delete('/social/admin/likes/:id', ...admin, asyncHandler(ctrl.adminLikeDelete.bind(ctrl)));
    r.get('/social/admin/favorites', ...admin, asyncHandler(ctrl.adminFavorites.bind(ctrl)));
    r.delete('/social/admin/favorites/:id', ...admin, asyncHandler(ctrl.adminFavoriteDelete.bind(ctrl)));
    return r;
}
