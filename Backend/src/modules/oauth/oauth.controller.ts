/**
 * modules/oauth/oauth.controller —— 输出层。每个端点 try/catch 兜底文案对齐 legacy。
 */
import type { Request, Response } from 'express';
import type { OauthService } from './oauth.service.js';

function fail(res: Response, status: number, message: string): void {
    res.status(status).json({ code: status, success: false, message });
}

export interface OauthControllerDeps {
    /** 解析 Authorization 返回用户 id；无效返回 null（tokenValidator 语义） */
    resolveUserIdByToken: (token: string | undefined) => number | string | null;
}

export class OauthController {
    constructor(
        private readonly svc: OauthService,
        private readonly deps: OauthControllerDeps
    ) {}

    // ---------- 管理端 ----------

    listClients = async (_req: Request, res: Response): Promise<void> => {
        try {
            const out = await this.svc.listClients();
            res.status(out.status).json(out.body);
        } catch (e) {
            console.error('OAuth client list 错误:', e);
            fail(res, 500, '获取失败');
        }
    };

    createClient = async (req: Request, res: Response): Promise<void> => {
        try {
            const out = await this.svc.createClient(req.body ?? {});
            res.status(out.status).json(out.body);
        } catch (e) {
            console.error('OAuth client create 错误:', e);
            fail(res, 500, '创建失败');
        }
    };

    updateClient = async (req: Request, res: Response): Promise<void> => {
        try {
            const out = await this.svc.updateClient(req.params.id, req.body ?? {});
            res.status(out.status).json(out.body);
        } catch (e) {
            console.error('OAuth client update 错误:', e);
            fail(res, 500, '更新失败');
        }
    };

    setClientStatus = async (req: Request, res: Response): Promise<void> => {
        try {
            const out = await this.svc.setClientStatus(req.params.id, (req.body ?? {}).status);
            res.status(out.status).json(out.body);
        } catch (e) {
            console.error('OAuth client status 错误:', e);
            fail(res, 500, '操作失败');
        }
    };

    deleteClient = async (req: Request, res: Response): Promise<void> => {
        try {
            const out = await this.svc.deleteClient(req.params.id);
            res.status(out.status).json(out.body);
        } catch (e) {
            console.error('OAuth client delete 错误:', e);
            fail(res, 500, '删除失败');
        }
    };

    // ---------- 授权端点 ----------

    authorize = async (req: Request, res: Response): Promise<void> => {
        try {
            const q = req.query as Record<string, unknown>;
            const userId = this.deps.resolveUserIdByToken(req.headers.authorization);
            const out = await this.svc.authorize({
                client_id: q.client_id,
                redirect_uri: q.redirect_uri,
                response_type: q.response_type,
                code_challenge: q.code_challenge,
                state: q.state,
                scope: q.scope,
                userId,
                queryString: new URLSearchParams(req.query as unknown as Record<string, string>).toString(),
            });
            if ('redirect' in out) {
                res.redirect(out.redirect);
                return;
            }
            if ('text' in out) {
                res.status(out.status).send(out.text);
                return;
            }
            res.status(out.status).json(out.body);
        } catch (e) {
            console.error('OAuth authorize 错误:', e);
            res.status(500).send('服务器内部错误');
        }
    };

    token = async (req: Request, res: Response): Promise<void> => {
        try {
            const out = await this.svc.token(req.body ?? {});
            res.status(out.status).json(out.body);
        } catch (e) {
            console.error('OAuth token 错误:', e);
            fail(res, 500, '服务器内部错误');
        }
    };
}
