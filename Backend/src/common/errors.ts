/**
 * common/errors：业务错误与异步控制器包装。
 * Express4 不会自动捕获 async handler 抛出的异常，必须经 asyncHandler 包一层。
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** 业务错误：携带 HTTP code，由统一错误中间件渲染 { code, success, message } */
export class AppError extends Error {
    constructor(
        readonly code: number,
        message: string
    ) {
        super(message);
        this.name = 'AppError';
    }
}

/** 包装 async/同步 控制器：异常统一交给 next（P3 起所有 TS controller 使用；同步 handler 也可传入） */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/** 统一错误中间件（P3 起挂载到 app）：AppError → code/message；带 status 的框架错误（如 body-parser 400）沿用其状态码；其余 → 500 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
    if (res.headersSent) {
        next(err);
        return;
    }
    if (err instanceof AppError) {
        res.status(err.code).json({ code: err.code, success: false, message: err.message });
        return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const frameworkStatus = (err as any)?.status ?? (err as any)?.statusCode;
    const status = typeof frameworkStatus === 'number' && frameworkStatus >= 400 && frameworkStatus < 600 ? frameworkStatus : 500;
    console.error('未捕获错误:', err);
    res.status(status).json({
        code: status,
        success: false,
        message: status === 500 ? '服务器内部错误' : (err instanceof Error ? err.message : '请求解析失败'),
    });
}
