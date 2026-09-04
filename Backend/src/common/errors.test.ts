/**
 * P2 单测：errors（AppError / asyncHandler / errorHandler）
 * 运行：npm run test:ts（先 tsc 编译到 Backend/dist 再用 node --test 执行）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NextFunction, Request, Response } from 'express';
import { AppError, asyncHandler, errorHandler } from './errors.js';

type JsonLike = { code: number; success: boolean; message: string; data?: unknown };

function makeRes(): Response & { body?: unknown } {
    const out: {
        statusCode: number;
        headersSent: boolean;
        body?: unknown;
        status: (code: number) => unknown;
        json: (payload: unknown) => unknown;
    } = {
        statusCode: 200,
        headersSent: false,
        body: undefined,
        status(code: number) {
            out.statusCode = code;
            return out;
        },
        json(payload: unknown) {
            out.body = payload;
            return out;
        },
    };
    return out as unknown as Response & { body?: unknown };
}

function makeReq(): Request {
    return {} as unknown as Request;
}

function makeNext(capture: (err?: unknown) => void): NextFunction {
    return ((err?: unknown) => capture(err)) as NextFunction;
}

async function flush(): Promise<void> {
    await new Promise((r) => setImmediate(r));
}

test('AppError 携带 code 与 message', () => {
    const e = new AppError(404, '文章不存在');
    assert.equal(e.code, 404);
    assert.equal(e.message, '文章不存在');
    assert.equal(e.name, 'AppError');
});

test('asyncHandler 把异步异常交给 next', async () => {
    const handler = asyncHandler(async () => {
        throw new AppError(400, '参数错误');
    });
    const req = makeReq();
    const res = makeRes();
    let passed: unknown = undefined;
    handler(req, res, makeNext((err) => (passed = err)));
    await flush();
    assert.ok(passed instanceof AppError);
    assert.equal((passed as AppError).code, 400);
});

test('asyncHandler 正常路径不调 next(err)', async () => {
    let finished = false;
    const handler = asyncHandler(async () => {
        finished = true;
    });
    const req = makeReq();
    const res = makeRes();
    let passed: unknown = undefined;
    handler(req, res, makeNext((err) => (passed = err)));
    await flush();
    assert.equal(finished, true);
    assert.equal(passed, undefined);
});

test('errorHandler 渲染 AppError 的 code/message', () => {
    const req = makeReq();
    const res = makeRes();
    errorHandler(new AppError(404, '文章不存在'), req, res, () => {
        assert.fail('AppError 不应走到 next');
    });
    const body = res.body as JsonLike;
    assert.equal(res.statusCode, 404);
    assert.equal(body.code, 404);
    assert.equal(body.success, false);
    assert.equal(body.message, '文章不存在');
});

test('errorHandler 未知错误渲染 500', () => {
    const req = makeReq();
    const res = makeRes();
    errorHandler(new Error('boom'), req, res, () => {
        assert.fail('未知错误不应走到 next');
    });
    const body = res.body as JsonLike;
    assert.equal(res.statusCode, 500);
    assert.equal(body.code, 500);
    assert.equal(body.success, false);
});

test('errorHandler 在 headersSent 时透传给 next', () => {
    const req = makeReq();
    const res = makeRes();
    res.headersSent = true;
    const err = new AppError(500, 'x');
    let nextErr: unknown = undefined;
    errorHandler(err, req, res, makeNext((e) => (nextErr = e)));
    assert.equal(nextErr, err);
});
