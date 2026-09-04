/**
 * modules/openapi —— 组装（P3 api_key/openapi 域：/api-keys* + /api/v1/*）。
 * /api/v1 依赖的 article/blog_profile 数据层暂桥接 legacy utils（legacy.ts），域迁移后切换。
 */
import { Router } from 'express';
import { apiKeyDao } from './apiKey.dao.js';
import { articleDao } from '../article/article.dao.js';
import { blogProfileDao } from '../blog/blogProfile.dao.js';
import { userDao } from '../user/user.dao.js';
import { loadAiSummaryUtils } from '../../legacy.js';
import { ApiKeyService, type ApiKeyDeps } from './apiKey.service.js';
import { OpenApiService, type OpenDataDeps } from './openApi.service.js';
import { ApiKeyController, OpenApiController } from './openapi.controller.js';
import { openapiRoutes } from './openapi.routes.js';

export function createOpenapiRouter(): Router {
    const keyDeps: ApiKeyDeps = {
        create: (userId, name, scopes) => apiKeyDao.create(userId, name, scopes),
        listByUser: (userId) => apiKeyDao.listByUser(userId),
        setStatus: (id, userId, status) => apiKeyDao.setStatus(id, userId, status),
        delete: (id, userId) => apiKeyDao.delete(id, userId),
        getRoleId: (userId) => userDao.getRoleId(userId),
    };
    // article/blog_profile 数据层已随各域迁移为 TS DAO；ai_summary 仍为 legacy 桥
    const openDeps: OpenDataDeps = {
        articleList: (filter) => articleDao.list(filter as never),
        articleDetail: (id) => articleDao.detail(id),
        articleAdd: (input) => articleDao.add(input as never),
        getUserPublicByUsername: (username) => blogProfileDao.getUserPublicByUsername(username),
        summarizeAndSave: (articleId, input) => loadAiSummaryUtils().summarizeAndSave(articleId, input),
    };
    return openapiRoutes(
        new ApiKeyController(new ApiKeyService(keyDeps)),
        new OpenApiController(new OpenApiService(openDeps)),
        (plain) => apiKeyDao.verify(plain)
    );
}
