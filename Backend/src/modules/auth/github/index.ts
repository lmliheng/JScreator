/**
 * modules/auth/github —— 组装（P3 auth 子流程 4：/auth/github*）
 */
import { Router } from 'express';
import { userDao } from '../../user/user.dao.js';
import { loadTokenCreator, loadTokenValidator } from '../../../legacy.js';
import { GithubAuthService, type GithubDeps } from './githubAuth.service.js';
import { GithubAuthController } from './githubAuth.controller.js';
import { githubAuthRoutes } from './githubAuth.routes.js';

export function createGithubAuthRouter(): Router {
    const deps: GithubDeps = {
        getByGithubId: (id) => userDao.getByGithubId(id),
        registerGithubUser: (input) => userDao.registerGithubUser(input),
        setGithubId: (userId, githubId) => userDao.setGithubId(userId, githubId),
        tokenValidator: (token) => loadTokenValidator()(token),
        tokenCreator: (user) => loadTokenCreator().tokenCreator(user as { id: number | string }),
    };
    return githubAuthRoutes(new GithubAuthController(new GithubAuthService(deps)));
}
