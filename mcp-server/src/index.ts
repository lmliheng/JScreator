/**
 * JScreator MCP Server —— 把博客开放 API（/api/v1）暴露成 MCP 工具。
 *
 * 环境变量：
 *   JS_API_KEY     必填：博客后台创建的 API Key（read 权限即可；write 工具需 read,write）
 *   JS_API_BASE    可选：默认 http://127.0.0.1:7000
 *
 * 运行：
 *   node dist/index.js                 # stdio 模式（Claude Desktop 等本地客户端）
 *   node dist/index.js --http          # SSE HTTP 模式（远程接入）
 */

import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import express from 'express'

// ---- 配置 ----
const API_KEY = process.env.JS_API_KEY || ''
const API_BASE = process.env.JS_API_BASE || 'http://127.0.0.1:7000'

if (!API_KEY) {
  console.error('[JScreator MCP] 缺少环境变量 JS_API_KEY（博客后台 → API Keys 创建）')
  process.exit(1)
}

const server = new McpServer({ name: 'jscreator-blog', version: '1.0.0' })

// ---- 调用博客开放 API 的公共函数 ----
async function apiCall(path: string, options: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok || json.code !== 200) {
    throw new Error(json.message || `HTTP ${res.status}`)
  }
  return json.data
}

// ================= 工具注册 =================

// 1. 文章列表
server.registerTool(
  'list_articles',
  {
    title: '获取文章列表',
    description: '按分页/关键词/分类查询博客已发布文章列表。返回文章 id、标题、作者、分类、时间。',
    inputSchema: {
      page: z.number().optional().describe('页码，默认 1'),
      pageSize: z.number().optional().describe('每页数量，默认 10，最大 50'),
      keyword: z.string().optional().describe('标题/内容关键词'),
      category_id: z.number().optional().describe('按分类筛选'),
    },
  },
  async (args) => {
    const params = new URLSearchParams()
    if (args.page) params.set('page', String(args.page))
    if (args.pageSize) params.set('pageSize', String(args.pageSize))
    if (args.keyword) params.set('keyword', args.keyword)
    if (args.category_id) params.set('category_id', String(args.category_id))
    const data = await apiCall(`/api/v1/articles?${params.toString()}`)
    const brief = (data.list || []).map((a: any) => ({
      id: a.article_id,
      title: a.title,
      author: a.author_name,
      categories: a.category_names,
      created_at: a.created_at,
    }))
    return { content: [{ type: 'text', text: JSON.stringify({ total: data.total, list: brief }, null, 2) }] }
  },
)

// 2. 文章详情
server.registerTool(
  'get_article',
  {
    title: '获取文章详情',
    description: '按文章 id 获取完整文章内容，包含标题、正文、作者、分类、发布时间。',
    inputSchema: { id: z.number().describe('文章 id') },
  },
  async (args) => {
    const a = await apiCall(`/api/v1/articles/${args.id}`)
    const text = [
      `标题：${a.title}`,
      `作者：${a.author_name}（@${a.author_username}）`,
      `分类：${(a.category_names || []).join('、') || '无'}`,
      `发布时间：${a.created_at}`,
      ``,
      `正文：`,
      a.content || '',
    ].join('\n')
    return { content: [{ type: 'text', text }] }
  },
)

// 3. 用户公开主页
server.registerTool(
  'get_user_profile',
  {
    title: '获取博主主页信息',
    description: '按用户名查询博主的公开资料：昵称、简介、地区、VIP、社交链接、文章统计。',
    inputSchema: { username: z.string().describe('用户名') },
  },
  async (args) => {
    const u = await apiCall(`/api/v1/users/${encodeURIComponent(args.username)}`)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              username: u.username,
              name: u.name,
              bio: u.bio,
              area: u.area,
              vip: u.vip,
              socials: u.socials,
              featured_articles: u.featured_articles,
              created_at: u.created_at,
            },
            null,
            2,
          ),
        },
      ],
    }
  },
)

// 4. AI 总结
server.registerTool(
  'get_article_ai_summary',
  {
    title: '获取文章 AI 总结',
    description: '获取某篇文章的 AI 导读（摘要、核心要点、分析评估、读者建议）。',
    inputSchema: { id: z.number().describe('文章 id') },
  },
  async (args) => {
    const a = await apiCall(`/api/v1/articles/${args.id}`)
    const s = a.ai_summary
    if (!s) {
      return { content: [{ type: 'text', text: '该文章暂无 AI 总结。' }] }
    }
    const parts = [`**概述**：${s.summary || ''}`]
    if (s.key_points?.length) parts.push(`**核心要点**：\n${s.key_points.map((x: string) => '- ' + x).join('\n')}`)
    if (s.analysis?.length) parts.push(`**分析评估**：\n${s.analysis.map((x: string) => '- ' + x).join('\n')}`)
    if (s.advice?.length) parts.push(`**读者建议**：\n${s.advice.map((x: string) => '- ' + x).join('\n')}`)
    return { content: [{ type: 'text', text: parts.join('\n\n') }] }
  },
)

// 5. 发布文章（需 write 权限的 Key）
server.registerTool(
  'create_article',
  {
    title: '发布文章',
    description: '以当前 API Key 持有者的身份创建文章。需要 write 权限的 API Key。',
    inputSchema: {
      title: z.string().describe('文章标题'),
      content: z.string().describe('文章正文（Markdown）'),
      category_ids: z.array(z.number()).optional().describe('分类 id 数组'),
      status: z.number().optional().describe('0 草稿 / 1 发布 / 2 仅自己可见，默认 1'),
    },
  },
  async (args) => {
    const data = await apiCall('/api/v1/articles', {
      method: 'POST',
      body: {
        title: args.title,
        content: args.content,
        category_ids: args.category_ids || [],
        status: args.status ?? 1,
      },
    })
    return { content: [{ type: 'text', text: `发布成功，文章 id：${data.article_id}` }] }
  },
)

// ================= 传输 =================

async function main() {
  const useHttp = process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http'
  if (useHttp) {
    // SSE HTTP 传输（远程接入）
    const app = express()
    let transport: SSEServerTransport | null = null
    app.get('/sse', async (req, res) => {
      transport = new SSEServerTransport('/messages', res)
      await server.connect(transport)
    })
    app.post('/messages', (req, res) => {
      if (transport) transport.handlePostMessage(req, res)
      else res.status(400).send('no session')
    })
    const port = Number(process.env.MCP_HTTP_PORT || 3210)
    app.listen(port, () => {
      console.log(`[JScreator MCP] SSE server 运行在 http://127.0.0.1:${port}/sse`)
    })
  } else {
    // stdio 传输（Claude Desktop / Cursor 等本地客户端）
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('[JScreator MCP] stdio server 运行中（用 JS_API_KEY 连接博客 API）')
  }
}

main().catch((e) => {
  console.error('[JScreator MCP] 启动失败:', e)
  process.exit(1)
})
