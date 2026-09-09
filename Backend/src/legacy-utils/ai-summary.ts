/**
 * legacy-utils/ai-summary —— AI 文章总结
 * 迁移自 root utils/ai_summary.js：调用 LLM 生成结构化导读，写入 article.ai_summary 字段。
 */
import { pool } from '../db/pool.js';
import { chat } from './llm.js';
import type { ChatMessage } from './llm.js';

const SYSTEM_PROMPT = `你是一位资深技术编辑和内容评审。请阅读用户提供的文章，输出一份结构化的 AI 导读。要求：
1. summary：一句话概括文章主旨（30 字内）
2. key_points：3-5 条核心要点，每条 20-40 字，使用列表
3. analysis：3-5 条分析评估（文章结构、内容深度、代码质量、优点、可改进处），每条 20-40 字
4. advice：2-3 条读者建议（适合谁读、怎么读更有效、可延伸的学习方向），每条 20-40 字

只输出 JSON，不要输出 markdown 代码块或其他文字。JSON 格式：
{"summary":"...","key_points":["..."],"analysis":["..."],"advice":["..."]}`;

export interface ArticleInput {
    title: string;
    content: string;
}

export interface ArticleSummary {
    summary: string;
    key_points: string[];
    analysis: string[];
    advice: string[];
}

/**
 * 调用 DeepSeek 生成文章总结
 */
export async function generateArticleSummary(article: ArticleInput): Promise<ArticleSummary> {
    const text = `【文章标题】${article.title || ''}\n\n【文章内容】\n${String(article.content || '').slice(0, 8000)}`;
    const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
    ];
    const raw = await chat(messages, { temperature: 0.4, max_tokens: 1200 });
    const cleaned = String(raw).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try {
        const obj: Record<string, unknown> = JSON.parse(cleaned);
        return {
            summary: String(obj.summary || '').slice(0, 200),
            key_points: Array.isArray(obj.key_points) ? obj.key_points.slice(0, 6).map(String) : [],
            analysis: Array.isArray(obj.analysis) ? obj.analysis.slice(0, 6).map(String) : [],
            advice: Array.isArray(obj.advice) ? obj.advice.slice(0, 4).map(String) : [],
        };
    } catch (e) {
        console.error('AI 总结 JSON 解析失败，原文:', cleaned.slice(0, 200));
        throw new Error('AI 总结解析失败');
    }
}

/**
 * 生成并保存总结到 article 表（幂等：失败不影响文章本身）
 */
export async function summarizeAndSave(
    articleId: number,
    article: ArticleInput
): Promise<ArticleSummary | null> {
    try {
        const result = await generateArticleSummary(article);
        await (pool as { query: (sql: string, params: unknown[]) => Promise<unknown> }).query(
            'UPDATE article SET ai_summary = ? WHERE article_id = ?',
            [JSON.stringify(result), articleId]
        );
        return result;
    } catch (error) {
        console.error(`文章 ${articleId} AI 总结生成失败:`, (error as Error).message);
        return null;
    }
}