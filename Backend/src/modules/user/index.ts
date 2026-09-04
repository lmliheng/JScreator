/**
 * modules/user —— 组装（P3 user 域：/sys/profile、/userInfo、/resetPassword、/user-manage/*）。
 */
import { Router } from 'express';
import { userDao } from './user.dao.js';
import { loadCryptoPassword, loadTokenValidator } from '../../legacy.js';
import { UserService, type UserDeps } from './user.service.js';
import { UserController, type UserControllerDeps } from './user.controller.js';
import { userRoutes } from './user.routes.js';

export function createUserRouter(): Router {
    const deps: UserDeps = {
        profileRows: (id) => userDao.profileRows(id),
        getUserStats: (id) => userDao.getUserStats(id),
        setPasswordHash: (id, hash) => userDao.setPasswordHash(id, hash),
        updateProfile: (id, fields) => userDao.updateProfile(id, fields),
        clearGithubId: (id) => userDao.clearGithubId(id),
        listPage: (page, pageSize, keyword) => userDao.listPage(page, pageSize, keyword),
        addUser: (username, email, hash, roleId) => userDao.addUser(username, email, hash, roleId),
        deleteById: (id) => userDao.deleteById(id),
        deleteBatchByIds: (ids) => userDao.deleteBatchByIds(ids),
        getDetailById: (id) => userDao.getDetailById(id),
        existsByEmail: (email) => userDao.existsByEmail(email),
        existsByUsername: (username) => userDao.existsByUsername(username),
        getRoleId: (id) => userDao.getRoleId(id),
        ToHash: (password) => loadCryptoPassword().ToHash(password),
    };
    const ctrlDeps: UserControllerDeps = {
        resolveToken: (token) => {
            const decoded = loadTokenValidator()(token);
            if (decoded && typeof decoded === 'object' && (decoded as { id?: unknown }).id !== undefined) {
                return { id: (decoded as { id: number | string }).id };
            }
            return null;
        },
    };
    return userRoutes(new UserController(new UserService(deps), ctrlDeps), (id) => userDao.getRoleId(id));
}
