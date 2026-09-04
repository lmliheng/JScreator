/**
 * modules/auth/totp —— 组装（P3 auth 子流程 3：/totp/*）
 */
import { Router } from 'express';
import { userDao } from '../../user/user.dao.js';
import { loadTokenCreator } from '../../../legacy.js';
import { TotpService, type TotpDeps } from './totp.service.js';
import { TotpController } from './totp.controller.js';
import { totpRoutes } from './totp.routes.js';

export function createTotpRouter(): Router {
    const deps: TotpDeps = {
        getBasicById: (id) => userDao.getBasicById(id),
        getTotpSecret: (id) => userDao.getTotpSecret(id),
        setTotpSecret: (id, secret) => userDao.setTotpSecret(id, secret),
        findByAccountForTotp: (account) => userDao.findByAccountForTotp(account),
        tokenCreator: (user) => loadTokenCreator().tokenCreator(user as { id: number | string }),
    };
    return totpRoutes(new TotpController(new TotpService(deps)));
}
