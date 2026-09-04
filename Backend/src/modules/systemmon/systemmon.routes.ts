/**
 * modules/systemmon/systemmon.routes —— /system-monitor*（admin）+ /（公开健康检查）。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import type { SystemMonitorController } from './systemmon.controller.js';

export function systemmonRoutes(ctrl: SystemMonitorController): Router {
    const r = Router();
    r.get('/system-monitor', ...ctrl.admin, asyncHandler(ctrl.monitor.bind(ctrl)));
    r.get('/system-monitor/api-stats', ...ctrl.admin, asyncHandler(ctrl.apiStats.bind(ctrl)));
    r.get('/', asyncHandler(ctrl.root.bind(ctrl)));
    return r;
}
