/**
 * P2 单测：middleware/auth（verifyToken / requireRole）
 *
 * 说明：
 * - tokenValidator（根 utils/token_creator.js，经 legacy 桥加载）每次调用时懒读 process.env.JWT_SECRET，
 *   因此本文件在模块顶层注入固定 secret 即可让签名/校验在测试内自洽，不依赖根 .env。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { NextFunction, Request, Response } from 'express';

// 先注入 secret（在调用 tokenValidator 之前生效；其读取是惰性的）
process.env.JWT_SECRET = 'p2-unit-test-secret';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken') as {
    sign: (payload: unknown, secret: string, opts: unknown) => string;
};

import { requireRole, verifyToken, type AuthedRequest, type TokenPayload } from './auth.js';

type JsonLike = { code: number; success: boolean; message: string };

function makeRes(): Response & { body?: unknown } {
    const out: {
        statusCode: number;
        headersSent: boolean;
        body?: unknown;
        status: (code: number) => unknown;
        json: (payload: unknown) => unknown;
        on: () => unknown;
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
        on() {
            return out;
        },
    };
    return out as unknown as Response & { body?: unknown };
}

function makeReq(header?: string): Request {
    const req = { headers: {} } as { headers: { authorization?: string } } & Record<string, unknown>;
    if (header !== undefined) req.headers.authorization = header;
    return req as unknown as Request;
}

function makeNext(capture: () => void): NextFunction {
    return (() => capture()) as NextFunction;
}

function sign(payload: unknown): string {
    return jwt.sign(payload, process.env.JWT_SECRET || 'x', { expiresIn: '7d' });
}

test('verifyToken 合法 token：设置 req.user 并放行', () => {
    const token = sign({ id: 7, role_id: 1 });
    const req = makeReq(token);
    const res = makeRes();
    let advanced = false;
    verifyToken(req, res, makeNext(() => (advanced = true)));
    const user = (req as AuthedRequest).user as TokenPayload;
    assert.equal(advanced, true);
    assert.equal(user.id, 7);
    assert.equal(user.role_id, 1);
    assert.equal(res.statusCode, 200); // 未写响应
});

test('verifyToken 兼容 Bearer 前缀', () => {
    const req = makeReq('Bearer ' + sign({ id: 3 }));
    const res = makeRes();
    let advanced = false;
    verifyToken(req, res, makeNext(() => (advanced = true)));
    assert.equal(advanced, true);
    assert.equal((req as AuthedRequest).user?.id, 3);
});

test('verifyToken 非法 token：401 且不放行', () => {
    const req = makeReq('Bearer not-a-jwt');
    const res = makeRes();
    let advanced = false;
    verifyToken(req, res, makeNext(() => (advanced = true)));
    assert.equal(advanced, false);
    const body = res.body as JsonLike;
    assert.equal(res.statusCode, 401);
    assert.equal(body.code, 401);
    assert.equal(body.success, false);
});

test('verifyToken 缺失 token：401', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    let advanced = false;
    verifyToken(req, res, makeNext(() => (advanced = true)));
    assert.equal(advanced, false);
    assert.equal(res.statusCode, 401);
});

test('requireRole 无权限角色：403', () => {
    const req = makeReq() as AuthedRequest;
    req.user = { id: 1, role_id: 2 };
    const res = makeRes();
    let advanced = false;
    requireRole(1)(req, res, makeNext(() => (advanced = true)));
    assert.equal(advanced, false);
    const body = res.body as JsonLike;
    assert.equal(res.statusCode, 403);
    assert.equal(body.code, 403);
});

test('requireRole 命中角色：放行', () => {
    const req = makeReq() as AuthedRequest;
    req.user = { id: 1, role_id: 1 };
    const res = makeRes();
    let advanced = false;
    requireRole(1, 3)(req, res, makeNext(() => (advanced = true)));
    assert.equal(advanced, true);
    assert.equal(res.statusCode, 200);
});
