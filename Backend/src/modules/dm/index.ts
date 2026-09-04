/**
 * modules/dm —— 组装（P3 dm 域：/dm/* REST；WS 实时收编见 P5）。
 */
import { Router } from 'express';
import { DmService } from './dm.service.js';
import { DmController } from './dm.controller.js';
import { dmRoutes } from './dm.routes.js';

export function createDmRouter(): Router {
    return dmRoutes(new DmController(new DmService()));
}
