/**
 * modules/agent/agent.service —— 博客 Agent 逻辑（资料编辑 / 文章优化）。
 * P5：从 utils/agent.js 移植；LLM 对话走 utils/llm.js 桥（infra），用户/文章读写走 TS DAO。
 */
import { userDao } from '../user/user.dao.js';
import { articleDao } from '../article/article.dao.js';
import { loadLlmChat } from '../../legacy.js';

type ChatMsg = { role: string; content: string };

export interface AgentDeps {
    /** utils/llm.js chat（infra 桥） */
    chat: (messages: ChatMsg[], opts?: { model?: string; temperature?: number; max_tokens?: number }) => Promise<string>;
    getUserById: (id: number | string) => Promise<Record<string, unknown> | null>;
    updateProfile: (id: number | string, fields: Record<string, unknown>) => Promise<boolean>;
    articleDetail: (id: number) => Promise<{ article_id: number; title: string; content: string; user_id: number | string; [k: string]: unknown } | null>;
}

export type ProfileAgentResult = { type: 'done'; reply: string; changed: Record<string, string> } | { type: 'reply'; reply: string };
export type ArticleAgentResult =
    | { type: 'rewritten'; rewritten: string }
    | { type: 'advice'; advice: string[]; title_suggest: string }
    | { type: 'reply'; reply: string };

const PROFILE_FIELDS = ['name', 'bio', 'area', 'avatar'];

const PROFILE_SYSTEM = `你是一位账号资料助手。用户会用自然语言要求修改自己的博客资料（昵称 name、简介 bio、地区 area、头像 avatar URL）。
请从用户的话里提取要修改的字段，输出 JSON（不要任何其他文字）：
{"fields": {"name": "...", "bio": "...", "area": "...", "avatar": "..."}}
只包含用户明确提到的字段；无法确定值的字段省略。若用户只是闲聊或询问，输出：
{"reply": "你的回复"}
若没有检测到任何资料修改意图，也请用 reply 说明你没听懂。`;

const ARTICLE_SYSTEM = `你是一位资深技术编辑与写作教练。用户会粘贴自己的文章或要求优化某篇文章。
请从整体结构、表达清晰度、代码示例、SEO标题等角度给出优化建议，并给出改进后的标题建议。
如果用户明确要求"改写/优化文本"，请直接输出改写后的全文（保留 markdown 格式）。
如果用户只是贴文章问意见，则输出结构化建议 JSON：
{"advice": ["建议1", "建议2", ...], "title_suggest": "优化后标题"}
如果用户要求改写，输出：
{"rewritten": "改写后的全文（markdown）"}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripCodeFence(raw: string): string {
    return String(raw)
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
}

export class AgentService {
    constructor(private readonly d: AgentDeps) {}

    /** 资料编辑 Agent（对齐 utils/agent.js handleProfileAgent） */
    async handleProfileAgent(userId: number | string, content: string, history: Array<{ role: string; content: string }> = []): Promise<ProfileAgentResult> {
        const user = await this.d.getUserById(userId);
        if (!user) throw new Error('用户不存在');

        const historyText = history
            .slice(-6)
            .map((m) => `${m.role === 'user' ? '用户' : '助手'}：${m.content}`)
            .join('\n');
        const raw = await this.d.chat(
            [
                { role: 'system', content: PROFILE_SYSTEM },
                {
                    role: 'user',
                    content: `当前资料：昵称=${user.name || ''}，简介=${user.bio || ''}，地区=${user.area || ''}，头像=${user.avatar || ''}\n${historyText ? '最近对话：\n' + historyText + '\n' : ''}用户最新消息：${content}`,
                },
            ],
            { temperature: 0.2, max_tokens: 600 }
        );
        const cleaned = stripCodeFence(raw);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let obj: any;
        try {
            obj = JSON.parse(cleaned);
        } catch {
            obj = { reply: '抱歉，我没理解你的意思，请说得具体一点，比如「把简介改成 xxx」' };
        }

        if (obj && obj.reply) return { type: 'reply', reply: obj.reply };

        const fields: Record<string, unknown> = (obj && obj.fields) || {};
        const updatable: Record<string, string> = {};
        for (const k of PROFILE_FIELDS) {
            if (fields[k] !== undefined && fields[k] !== null && String(fields[k]).trim() !== '') {
                updatable[k] = String(fields[k]).trim();
            }
        }
        if (!Object.keys(updatable).length) {
            return { type: 'reply', reply: '我没有从你的话里识别出要修改的资料。可以试试：「把简介改成 xxx」「地区改成 北京」' };
        }
        await this.d.updateProfile(userId, updatable);
        const labels: Record<string, string> = { name: '昵称', bio: '简介', area: '地区', avatar: '头像' };
        const desc = Object.keys(updatable)
            .map((k) => labels[k] || k)
            .join('、');
        return { type: 'done', reply: `已更新你的${desc} ✅`, changed: updatable };
    }

    /** 文章优化 Agent（对齐 utils/agent.js handleArticleAgent） */
    async handleArticleAgent(params: { content?: unknown; mode?: string }): Promise<ArticleAgentResult> {
        const { content, mode } = params;
        const text = String(content || '').slice(0, 12000);
        const prompt =
            mode === 'rewrite'
                ? `请直接改写下面这篇文章（保持 markdown，输出 JSON {"rewritten": "..."}）：\n${text}`
                : `请分析下面这篇文章并给出优化建议：\n${text}`;
        const raw = await this.d.chat(
            [
                { role: 'system', content: ARTICLE_SYSTEM },
                { role: 'user', content: prompt },
            ],
            { temperature: 0.5, max_tokens: 3000 }
        );
        const cleaned = stripCodeFence(raw);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const obj = JSON.parse(cleaned) as { rewritten?: string; advice?: string[]; title_suggest?: string };
            if (obj.rewritten) return { type: 'rewritten', rewritten: obj.rewritten };
            return { type: 'advice', advice: obj.advice || [], title_suggest: obj.title_suggest || '' };
        } catch {
            // 模型没按 JSON 输出 → 原样返回作为文本
            return { type: 'reply', reply: cleaned };
        }
    }

    /** 文章优化：按 id 取文章（校验作者，对齐 utils/agent.js loadOwnArticle） */
    async loadOwnArticle(userId: number | string, articleId: number) {
        const article = await this.d.articleDetail(Number(articleId));
        if (!article) throw new Error('文章不存在');
        if (Number(article.user_id) !== Number(userId)) throw new Error('只能优化你自己的文章');
        return article;
    }
}

/** 生产组装（server 启动时注入） */
export function createAgentService(): AgentService {
    const deps: AgentDeps = {
        chat: (messages, opts) => loadLlmChat().chat(messages, opts),
        getUserById: (id) => userDao.getDetailById(id),
        updateProfile: (id, fields) => userDao.updateProfile(id, fields),
        articleDetail: (id) => articleDao.detail(id),
    };
    return new AgentService(deps);
}
