/**
 * modules/oauth —— 组装（P3 auth 子流程 5：/oauth/*）。
 */
import { Router } from 'express';
import { oauthDao } from './oauth.dao.js';
import { userDao } from '../user/user.dao.js';
import { loadTokenValidator } from '../../legacy.js';
import { OauthService, type OauthDeps } from './oauth.service.js';
import { OauthController, type OauthControllerDeps } from './oauth.controller.js';
import { oauthRoutes } from './oauth.routes.js';

export function createOauthRouter(): Router {
    const deps: OauthDeps = {
        listClients: () => oauthDao.listClients(),
        createClient: (data) => oauthDao.createClient(data),
        updateClient: (id, data) => oauthDao.updateClient(id, data),
        getClientByClientId: (clientId) => oauthDao.getClientByClientId(clientId),
        setClientStatus: (id, status) => oauthDao.setClientStatus(id, status),
        deleteClient: (id) => oauthDao.deleteClient(id),
        createCode: (clientId, userId, scope, challenge, redirectUri) =>
            oauthDao.createCode(clientId, userId, scope, challenge, redirectUri),
        consumeCode: (code) => oauthDao.consumeCode(code),
    };
    const ctrlDeps: OauthControllerDeps = {
        resolveUserIdByToken: (token) => {
            const decoded = loadTokenValidator()(token);
            if (decoded && typeof decoded === 'object' && (decoded as { id?: unknown }).id !== undefined) {
                return (decoded as { id: number | string }).id;
            }
            return null;
        },
    };
    return oauthRoutes(new OauthController(new OauthService(deps), ctrlDeps), (id) => userDao.getRoleId(id));
}
