/**
 * modules/comment —— 组装（P3 comment 域：/comment/*）。
 */
import { Router } from 'express';
import { userDao } from '../user/user.dao.js';
import { loadTokenValidator } from '../../legacy.js';
import { CommentService } from './comment.service.js';
import { CommentController, type CommentControllerDeps } from './comment.controller.js';
import { commentRoutes } from './comment.routes.js';

export function createCommentRouter(): Router {
    const ctrlDeps: CommentControllerDeps = {
        resolveToken: (token) => {
            const decoded = loadTokenValidator()(token);
            if (decoded && typeof decoded === 'object' && (decoded as { id?: unknown }).id !== undefined) {
                return { id: (decoded as { id: number | string }).id };
            }
            return null;
        },
    };
    return commentRoutes(new CommentController(new CommentService(), ctrlDeps), (id) => userDao.getRoleId(id));
}
