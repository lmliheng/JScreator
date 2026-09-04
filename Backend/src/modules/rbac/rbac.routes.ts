/**
 * modules/rbac/rbac.routes —— /role/*、/permission/* 全部 admin。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import { adminOnly, verifyToken } from '../../common/middleware/auth.js';
import type { RequestHandler } from 'express';
import type { RbacController } from './rbac.controller.js';

export function rbacRoutes(ctrl: RbacController, getRoleId: (id: number | string) => Promise<number | null>): Router {
    const admin = [verifyToken, adminOnly(getRoleId)] as RequestHandler[];
    const r = Router();
    // role：list 在 legacy 中为公开（等价保留）；其余管理操作需 admin
    r.get('/role/list', asyncHandler(ctrl.roleList.bind(ctrl)));
    r.get('/role/permission/:id', ...admin, asyncHandler(ctrl.rolePermission.bind(ctrl)));
    r.post('/role/setPermission', ...admin, asyncHandler(ctrl.roleSetPermission.bind(ctrl)));
    r.post('/role/add', ...admin, asyncHandler(ctrl.roleAdd.bind(ctrl)));
    r.put('/role/update', ...admin, asyncHandler(ctrl.roleUpdate.bind(ctrl)));
    r.delete('/role/delete', ...admin, asyncHandler(ctrl.roleDelete.bind(ctrl)));
    // permission：list 在 legacy 中为公开（等价保留）；更新需 admin
    r.get('/permission/list', asyncHandler(ctrl.permissionList.bind(ctrl)));
    r.put('/permission/update', ...admin, asyncHandler(ctrl.permissionUpdate.bind(ctrl)));
    return r;
}
