/**
 * modules/auth/index —— 组装 auth 域（P3 子流程 1：/sys/login + /sys/register）。
 * 密码哈希/比对、ID 生成、JWT 签发均桥接既有 utils（保证与存量数据兼容），迁移后期再决定是否内化。
 */
import { Router } from 'express';
import { userDao } from '../user/user.dao.js';
import { loadCryptoPassword, loadIdCreator, loadTokenCreator } from '../../legacy.js';
import { AuthService, type AuthDeps } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { authRoutes } from './auth.routes.js';

export function createAuthRouter(): Router {
    const deps: AuthDeps = {
        findByEmail: (email) => userDao.findByEmail(email),
        findByUsername: (username) => userDao.findByUsername(username),
        existsByEmail: (email) => userDao.existsByEmail(email),
        existsByUsername: (username) => userDao.existsByUsername(username),
        insertUser: (id, username, email, passwordHash) => userDao.insertUser(id, username, email, passwordHash),
        ToHash: (password) => loadCryptoPassword().ToHash(password),
        ComparePassword: (plain, hashed) => loadCryptoPassword().ComparePassword(plain, hashed),
        tokenCreator: (user: unknown) => loadTokenCreator().tokenCreator(user as { id: number | string }),
        generateId: () => loadIdCreator().generateId(),
    };
    return authRoutes(new AuthController(new AuthService(deps)));
}
