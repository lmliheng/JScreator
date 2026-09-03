const { chat } = require('./llm')
const { user_updateProfile, user_getById } = require('./db_curd')
const { article_detail } = require('./db_article')

/**
 * 博客 Agent 逻辑
 * 1. 资料编辑 Agent：从用户自然语言提取要改的资料字段 → 直接执行（会话内确认由前端发起 confirm 事件）
 * 2. 文章优化 Agent：对用户文章/文本给优化建议，可返回改写结果
 *
 * 设计：Agent 调用 LLM 时用「工具调用式」prompt，让模型输出结构化 JSON（要执行的动作），
 * 服务端解析后执行真实操作，避免模型自由文本难落地。
 */

// ============ 资料编辑 Agent ============

const PROFILE_FIELDS = ['name', 'bio', 'area', 'avatar']

const PROFILE_SYSTEM = `你是一位账号资料助手。用户会用自然语言要求修改自己的博客资料（昵称 name、简介 bio、地区 area、头像 avatar URL）。
请从用户的话里提取要修改的字段，输出 JSON（不要任何其他文字）：
{"fields": {"name": "...", "bio": "...", "area": "...", "avatar": "..."}}
只包含用户明确提到的字段；无法确定值的字段省略。若用户只是闲聊或询问，输出：
{"reply": "你的回复"}
若没有检测到任何资料修改意图，也请用 reply 说明你没听懂。`

/**
 * 处理资料编辑消息
 * @param {number} userId
 * @param {string} content 用户消息
 * @param {Array} history 最近对话（[{role, content}]）
 * @returns {Promise<{type:'done', reply:string, changed?:object} | {type:'reply', reply:string}>}
 */
async function handleProfileAgent(userId, content, history = []) {
    const user = await user_getById(userId)
    if (!user) throw new Error('用户不存在')

    const historyText = history.slice(-6).map((m) => `${m.role === 'user' ? '用户' : '助手'}：${m.content}`).join('\n')
    const raw = await chat(
        [
            { role: 'system', content: PROFILE_SYSTEM },
            { role: 'user', content: `当前资料：昵称=${user.name || ''}，简介=${user.bio || ''}，地区=${user.area || ''}，头像=${user.avatar || ''}\n${historyText ? '最近对话：\n' + historyText + '\n' : ''}用户最新消息：${content}` },
        ],
        { temperature: 0.2, max_tokens: 600 }
    )
    const cleaned = String(raw).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    let obj
    try { obj = JSON.parse(cleaned) } catch (e) { obj = { reply: '抱歉，我没理解你的意思，请说得具体一点，比如「把简介改成 xxx」' } }

    if (obj.reply) return { type: 'reply', reply: obj.reply }

    const fields = obj.fields || {}
    const updatable = {}
    for (const k of PROFILE_FIELDS) {
        if (fields[k] !== undefined && fields[k] !== null && String(fields[k]).trim() !== '') {
            updatable[k] = String(fields[k]).trim()
        }
    }
    if (!Object.keys(updatable).length) {
        return { type: 'reply', reply: '我没有从你的话里识别出要修改的资料。可以试试：「把简介改成 xxx」「地区改成 北京」' }
    }
    // 直接执行（资料编辑低风险）
    await user_updateProfile(userId, updatable)
    const labels = { name: '昵称', bio: '简介', area: '地区', avatar: '头像' }
    const desc = Object.keys(updatable).map((k) => `${labels[k] || k}`).join('、')
    return { type: 'done', reply: `已更新你的${desc} ✅`, changed: updatable }
}

// ============ 文章优化 Agent ============

const ARTICLE_SYSTEM = `你是一位资深技术编辑与写作教练。用户会粘贴自己的文章或要求优化某篇文章。
请从整体结构、表达清晰度、代码示例、SEO标题等角度给出优化建议，并给出改进后的标题建议。
如果用户明确要求"改写/优化文本"，请直接输出改写后的全文（保留 markdown 格式）。
如果用户只是贴文章问意见，则输出结构化建议 JSON：
{"advice": ["建议1", "建议2", ...], "title_suggest": "优化后标题"}
如果用户要求改写，输出：
{"rewritten": "改写后的全文（markdown）"}`

/**
 * 文章优化 Agent
 * @param {object} params { content: 文本, mode: 'advice'|'rewrite'|'auto' }
 */
async function handleArticleAgent(params) {
    const { content, mode } = params
    const text = String(content || '').slice(0, 12000)
    const prompt = mode === 'rewrite'
        ? `请直接改写下面这篇文章（保持 markdown，输出 JSON {"rewritten": "..."}）：\n${text}`
        : `请分析下面这篇文章并给出优化建议：\n${text}`
    const raw = await chat(
        [
            { role: 'system', content: ARTICLE_SYSTEM },
            { role: 'user', content: prompt },
        ],
        { temperature: 0.5, max_tokens: 3000 }
    )
    const cleaned = String(raw).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    try {
        const obj = JSON.parse(cleaned)
        if (obj.rewritten) return { type: 'rewritten', rewritten: obj.rewritten }
        return { type: 'advice', advice: obj.advice || [], title_suggest: obj.title_suggest || '' }
    } catch (e) {
        // 模型没按 JSON 输出 → 原样返回作为文本
        return { type: 'reply', reply: cleaned }
    }
}

/**
 * 文章优化：按 id 取文章内容（校验作者）
 */
async function loadOwnArticle(userId, articleId) {
    const article = await article_detail(Number(articleId))
    if (!article) throw new Error('文章不存在')
    if (Number(article.user_id) !== Number(userId)) throw new Error('只能优化你自己的文章')
    return article
}

module.exports = { handleProfileAgent, handleArticleAgent, loadOwnArticle }
