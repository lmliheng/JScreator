# JScreator MCP Server

把 JScreator 博客的开放 API（`/api/v1`）暴露为 [Model Context Protocol](https://modelcontextprotocol.io) 工具，
让 Claude Desktop / Cursor / 其他 MCP 客户端可以查询博客文章、博主资料、AI 总结，甚至代发文章。

## 工具

| 工具 | 说明 | 所需权限 |
|---|---|---|
| `list_articles` | 文章列表（分页/关键词/分类） | read |
| `get_article` | 文章详情（含正文） | read |
| `get_user_profile` | 博主公开主页信息 | read |
| `get_article_ai_summary` | 文章 AI 总结（概述/要点/分析/建议） | read |
| `create_article` | 以 Key 持有者身份发布文章 | read,write |

## 配置

环境变量：

```bash
JS_API_KEY=<后台 "API Keys" 页创建的 Key>   # read 即可；create_article 需要 read,write
JS_API_BASE=http://127.0.0.1:7000            # 可选，博客后端地址；线上指向云托管域名
```

## 运行

```bash
npm install
npm run build

# stdio 模式（Claude Desktop 等本地客户端）
JS_API_KEY=sk_xxx node dist/index.js

# SSE HTTP 模式（远程接入，监听 3210）
JS_API_KEY=sk_xxx node dist/index.js --http   # → http://127.0.0.1:3210/sse
```

## 接入 Claude Desktop

编辑 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "jscreator": {
      "command": "node",
      "args": ["C:/path/to/mcp-server/dist/index.js"],
      "env": { "JS_API_KEY": "sk_xxx" }
    }
  }
}
```

## 测试

```bash
# 编译 + 用官方 Client SDK 自测（替换为你的 key）
npm run build
JS_API_KEY=sk_xxx node -e "
import('./test-client.mjs')  // 需要时再补一个自测脚本
"
```
