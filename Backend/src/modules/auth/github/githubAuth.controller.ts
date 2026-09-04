/**
 * modules/auth/github/githubAuth.controller —— /auth/github*（302 重定向流，非 JSON 响应）。
 */
import type { Request, Response } from 'express';
import type { GithubAuthService } from './githubAuth.service.js';

export class GithubAuthController {
    constructor(private readonly svc: GithubAuthService) {}

    /** GET /auth/github */
    login = (req: Request, res: Response): void => {
        res.redirect(this.svc.loginAuthorizeUrl(req.query.redirect));
    };

    /** GET /auth/github/bind */
    bind = (req: Request, res: Response): void => {
        res.redirect(this.svc.bindAuthorizeUrl(req.query.redirect, req.query.token));
    };

    /** GET /auth/github/callback */
    callback = async (req: Request, res: Response): Promise<void> => {
        const url = await this.svc.handleCallback(req.query.code, req.query.state);
        res.redirect(url);
    };
}
