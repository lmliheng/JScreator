/**
 * modules/auth/github/githubAuth.routes —— 302 流（controller 直接处理，无需 asyncHandler 兜底之外的包装）。
 */
import { Router } from 'express';
import { asyncHandler } from '../../../common/errors.js';
import type { GithubAuthController } from './githubAuth.controller.js';

export function githubAuthRoutes(ctrl: GithubAuthController): Router {
    const r = Router();
    r.get('/auth/github', asyncHandler(ctrl.login.bind(ctrl)));
    r.get('/auth/github/bind', asyncHandler(ctrl.bind.bind(ctrl)));
    r.get('/auth/github/callback', asyncHandler(ctrl.callback.bind(ctrl)));
    return r;
}
