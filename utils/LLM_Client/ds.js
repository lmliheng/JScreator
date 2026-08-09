
/**
 * @deepseek
 */
const API_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/chat/completions'
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
async function callDeepSeek(messages) {
    if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error('缺少 DEEPSEEK_API_KEY，请先在 .env 中完成配置。')
    }
    const startedAt = Date.now()
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            thinking: {
                type: 'disabled'
            },
            temperature: 0.1
        })
    })
    /**
     * 无论 HTTP 状态码是否成功，都先解析响应体。
     * 这样接口失败时，也可以将服务端返回的错误信息
     * 一起放入异常中，方便定位问题。
     */
    const data = await response.json()
    if (!response.ok) {
        throw new Error(
            `DeepSeek 调用失败：${response.status} ${JSON.stringify(data)}`
        )
    }
    const choice = data.choices?.[0]
    if (!choice?.message) {
        throw new Error(`DeepSeek 没有返回有效消息：${JSON.stringify(data)}`)
    }
    return {
        message: choice.message,
        finishReason: choice.finish_reason,
        latencyMs: Date.now() - startedAt,
        usage: data.usage
    }
}
module.exports = {
    callDeepSeek
}