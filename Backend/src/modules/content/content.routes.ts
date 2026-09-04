/**
 * modules/content/content.routes —— /ad/*、/announcement/*、/upload/image。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import { adminOnly, verifyToken } from '../../common/middleware/auth.js';
import type { RequestHandler } from 'express';
import type { AdController, AnnouncementController } from './content.controller.js';
import { uploadErrorHandler, uploadImageHandler, uploadSingle } from './upload.controller.js';

export function contentRoutes(
    adCtrl: AdController,
    announceCtrl: AnnouncementController,
    getRoleId: (id: number | string) => Promise<number | null>
): Router {
    const admin = [verifyToken, adminOnly(getRoleId)] as RequestHandler[];
    const r = Router();
    // 广告：公开 + 管理
    r.get('/ad/slots', asyncHandler(adCtrl.slots.bind(adCtrl)));
    r.post('/ad/click/:id', asyncHandler(adCtrl.click.bind(adCtrl)));
    r.get('/ad/admin/list', ...admin, asyncHandler(adCtrl.manageList.bind(adCtrl)));
    r.get('/ad/admin/detail/:id', ...admin, asyncHandler(adCtrl.manageDetail.bind(adCtrl)));
    r.post('/ad/admin/add', ...admin, asyncHandler(adCtrl.manageAdd.bind(adCtrl)));
    r.put('/ad/admin/update/:id', ...admin, asyncHandler(adCtrl.manageUpdate.bind(adCtrl)));
    r.put('/ad/admin/status/:id', ...admin, asyncHandler(adCtrl.manageStatus.bind(adCtrl)));
    r.delete('/ad/admin/delete/:id', ...admin, asyncHandler(adCtrl.manageDelete.bind(adCtrl)));
    // 公告：公开 + 管理
    r.get('/announcement/latest', asyncHandler(announceCtrl.latest.bind(announceCtrl)));
    r.get('/announcement/admin/list', ...admin, asyncHandler(announceCtrl.manageList.bind(announceCtrl)));
    r.post('/announcement/admin/add', ...admin, asyncHandler(announceCtrl.manageAdd.bind(announceCtrl)));
    r.put('/announcement/admin/update/:id', ...admin, asyncHandler(announceCtrl.manageUpdate.bind(announceCtrl)));
    r.put('/announcement/admin/status/:id', ...admin, asyncHandler(announceCtrl.manageStatus.bind(announceCtrl)));
    r.delete('/announcement/admin/delete/:id', ...admin, asyncHandler(announceCtrl.manageDelete.bind(announceCtrl)));
    // 上传（登录用户）
    r.post('/upload/image', verifyToken, uploadSingle, asyncHandler(uploadImageHandler));
    r.use(uploadErrorHandler);
    return r;
}
