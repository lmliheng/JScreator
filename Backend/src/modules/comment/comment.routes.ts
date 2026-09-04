/**
 * modules/comment/comment.routes —— 公开（列表/发表，可匿名）+ 管理端 admin。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import { adminOnly, verifyToken } from '../../common/middleware/auth.js';
import type { RequestHandler } from 'express';
import type { CommentController } from './comment.controller.js';

export function commentRoutes(
    ctrl: CommentController,
    getRoleId: (id: number | string) => Promise<number | null>
): Router {
    const admin = [verifyToken, adminOnly(getRoleId)] as RequestHandler[];
    const r = Router();
    r.get('/comment/list/:articleId', asyncHandler(ctrl.list.bind(ctrl)));
    r.post('/comment/add', asyncHandler(ctrl.add.bind(ctrl)));
    r.get('/comment/manage/list', ...admin, asyncHandler(ctrl.manageList.bind(ctrl)));
    r.put('/comment/manage/update', ...admin, asyncHandler(ctrl.manageUpdate.bind(ctrl)));
    r.delete('/comment/manage/delete', ...admin, asyncHandler(ctrl.manageDelete.bind(ctrl)));
    return r;
}
