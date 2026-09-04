/**
 * common/response：统一响应信封 { code, success, message, data }（与 legacy 契约一致）。
 */
import type { Response } from 'express';

export function ok<T>(res: Response, data?: T, message = 'success'): Response {
    return res.json(data === undefined ? { code: 200, success: true, message } : { code: 200, success: true, message, data });
}

export function fail(res: Response, code: number, message: string): Response {
    return res.status(code).json({ code, success: false, message });
}
