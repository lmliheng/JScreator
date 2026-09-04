/**
 * modules/social —— 组装（P3 social 域：/social/*）。
 */
import { Router } from 'express';
import { userDao } from '../user/user.dao.js';
import { loadTokenValidator } from '../../legacy.js';
import { SocialService } from './social.service.js';
import { SocialController, type SocialControllerDeps } from './social.controller.js';
import { socialRoutes } from './social.routes.js';

export function createSocialRouter(): Router {
    const deps: SocialControllerDeps = {
        resolveToken: (token) => {
            const decoded = loadTokenValidator()(token);
            if (decoded && typeof decoded === 'object' && (decoded as { id?: unknown }).id !== undefined) {
                return { id: (decoded as { id: number | string }).id };
            }
            return null;
        },
    };
    return socialRoutes(new SocialController(new SocialService(), deps), (id) => userDao.getRoleId(id));
}
