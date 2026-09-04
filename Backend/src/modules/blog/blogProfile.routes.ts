/**
 * modules/blog/blogProfile.routes —— /blog/* 全部公开读。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import type { BlogProfileController } from './blogProfile.controller.js';

export function blogProfileRoutes(ctrl: BlogProfileController): Router {
    const r = Router();
    r.get('/blog/users', asyncHandler(ctrl.users.bind(ctrl)));
    r.get('/blog/feed', asyncHandler(ctrl.feed.bind(ctrl)));
    r.get('/blog/hot', asyncHandler(ctrl.hot.bind(ctrl)));
    r.get('/blog/profile/:username', asyncHandler(ctrl.profile.bind(ctrl)));
    r.get('/blog/articles/:username', asyncHandler(ctrl.articles.bind(ctrl)));
    return r;
}
