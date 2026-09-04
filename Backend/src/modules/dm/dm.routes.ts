/**
 * modules/dm/dm.routes —— /dm/* 全部需登录。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import { verifyToken } from '../../common/middleware/auth.js';
import type { DmController } from './dm.controller.js';

export function dmRoutes(ctrl: DmController): Router {
    const r = Router();
    r.get('/dm/conversations', verifyToken, asyncHandler(ctrl.conversations.bind(ctrl)));
    r.get('/dm/messages/:otherId', verifyToken, asyncHandler(ctrl.messages.bind(ctrl)));
    r.get('/dm/unread-count', verifyToken, asyncHandler(ctrl.unreadCount.bind(ctrl)));
    r.post('/dm/read', verifyToken, asyncHandler(ctrl.read.bind(ctrl)));
    return r;
}
