/**
 * modules/article/article.routes —— 公开 + 登录 + 可选登录（detail）混合。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import { verifyToken } from '../../common/middleware/auth.js';
import type { ArticleController } from './article.controller.js';

export function articleRoutes(ctrl: ArticleController): Router {
    const r = Router();
    // 公开
    r.get('/article/list', asyncHandler(ctrl.list.bind(ctrl)));
    r.get('/article/archive', asyncHandler(ctrl.archive.bind(ctrl)));
    r.get('/article/category/list', asyncHandler(ctrl.categoryList.bind(ctrl)));
    // 可选登录（未发布可见性判断）
    r.get('/article/detail/:id', asyncHandler(ctrl.detail.bind(ctrl)));
    // 登录
    r.post('/article/add', verifyToken, asyncHandler(ctrl.add.bind(ctrl)));
    r.put('/article/update/:id', verifyToken, asyncHandler(ctrl.update.bind(ctrl)));
    r.delete('/article/delete/:id', verifyToken, asyncHandler(ctrl.remove.bind(ctrl)));
    r.get('/article/mine', verifyToken, asyncHandler(ctrl.mine.bind(ctrl)));
    r.post('/article/category/add', verifyToken, asyncHandler(ctrl.categoryAdd.bind(ctrl)));
    r.put('/article/category/update', verifyToken, asyncHandler(ctrl.categoryUpdate.bind(ctrl)));
    r.delete('/article/category/delete', verifyToken, asyncHandler(ctrl.categoryDelete.bind(ctrl)));
    r.post('/article/ai-summary/regenerate/:id', verifyToken, asyncHandler(ctrl.regenerateSummary.bind(ctrl)));
    return r;
}
