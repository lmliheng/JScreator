/**
 * modules/openapi/openapi.routes —— /api-keys*（登录用户）+ /api/v1/*（API Key + scope）。
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors.js';
import { verifyToken } from '../../common/middleware/auth.js';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ApiKeyController, OpenApiController } from './openapi.controller.js';

interface ApiKeyUser {
    user_id: number;
    scopes: string;
}

type ApiKeyVerifiedRequest = Request & { apiKeyUser?: ApiKeyUser; apiKey?: string };

function fail(res: Response, code: number, message: string): void {
    res.status(code).json({ code, success: false, message });
}

/** API Key 鉴权中间件（Bearer sk_...） */
function requireApiKey(verify: (plain: string | undefined) => Promise<{ user_id: number; scopes: string } | null>): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        const auth = req.headers.authorization || '';
        const plain = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
        const verified = await verify(plain);
        if (!verified) {
            return fail(res, 401, '无效的 API Key');
        }
        const r = req as ApiKeyVerifiedRequest;
        r.apiKeyUser = verified;
        r.apiKey = plain;
        next();
    };
}

/** scope 校验（read/write） */
function requireScope(scope: string): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as ApiKeyVerifiedRequest).apiKeyUser;
        const scopes = String((user && user.scopes) || 'read')
            .split(',')
            .map((s) => s.trim());
        if (!scopes.includes(scope)) {
            return fail(res, 403, `该 API Key 无 ${scope} 权限`);
        }
        next();
    };
}

export function openapiRoutes(
    keyCtrl: ApiKeyController,
    apiCtrl: OpenApiController,
    verify: (plain: string | undefined) => Promise<{ user_id: number; scopes: string } | null>
): Router {
    const r = Router();
    // ===== API Key 管理（登录用户） =====
    r.get('/api-keys', verifyToken, asyncHandler(keyCtrl.list.bind(keyCtrl)));
    r.post('/api-keys', verifyToken, asyncHandler(keyCtrl.create.bind(keyCtrl)));
    r.put('/api-keys/:id/status', verifyToken, asyncHandler(keyCtrl.setStatus.bind(keyCtrl)));
    r.delete('/api-keys/:id', verifyToken, asyncHandler(keyCtrl.remove.bind(keyCtrl)));
    // ===== 开放 API v1（API Key） =====
    r.get('/api/v1/articles', requireApiKey(verify), requireScope('read'), asyncHandler(apiCtrl.listArticles.bind(apiCtrl)));
    r.get('/api/v1/articles/:id', requireApiKey(verify), requireScope('read'), asyncHandler(apiCtrl.detailArticle.bind(apiCtrl)));
    r.get('/api/v1/users/:username', requireApiKey(verify), requireScope('read'), asyncHandler(apiCtrl.getUser.bind(apiCtrl)));
    r.post('/api/v1/articles', requireApiKey(verify), requireScope('write'), asyncHandler(apiCtrl.publishArticle.bind(apiCtrl)));
    return r;
}
