/**
 * P1 app 装配：与根 server.js 的装配顺序完全一致（CORS → json → urlencoded → 统计中间件 →
 * legacy 路由 → registerRoutes）。后续 P3 每迁移一个域，就在此处把对应 legacy 挂载替换为
 * modules 下该域的 TS 路由挂载（routes → controller → service → dao）。
 */
import express from 'express';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { ALLOWED_ORIGINS } from './config/env.js';
import { loadApiMonitor, registerLegacyRoutes } from './legacy.js';
import { errorHandler } from './common/errors.js';
import { createAuthRouter } from './modules/auth/index.js';
import { createEmailAuthRouter } from './modules/auth/email/index.js';
import { createTotpRouter } from './modules/auth/totp/index.js';
import { createGithubAuthRouter } from './modules/auth/github/index.js';
import { createOauthRouter } from './modules/oauth/index.js';
import { createUserRouter } from './modules/user/index.js';
import { createOpenapiRouter } from './modules/openapi/index.js';
import { createArticleRouter } from './modules/article/index.js';
import { createBlogRouter } from './modules/blog/index.js';
import { createCommentRouter } from './modules/comment/index.js';
import { createSocialRouter } from './modules/social/index.js';
import { createDmRouter } from './modules/dm/index.js';
import { createRbacRouter } from './modules/rbac/index.js';
import { createNotificationRouter } from './modules/notification/index.js';
import { createContentRouter } from './modules/content/index.js';
import { createSystemmonRouter } from './modules/systemmon/index.js';
import { createBackupRouter } from './modules/backup/index.js';
import { userDao } from './modules/user/user.dao.js';

export function buildApp(): express.Express {
    const app = express();

    // CORS 白名单：只允许自己的前端域名（本地 dev + 云托管前端）——与根 server.js 一致
    app.use(
        cors({
            origin(origin, callback) {
                // 无 origin（同源/非浏览器/curl 等）直接放行；不允许的来源不返回 CORS 头
                if (!origin || ALLOWED_ORIGINS.includes(origin)) {
                    return callback(null, true);
                }
                return callback(null, false);
            },
            credentials: true,
        })
    );
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // 接口调用统计中间件（挂在所有路由之前）
    const { recordApi } = loadApiMonitor();
    app.use((req: Request, res: Response, next: NextFunction) => {
        const start = Date.now();
        res.on('finish', () => {
            recordApi(req, res, Date.now() - start);
        });
        next();
    });

    // P3：全部域已迁移为 TS 三层（legacy 挂载清单已清空）；registerLegacyRoutes 为空操作，保留兜底
    app.use(createAuthRouter());
    app.use(createEmailAuthRouter());
    app.use(createTotpRouter());
    app.use(createGithubAuthRouter());
    app.use(createOauthRouter());
    app.use(createUserRouter());
    app.use(createOpenapiRouter());
    app.use(createArticleRouter());
    app.use(createBlogRouter());
    app.use(createCommentRouter());
    app.use(createSocialRouter());
    app.use(createDmRouter());
    app.use(createRbacRouter());
    app.use(createNotificationRouter());
    app.use(createContentRouter());
    app.use(createSystemmonRouter());
    app.use(createBackupRouter((id) => userDao.getRoleId(id)));

    registerLegacyRoutes(app);

    // 路由全部挂载后，登记全部接口清单（系统监控的接口统计显示所有接口，未调用的为 0 次）
    const { registerRoutes } = loadApiMonitor();
    registerRoutes(app);

    // P2 收编：统一错误中间件（TS 路由经 asyncHandler 抛错后在此渲染；legacy 路由自带 try/catch 不受影响）
    app.use(errorHandler);

    return app;
}
