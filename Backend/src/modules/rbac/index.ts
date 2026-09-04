/**
 * modules/rbac —— 组装（system 收尾：role + permission）。
 */
import { Router } from 'express';
import { userDao } from '../user/user.dao.js';
import { rbacDao } from './rbac.dao.js';
import { RbacController } from './rbac.controller.js';
import { rbacRoutes } from './rbac.routes.js';

export function createRbacRouter(): Router {
    return rbacRoutes(new RbacController(rbacDao), (id) => userDao.getRoleId(id));
}
