/**
 * modules/auth/totp/totp.routes —— 绑定/解绑/状态需登录；/totp/login 公开。
 */
import { Router } from 'express';
import { asyncHandler } from '../../../common/errors.js';
import { verifyToken } from '../../../common/middleware/auth.js';
import type { TotpController } from './totp.controller.js';

export function totpRoutes(ctrl: TotpController): Router {
    const r = Router();
    r.post('/totp/setup', verifyToken, asyncHandler(ctrl.setup.bind(ctrl)));
    r.post('/totp/confirm', verifyToken, asyncHandler(ctrl.confirm.bind(ctrl)));
    r.post('/totp/disable', verifyToken, asyncHandler(ctrl.disable.bind(ctrl)));
    r.get('/totp/status', verifyToken, asyncHandler(ctrl.status.bind(ctrl)));
    r.post('/totp/login', asyncHandler(ctrl.login.bind(ctrl)));
    return r;
}
