/**
 * modules/systemmon —— 组装（system 收尾：/system-monitor* + GET /）。
 */
import { Router } from 'express';
import { userDao } from '../user/user.dao.js';
import { SystemMonitorController } from './systemmon.controller.js';
import { systemmonRoutes } from './systemmon.routes.js';

export function createSystemmonRouter(): Router {
    return systemmonRoutes(new SystemMonitorController((id) => userDao.getRoleId(id)));
}
