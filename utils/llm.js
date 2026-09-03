const dotenv = require('dotenv')
const path = require('path')
dotenv.config({ path: path.join(__dirname, '..', '.env') })
const OpenAI = require('openai')

/**
 * LLM 调用封装（OpenAI 兼容协议，默认接 DeepSeek）
 * 统一出口：其他模块（AI 总结 / Agent）通过本文件调用，不直接依赖 openai 包。
 *
 * 环境变量：
 *   DEEPSEEK_API_KEY   必填
 *   DEEPSEEK_BASE_URL  默认 https://api.deepseek.com
 *   DEEPSEEK_MODEL     默认 deepseek-chat
 */
let _client = null

function getClient() {
    if (_client) return _client
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
        throw new Error('LLM 未配置：请在 .env 设置 DEEPSEEK_API_KEY')
    }
    _client = new OpenAI({
        apiKey,
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    })
    return _client
}

const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

/**
 * 非流式对话（一次返回完整回答）
 * @param {Array<{role:'system'|'user'|'assistant', content:string}>} messages
 * @param {Object} [opts] { model, temperature, max_tokens }
 * @returns {Promise<string>} 回答文本
 */
async function chat(messages, opts = {}) {
    const client = getClient()
    const model = opts.model || DEFAULT_MODEL
    const response = await client.chat.completions.create({
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens,
    })
    return response.choices?.[0]?.message?.content || ''
}

/**
 * 流式对话（逐 token 回调）
 * @param {Array} messages
 * @param {(delta:string)=>void} onDelta 每段增量回调
 * @param {Object} [opts]
 * @returns {Promise<void>}
 */
async function chatStream(messages, onDelta, opts = {}) {
    const client = getClient()
    const model = opts.model || DEFAULT_MODEL
    const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens,
        stream: true,
    })
    for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content
        if (delta) onDelta(delta)
    }
}

module.exports = { chat, chatStream, getClient }
