/**
 * P6 契约测试：TS 入口注册的接口路径集 必须 == 基线（asset/devDocs/api-baseline.json）。
 * 防止后续改动（增删路由/路径拼写/方法）悄悄偏离对外契约。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { loadApiMonitor } from './legacy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/contract.test.js → 仓库根
const root = path.resolve(here, '../..');
const baselineFile = path.join(root, 'asset', 'devDocs', 'api-baseline.json');

test('契约：TS 注册路径集与 api-baseline.json 一致', () => {
    const app = buildApp();
    const { getApiStats } = loadApiMonitor();
    const actual = getApiStats()
        .map((x) => x.path)
        .sort();
    const expected = (JSON.parse(fs.readFileSync(baselineFile, 'utf8')) as { endpoints: string[] })
        .endpoints.slice()
        .sort();
    assert.equal(actual.length, expected.length, `路径数量不一致：实际 ${actual.length} vs 基线 ${expected.length}`);
    assert.deepEqual(actual, expected);
});
