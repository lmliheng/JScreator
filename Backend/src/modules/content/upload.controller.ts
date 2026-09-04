/**
 * modules/content/upload.controller —— /upload/image（multer 内存存储 → OSS）。
 * 行为对齐 legacy routes/upload_request.js（类型白名单、5MB 限制、错误中间件）。
 */
import { createRequire } from 'node:module';
import type { Request, RequestHandler, Response } from 'express';
import type { NextFunction } from 'express';
import { loadOssUpload } from '../../legacy.js';
import type { AuthedRequest } from '../../common/middleware/auth.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const multer = require('multer') as {
    memoryStorage: () => unknown;
    MulterError: new (code: string, field?: string) => Error & { code: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (opts: unknown): { single: (field: string) => RequestHandler };
};

const ALLOWED: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }) as any;

export const uploadSingle: RequestHandler = upload.single('image');

/** POST /upload/image */
export async function uploadImageHandler(req: Request, res: Response): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = (req as AuthedRequest).user;
    if (!decoded || decoded.id === undefined) {
        res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
        return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file = (req as any).file as { mimetype?: string; buffer: Buffer } | undefined;
    if (!file) {
        res.status(400).json({ code: 400, success: false, message: '请选择图片文件' });
        return;
    }
    const ext = file.mimetype ? ALLOWED[file.mimetype] : undefined;
    if (!ext) {
        res.status(400).json({ code: 400, success: false, message: '仅支持 jpg/png/webp/gif 图片' });
        return;
    }
    try {
        const now = new Date();
        const p = (n: number): string => String(n).padStart(2, '0');
        const ymd = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
        const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const url = await loadOssUpload().uploadBuffer(file.buffer, `uploads/${ymd}/${name}`, file.mimetype as string);
        res.json({ code: 200, success: true, message: '上传成功', data: { url } });
    } catch (error) {
        console.error('上传图片错误:', error);
        res.status(500).json({ code: 500, success: false, message: '上传失败，请检查 OSS 配置' });
    }
}

/** multer 错误（文件过大等）统一处理 */
export function uploadErrorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({ code: 400, success: false, message: '图片不能超过 5MB' });
            return;
        }
        res.status(400).json({ code: 400, success: false, message: '上传出错：' + err.message });
        return;
    }
    next(err);
}
