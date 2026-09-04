/**
 * P0 工具：导出当前 Express 全部已注册接口清单（与 server.js 的挂载一致）
 *
 * 用法：
 *   node scripts/export_api_baseline.js [输出路径]
 *
 * 说明：
 * - 通过解析 server.js 的 app.use(require('./routes/xxx')) 自动同步挂载列表；
 * - 使用 utils/api_monitor 的 registerRoutes 扫描 app._router.stack；
 * - 不启动监听、不连数据库（仅 require 链，与 server.js 一致先加载根 .env）。
 */
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });

const express = require('express');
const app = express();

// 与 server.js 相同的挂载顺序：解析所有 app.use(require('./routes/<name>'))
const serverJs = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const re = /require\('\.\/routes\/([\w-]+)'\)/g;
const names = [];
let m;
while ((m = re.exec(serverJs))) {
    if (!names.includes(m[1])) names.push(m[1]);
}
for (const n of names) {
    const mod = require(path.join(root, 'routes', n));
    app.use(mod && mod.router ? mod.router : mod);
}

const { registerRoutes, getApiStats } = require(path.join(root, 'utils', 'api_monitor'));
registerRoutes(app);

const endpoints = getApiStats().map((x) => x.path).sort();
const out = {
    generatedAt: new Date().toISOString(),
    source: 'registerRoutes(app) 扫描 server.js 全部挂载',
    count: endpoints.length,
    endpoints,
};

const target = path.resolve(process.argv[2] || path.join(root, 'asset', 'devDocs', 'api-baseline.json'));
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out, null, 2), 'utf8');
console.log(`[baseline] ${endpoints.length} endpoints -> ${target}`);
process.exit(0); // 部分依赖（连接池/OSS 等）会持有句柄，主动退出避免挂起

