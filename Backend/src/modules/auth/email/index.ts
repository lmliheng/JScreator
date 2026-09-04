/**
 * modules/auth/email —— 组装（P3 auth 子流程 2：/email/*）
 */
import { Router } from 'express';
import { userDao } from '../../user/user.dao.js';
import { loadEmailSender, loadTokenCreator } from '../../../legacy.js';
import { EmailAuthService, type EmailDeps } from './emailAuth.service.js';
import { EmailAuthController } from './emailAuth.controller.js';
import { emailAuthRoutes } from './emailAuth.routes.js';

export function createEmailAuthRouter(): Router {
    const deps: EmailDeps = {
        findByEmail: (email) => userDao.findByEmail(email),
        registerEmailUser: (username, email, password) => userDao.registerEmailUser(username, email, password),
        sendVerificationCode: (to, code) => loadEmailSender().sendVerificationCode(to, code),
        tokenCreator: (user) => loadTokenCreator().tokenCreator(user as { id: number | string }),
    };
    return emailAuthRoutes(new EmailAuthController(new EmailAuthService(deps)));
}
