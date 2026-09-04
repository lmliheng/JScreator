/**
 * modules/user/user.routes —— 端点守卫对齐 legacy：profile 手动解析 token；
 * 更新本人=verifyToken+服务内权限；user-manage=list/add/update/reset/delete/delete-batch 需 admin；
 * detail 只需登录。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import { adminOnly, verifyToken } from '../../common/middleware/auth.js';
import type { RequestHandler } from 'express';
import type { UserController } from './user.controller.js';

export function userRoutes(
    ctrl: UserController,
    getRoleId: (id: number | string) => Promise<number | null>
): Router {
    const admin = [verifyToken, adminOnly(getRoleId)] as RequestHandler[];
    const r = Router();
    r.get('/sys/profile', asyncHandler(ctrl.profile.bind(ctrl)));
    r.put('/userInfo', verifyToken, asyncHandler(ctrl.updateSelf.bind(ctrl)));
    r.post('/userInfo/unbind-github', verifyToken, asyncHandler(ctrl.unbindGithub.bind(ctrl)));
    r.post('/resetPassword', verifyToken, asyncHandler(ctrl.resetMyPassword.bind(ctrl)));
    r.get('/user-manage/list', ...admin, asyncHandler(ctrl.listUsers.bind(ctrl)));
    r.get('/user-manage/detail/:id', verifyToken, asyncHandler(ctrl.detailUser.bind(ctrl)));
    r.post('/user-manage/add', ...admin, asyncHandler(ctrl.addUser.bind(ctrl)));
    r.put('/user-manage/update', ...admin, asyncHandler(ctrl.updateByAdmin.bind(ctrl)));
    r.put('/user-manage/reset-password', ...admin, asyncHandler(ctrl.resetByAdmin.bind(ctrl)));
    r.delete('/user-manage/delete', ...admin, asyncHandler(ctrl.deleteUser.bind(ctrl)));
    r.post('/user-manage/delete-batch', ...admin, asyncHandler(ctrl.deleteBatch.bind(ctrl)));
    return r;
}
