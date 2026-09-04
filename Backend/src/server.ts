/**
 * P1 入口：与根 server.js 等价的 TS 启动（http.Server 承载 Express + WebSocket 同端口）。
 *
 * 调试用法：DUMP_BASELINE=<json 路径> node Backend/dist/server.js —— 导出接口清单后退出（不监听），
 * 用于与根入口的 api-baseline.json 做等价 diff。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from './app.js';
import { loadApiMonitor } from './legacy.js';
import { initWsServer, type WsHandlers } from './infra/ws/ws.server.js';
import { createAgentService } from './modules/agent/agent.service.js';
import { DmService } from './modules/dm/dm.service.js';
import { userDao } from './modules/user/user.dao.js';

const app = buildApp();

if (process.env.DUMP_BASELINE) {
    const { getApiStats } = loadApiMonitor();
    const endpoints = getApiStats()
        .map((x) => x.path)
        .sort();
    const target = path.resolve(process.env.DUMP_BASELINE);
    fs.writeFileSync(
        target,
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                source: 'Backend TS entry (registerRoutes)',
                count: endpoints.length,
                endpoints,
            },
            null,
            2
        ),
        'utf8'
    );
    console.log(`[ts-entry baseline] ${endpoints.length} endpoints -> ${target}`);
    process.exit(0);
}

const PORT = Number(process.env.PORT || 7000);
// 用 http.Server 承载 Express，以便 WebSocket 挂同一端口（P5：TS 实现，业务经 services 注入）
const server = http.createServer(app);

const agentService = createAgentService();
const dmService = new DmService();
const wsHandlers: WsHandlers = {
    agentProfile: (userId, content, history) => agentService.handleProfileAgent(userId, content, history),
    agentArticle: (params) => agentService.handleArticleAgent({ content: params.content, mode: params.mode }),
    loadOwnArticle: (userId, articleId) => agentService.loadOwnArticle(userId, articleId),
    dmSend: (from, to, content) => dmService.send(from, to, content),
    dmUserExists: async (userId) => (await userDao.getBasicById(userId)) !== null,
    dmMarkRead: (userId, otherId) => dmService.markRead(userId, otherId),
};
initWsServer(server, wsHandlers);

server.listen(PORT, () => {
    console.log(`[TS entry] 服务器运行在端口 ${PORT}`);
});
