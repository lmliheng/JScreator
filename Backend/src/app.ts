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

    // 统一错误中间件
    app.use(errorHandler);

    return app;
}
