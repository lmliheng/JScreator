/**
 * modules/oauth/oauth.routes —— 管理端需 admin；authorize/token 公开。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import { adminOnly, verifyToken } from '../../common/middleware/auth.js';
import type { RequestHandler } from 'express';
import type { OauthController } from './oauth.controller.js';

export function oauthRoutes(ctrl: OauthController, getRoleId: (id: number | string) => Promise<number | null>): Router {
    const admin = [verifyToken, adminOnly(getRoleId)] as RequestHandler[];
    const r = Router();
    r.get('/oauth/admin/clients', ...admin, asyncHandler(ctrl.listClients.bind(ctrl)));
    r.post('/oauth/admin/clients', ...admin, asyncHandler(ctrl.createClient.bind(ctrl)));
    r.put('/oauth/admin/clients/:id', ...admin, asyncHandler(ctrl.updateClient.bind(ctrl)));
    r.put('/oauth/admin/clients/:id/status', ...admin, asyncHandler(ctrl.setClientStatus.bind(ctrl)));
    r.delete('/oauth/admin/clients/:id', ...admin, asyncHandler(ctrl.deleteClient.bind(ctrl)));
    r.get('/oauth/authorize', asyncHandler(ctrl.authorize.bind(ctrl)));
    r.post('/oauth/token', asyncHandler(ctrl.token.bind(ctrl)));
    return r;
}
