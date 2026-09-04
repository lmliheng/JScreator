/**
 * modules/content —— 组装（system 收尾：广告 + 公告 + 图片上传）。
 */
import { Router } from 'express';
import { userDao } from '../user/user.dao.js';
import { contentDao } from './content.dao.js';
import { AdController, AnnouncementController } from './content.controller.js';
import { contentRoutes } from './content.routes.js';

export function createContentRouter(): Router {
    return contentRoutes(new AdController(contentDao), new AnnouncementController(contentDao), (id) => userDao.getRoleId(id));
}
