/**
 * modules/auth/email/emailAuth.routes
 */
import { Router } from 'express';
import { asyncHandler } from '../../../common/errors.js';
import type { EmailAuthController } from './emailAuth.controller.js';

export function emailAuthRoutes(ctrl: EmailAuthController): Router {
    const r = Router();
    r.post('/email/send-code', asyncHandler(ctrl.sendCode.bind(ctrl)));
    r.post('/email/login', asyncHandler(ctrl.login.bind(ctrl)));
    return r;
}
