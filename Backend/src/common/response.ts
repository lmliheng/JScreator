/**
 * common/response：统一响应信封 { code, success, message, data }。
 */
import type { Response } from 'express';

/**
 * 
 * @ok函数
 * 返回json格式的success response
 */
export function ok<T>(res: Response, data?: T, message = 'success'): Response {
    return res.json(data === undefined ? { code: 200, success: true, message } : { code: 200, success: true, message, data });
}

/**
 * 
 * @fail
 * 返回json格式的失败响应
 */
export function fail(res: Response, code: number, message: string): Response {
    return res.status(code).json({ code, success: false, message });
}
