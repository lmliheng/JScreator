/**
 * infra/ws/ws.server —— WebSocket 实时服务（挂在与 Express 同一端口 /ws）。
 * P5：协议与行为逐行对齐 legacy utils/ws_server.js，业务经 handlers 注入（services）。
 *
 * 客户端 → 服务端：{type:'agent'|'dm'|'dm_read'|'ping'}；服务端 → 客户端见 legacy 协议注释。
 */
import { createRequire } from 'node:module';
import type { Server } from 'node:http';
import { loadTokenValidator } from '../../legacy.js';
import type { ArticleAgentResult, ProfileAgentResult } from '../../modules/agent/agent.service.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { WebSocketServer } = require('ws') as { WebSocketServer: new (opts: unknown) => any };

export interface WsHandlers {
    agentProfile: (userId: number | string, content: string, history: Array<{ role: string; content: string }>) => Promise<ProfileAgentResult>;
    agentArticle: (params: { content: string; mode: 'rewrite' | 'auto' }) => Promise<ArticleAgentResult>;
    loadOwnArticle: (userId: number | string, articleId: number) => Promise<{ title: string; content: string }>;
    dmSend: (from: number | string, to: number | string, content: string) => Promise<number | string>;
    dmUserExists: (userId: number | string) => Promise<boolean>;
    dmMarkRead: (userId: number | string, otherId: number) => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ws = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clients = new Map<number, Set<any>>();

function sendToUser(userId: number | string, payload: unknown): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const set = clients.get(Number(userId));
    if (!set) return;
    const str = JSON.stringify(payload);
    for (const ws of set) {
        if (ws.readyState === 1) {
            try {
                ws.send(str);
            } catch {
                /* ignore */
            }
        }
    }
}

/** 模拟流式打字：把一段文本按小块发给客户端 */
async function streamText(ws: Ws, text: string): Promise<void> {
    const step = 4;
    for (let i = 0; i < text.length; i += step) {
        if (ws.readyState !== 1) return;
        ws.send(JSON.stringify({ type: 'agent_delta', delta: text.slice(i, i + step) }));
        await new Promise((r) => setTimeout(r, 12));
    }
}

function verifyToken(token: string | undefined): { id: number | string } | null {
    const decoded = loadTokenValidator()(token);
    if (decoded && typeof decoded === 'object' && (decoded as { id?: unknown }).id !== undefined) {
        return { id: (decoded as { id: number | string }).id };
    }
    return null;
}

export function initWsServer(server: Server, h: WsHandlers): unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wss = new WebSocketServer({ server, path: '/ws' }) as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wss.on('connection', (ws: any, req: { url: string }) => {
        // token 通过 query 传递（浏览器 WebSocket 不能自定义 header）
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token') || '';
        const decoded = verifyToken(token);
        if (!decoded) {
            ws.send(JSON.stringify({ type: 'error', message: '未登录或登录过期' }));
            ws.close(4001, 'unauthorized');
            return;
        }
        const userId = Number(decoded.id);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        let wsSet = clients.get(userId);
        if (!wsSet) {
            wsSet = new Set();
            clients.set(userId, wsSet);
        }
        wsSet.add(ws);
        ws.userId = userId;

        ws.on('message', async (raw: Buffer) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let msg: any;
            try {
                msg = JSON.parse(raw.toString());
            } catch {
                return;
            }
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                await handleMessage(ws, msg, h);
            } catch (e) {
                console.error('WS 消息处理错误:', e);
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'agent_error', message: (e as Error).message || '服务器内部错误' }));
                }
            }
        });

        ws.on('close', () => {
            const set = clients.get(userId);
            if (set) {
                set.delete(ws);
                if (set.size === 0) clients.delete(userId);
            }
        });

        ws.send(JSON.stringify({ type: 'connected', userId }));
    });

    console.log('[WS] WebSocket 服务已挂载在 /ws（TS 实现）');
    return wss;
}

async function handleMessage(ws: Ws, msg: { type?: string }, h: WsHandlers): Promise<void> {
    switch (msg.type) {
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

        // ===== Agent 对话 =====
        case 'agent': {
            const agentType = String((msg as { agent?: string }).agent || 'profile');
            const content = String((msg as { content?: string }).content || '').trim();
            if (!content && !(msg as { articleId?: unknown }).articleId) {
                ws.send(JSON.stringify({ type: 'agent_error', message: '内容不能为空' }));
                return;
            }
            ws.send(JSON.stringify({ type: 'agent_start', agent: agentType }));

            if (agentType === 'profile') {
                const result = await h.agentProfile(ws.userId, content, (msg as { history?: Array<{ role: string; content: string }> }).history || []);
                await streamText(ws, result.reply);
                ws.send(
                    JSON.stringify(
                        result.type === 'done'
                            ? { type: 'agent_done', reply: result.reply, data: result.changed || null }
                            : { type: 'agent_done', reply: result.reply }
                    )
                );
            } else if (agentType === 'article') {
                let targetText = content;
                const articleId = (msg as { articleId?: unknown }).articleId;
                if (articleId) {
                    const article = await h.loadOwnArticle(ws.userId, Number(articleId));
                    targetText = `【文章标题】${article.title}\n${article.content}`;
                }
                const mode: 'rewrite' | 'auto' = (msg as { mode?: string }).mode === 'rewrite' ? 'rewrite' : 'auto';
                const result = await h.agentArticle({ content: targetText, mode });
                if (result.type === 'rewritten') {
                    // 改写结果较长，流式
                    await streamText(ws, '优化后的全文：\n\n' + result.rewritten);
                    ws.send(JSON.stringify({ type: 'agent_done', reply: result.rewritten, data: { rewritten: true } }));
                } else if (result.type === 'advice') {
                    const reply = [
                        result.title_suggest ? `**标题建议**：${result.title_suggest}` : '',
                        ...(result.advice || []).map((a, i) => `${i + 1}. ${a}`),
                    ]
                        .filter(Boolean)
                        .join('\n');
                    await streamText(ws, reply);
                    ws.send(JSON.stringify({ type: 'agent_done', reply }));
                } else {
                    await streamText(ws, result.reply);
                    ws.send(JSON.stringify({ type: 'agent_done', reply: result.reply }));
                }
            } else {
                ws.send(JSON.stringify({ type: 'agent_error', message: '未知 Agent 类型' }));
            }
            break;
        }

        // ===== 用户私信 =====
        case 'dm': {
            const to = Number((msg as { to?: unknown }).to);
            const content = String((msg as { content?: unknown }).content || '').trim();
            if (!to || !content) {
                ws.send(JSON.stringify({ type: 'agent_error', message: '参数缺失' }));
                return;
            }
            if (to === ws.userId) {
                ws.send(JSON.stringify({ type: 'agent_error', message: '不能给自己发消息' }));
                return;
            }
            // 校验对方存在
            if (!(await h.dmUserExists(to))) {
                ws.send(JSON.stringify({ type: 'agent_error', message: '对方不存在' }));
                return;
            }
            const id = await h.dmSend(ws.userId, to, content);
            const payload = { type: 'dm', id, from: ws.userId, to, content, created_at: new Date().toISOString() };
            // 发给对方（在线则实时送达）
            sendToUser(to, payload);
            // 回执给自己（用于 UI 显示已发送）
            ws.send(JSON.stringify({ type: 'dm_sent', id, to, content, created_at: payload.created_at }));
            break;
        }

        // 标记会话已读（对方=from）
        case 'dm_read': {
            const from = Number((msg as { from?: unknown }).from);
            if (from) {
                await h.dmMarkRead(ws.userId, from);
                ws.send(JSON.stringify({ type: 'dm_read_ack', from }));
            }
            break;
        }

        default:
            ws.send(JSON.stringify({ type: 'agent_error', message: '未知消息类型' }));
    }
}
