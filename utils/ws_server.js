const { WebSocketServer } = require('ws')
const jwt = require('jsonwebtoken')
const { pool } = require('./connect_db')
const { handleProfileAgent, handleArticleAgent, loadOwnArticle } = require('./agent')
const {
    msgSend,
    msgConversation,
    msgMarkRead,
} = require('./db_message')

/**
 * WebSocket 实时服务（挂在与 Express 同一端口）
 * 消息协议（JSON）：
 *
 * 客户端 → 服务端：
 *   { type: 'agent', agent: 'profile'|'article', content: '用户输入', articleId?: 数字, mode?: 'advice'|'rewrite' }
 *   { type: 'dm', to: 用户id, content: '消息' }
 *   { type: 'dm_read', from: 用户id }        // 标记已读某会话
 *   { type: 'ping' }
 *
 * 服务端 → 客户端：
 *   { type: 'agent_start' }                                  // Agent 开始思考
 *   { type: 'agent_delta', delta: '逐字' }                   // Agent 流式输出（打字机）
 *   { type: 'agent_done', reply: '...', data? }               // 完成
 *   { type: 'agent_error', message: '...' }
 *   { type: 'dm', id, from, to, content, created_at }         // 收到私信
 *   { type: 'dm_read_ack' }
 *   { type: 'pong' }
 */

const clients = new Map() // userId -> Set<ws>

function verifyToken(token) {
    try {
        const t = String(token || '').replace(/^Bearer\s+/i, '')
        const decoded = jwt.verify(t, process.env.JWT_SECRET || 'test')
        return decoded && decoded.id != undefined ? decoded : null
    } catch (e) {
        return null
    }
}

async function sendToUser(userId, payload) {
    const set = clients.get(Number(userId))
    if (!set) return
    const str = JSON.stringify(payload)
    for (const ws of set) {
        if (ws.readyState === 1) {
            try { ws.send(str) } catch (e) { /* ignore */ }
        }
    }
}

// 模拟流式打字：把一段文本按小块发给客户端
async function streamText(ws, text) {
    const step = 4
    for (let i = 0; i < text.length; i += step) {
        if (ws.readyState !== 1) return
        ws.send(JSON.stringify({ type: 'agent_delta', delta: text.slice(i, i + step) }))
        await new Promise((r) => setTimeout(r, 12))
    }
}

function initWsServer(server) {
    const wss = new WebSocketServer({ server, path: '/ws' })

    wss.on('connection', (ws, req) => {
        // token 通过 query 传递（浏览器 WebSocket 不能自定义 header）
        const url = new URL(req.url, 'http://localhost')
        const token = url.searchParams.get('token') || ''
        const decoded = verifyToken(token)
        if (!decoded) {
            ws.send(JSON.stringify({ type: 'error', message: '未登录或登录过期' }))
            ws.close(4001, 'unauthorized')
            return
        }
        const userId = Number(decoded.id)
        if (!clients.has(userId)) clients.set(userId, new Set())
        clients.get(userId).add(ws)
        ws.userId = userId

        ws.on('message', async (raw) => {
            let msg
            try { msg = JSON.parse(raw.toString()) } catch (e) { return }
            try {
                await handleMessage(ws, msg)
            } catch (e) {
                console.error('WS 消息处理错误:', e)
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'agent_error', message: e.message || '服务器内部错误' }))
                }
            }
        })

        ws.on('close', () => {
            const set = clients.get(userId)
            if (set) {
                set.delete(ws)
                if (set.size === 0) clients.delete(userId)
            }
        })

        ws.send(JSON.stringify({ type: 'connected', userId }))
    })

    console.log('[WS] WebSocket 服务已挂载在 /ws')
    return wss
}

async function handleMessage(ws, msg) {
    switch (msg.type) {
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }))
            break

        // ===== Agent 对话 =====
        case 'agent': {
            const agentType = msg.agent || 'profile'
            const content = String(msg.content || '').trim()
            if (!content && !msg.articleId) {
                ws.send(JSON.stringify({ type: 'agent_error', message: '内容不能为空' }))
                return
            }
            ws.send(JSON.stringify({ type: 'agent_start', agent: agentType }))

            if (agentType === 'profile') {
                const result = await handleProfileAgent(ws.userId, content, msg.history || [])
                await streamText(ws, result.reply)
                ws.send(JSON.stringify({ type: 'agent_done', reply: result.reply, data: result.changed || null }))
            } else if (agentType === 'article') {
                let article
                if (msg.articleId) {
                    article = await loadOwnArticle(ws.userId, msg.articleId)
                }
                const targetText = article ? `【文章标题】${article.title}\n${article.content}` : content
                const result = await handleArticleAgent({
                    content: targetText,
                    mode: msg.mode === 'rewrite' ? 'rewrite' : 'auto',
                })
                if (result.type === 'rewritten') {
                    // 改写结果较长，流式
                    await streamText(ws, '优化后的全文：\n\n' + result.rewritten)
                    ws.send(JSON.stringify({ type: 'agent_done', reply: result.rewritten, data: { rewritten: true } }))
                } else if (result.type === 'advice') {
                    const reply = [
                        result.title_suggest ? `**标题建议**：${result.title_suggest}` : '',
                        ...(result.advice || []).map((a, i) => `${i + 1}. ${a}`),
                    ].filter(Boolean).join('\n')
                    await streamText(ws, reply)
                    ws.send(JSON.stringify({ type: 'agent_done', reply }))
                } else {
                    await streamText(ws, result.reply)
                    ws.send(JSON.stringify({ type: 'agent_done', reply: result.reply }))
                }
            } else {
                ws.send(JSON.stringify({ type: 'agent_error', message: '未知 Agent 类型' }))
            }
            break
        }

        // ===== 用户私信 =====
        case 'dm': {
            const to = Number(msg.to)
            const content = String(msg.content || '').trim()
            if (!to || !content) {
                ws.send(JSON.stringify({ type: 'agent_error', message: '参数缺失' }))
                return
            }
            if (to === ws.userId) {
                ws.send(JSON.stringify({ type: 'agent_error', message: '不能给自己发消息' }))
                return
            }
            // 校验对方存在
            const [rows] = await pool.query('SELECT id FROM user WHERE id = ?', [to])
            if (!rows.length) {
                ws.send(JSON.stringify({ type: 'agent_error', message: '对方不存在' }))
                return
            }
            const id = await msgSend(ws.userId, to, content)
            const payload = { type: 'dm', id, from: ws.userId, to, content, created_at: new Date().toISOString() }
            // 发给对方（在线则实时送达）
            await sendToUser(to, payload)
            // 回执给自己（用于 UI 显示已发送）
            ws.send(JSON.stringify({ type: 'dm_sent', id, to, content, created_at: payload.created_at }))
            break
        }

        // 标记会话已读（对方=from）
        case 'dm_read': {
            const from = Number(msg.from)
            if (from) {
                await msgMarkRead(ws.userId, from)
                ws.send(JSON.stringify({ type: 'dm_read_ack', from }))
            }
            break
        }

        default:
            ws.send(JSON.stringify({ type: 'agent_error', message: '未知消息类型' }))
    }
}

module.exports = { initWsServer, sendToUser }
