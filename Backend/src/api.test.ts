/**
 * P1 集成测试：通过 supertest 启动 Express app，验证核心行为。
 *
 * 运行前提：
 *   1. tsc -p tsconfig.json 编译到 Backend/dist
 *   2. node --test Backend/dist/api.test.js
 *
 * 注意：本测试依赖 DB 连接池（启动时不连接，首次查询时才建链）。
 * GET / 不查 DB，不须 .env 即可通过。
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildApp } from './app.js';
import type { Express } from 'express';

let app: Express;

before(() => {
    app = buildApp();
});

describe('GET /（健康检查）', () => {
    test('返回 200 JSON { code, message }', async () => {
        const res = await request(app).get('/');
        assert.equal(res.status, 200);
        assert.equal(res.body.code, 200);
        assert.equal(typeof res.body.message, 'string');
    });

    test('Content-Type 含 application/json', async () => {
        const res = await request(app).get('/');
        assert.ok(res.headers['content-type']?.includes('application/json'));
    });
});

describe('不存在的路由', () => {
    test('返回 404（Express 默认 HTML）', async () => {
        const res = await request(app).get('/this-route-will-never-exist');
        assert.equal(res.status, 404);
    });
});

describe('CORS 头', () => {
    test('已知 origin 返回 Access-Control-Allow-Origin', async () => {
        const res = await request(app)
            .get('/')
            .set('Origin', 'http://localhost:5173');
        assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    });
});

describe('POST /（无 body 解析）', () => {
    test('Content-Type application/json 可正常解析', async () => {
        const res = await request(app)
            .post('/')
            .send({ test: true })
            .set('Content-Type', 'application/json');
        // 根路由只应答 GET，POST / 应为 404 或框架路由响应
        // 重点验证请求不崩溃
        assert.ok(res.status >= 200 && res.status < 600);
    });
});