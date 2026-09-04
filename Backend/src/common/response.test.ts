/**
 * P2 单测：response（统一信封 ok/fail，与 legacy 契约 { code, success, message, data } 对齐）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'express';
import { fail, ok } from './response.js';

function makeRes(): Response & { body?: unknown } {
    const out: {
        statusCode: number;
        body?: unknown;
        status: (code: number) => unknown;
        json: (payload: unknown) => unknown;
    } = {
        statusCode: 200,
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

test('ok(data) 输出 { code:200, success:true, message, data }', () => {
    const res = makeRes();
    ok(res, { article_id: 9 });
    const b = res.body as { code: number; success: boolean; message: string; data?: unknown };
    assert.equal(res.statusCode, 200);
    assert.equal(b.code, 200);
    assert.equal(b.success, true);
    assert.deepEqual(b.data, { article_id: 9 });
});

test('ok() 无 data 时不带 data 字段', () => {
    const res = makeRes();
    ok(res);
    const b = res.body as { data?: unknown };
    assert.equal('data' in b, false);
});

test('ok 支持自定义 message', () => {
    const res = makeRes();
    ok(res, undefined, '操作成功');
    const b = res.body as { message: string };
    assert.equal(b.message, '操作成功');
});

test('fail 输出状态码与信封', () => {
    const res = makeRes();
    fail(res, 403, '权限不足');
    const b = res.body as { code: number; success: boolean; message: string };
    assert.equal(res.statusCode, 403);
    assert.equal(b.code, 403);
    assert.equal(b.success, false);
    assert.equal(b.message, '权限不足');
});
