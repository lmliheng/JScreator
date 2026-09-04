/**
 * modules/auth/auth.routes —— 只声明 method + path，业务全部下沉 controller/service/dao。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import type { AuthController } from './auth.controller.js';

export function authRoutes(ctrl: AuthController): Router {
    const r = Router();
    r.post('/sys/login', asyncHandler(ctrl.login.bind(ctrl)));
    r.post('/sys/register', asyncHandler(ctrl.register.bind(ctrl)));
    return r;
}
