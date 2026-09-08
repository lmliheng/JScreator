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

/**
 * @DUMP_BASELINE
 */
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
    console.log(`服务器运行在端口 ${PORT}`);
});
