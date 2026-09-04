/**
 * modules/notification —— 组装（system 收尾：平台广播通知 /notification/*）。
 */
import { Router } from 'express';
import { userDao } from '../user/user.dao.js';
import { broadcastDao } from './notification.dao.js';
import { BroadcastNotificationController } from './notification.controller.js';
import { notificationRoutes } from './notification.routes.js';

export function createNotificationRouter(): Router {
    return notificationRoutes(new BroadcastNotificationController(broadcastDao), (id) => userDao.getRoleId(id));
}
