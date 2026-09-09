/**
 * legacy-utils/llm —— LLM 调用封装（OpenAI 兼容协议，默认接 DeepSeek）
 * 迁移自 root utils/llm.js。
 */
import OpenAI from 'openai';

let _client: OpenAI | null = null;

function getClient(): OpenAI {
    if (_client) return _client;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        throw new Error('LLM 未配置：请在 .env 设置 DEEPSEEK_API_KEY');
    }
    _client = new OpenAI({
        apiKey,
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    });
    return _client;
}

export { getClient };

const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatOptions {
    model?: string;
    temperature?: number;
    max_tokens?: number;
}

/**
 * 非流式对话
 */
export async function chat(
    messages: ChatMessage[],
    opts: ChatOptions = {}
): Promise<string> {
    const client = getClient();
    const model = opts.model || DEFAULT_MODEL;
    const response = await client.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens ?? null,
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
    return response.choices?.[0]?.message?.content || '';
}

/**
 * 流式对话
 */
export async function chatStream(
    messages: ChatMessage[],
    onDelta: (delta: string) => void,
    opts: ChatOptions = {}
): Promise<void> {
    const client = getClient();
    const model = opts.model || DEFAULT_MODEL;
    const stream = await client.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens ?? null,
        stream: true,
    } as OpenAI.Chat.ChatCompletionCreateParamsStreaming);
    for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
    }
}