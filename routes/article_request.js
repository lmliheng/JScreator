const express = require('express')
const router = express.Router()
const { tokenValidator } = require('../utils/token_creator')

// 复用 db_curd.js 的分类函数（遗留函数随 P0 路由删除，见 ARCHITECTURE-PLAN §7.6）
const {
    article_category_getAll,
    article_category_add,
    article_category_update,
    article_category_delete,
} = require('../utils/db_curd')

// 新增文章/分类数据层（按实际表结构，见 utils/db_article.js）
const {
    isAdminOrEditor,
    article_getById,
    article_list,
    article_detail,
    article_add,
    article_update,
    article_delete,
    article_mine,
    article_archive,
    category_getById,
    category_updateAny,
    category_deleteAny,
} = require('../utils/db_article')

//========================================
// table: article
// article_id: 文章id（自增）
// title: 文章标题
// content: 文章内容
// user: 创建用户id
// status: 状态：0-草稿，1-已发布，2-仅自己可见
// created_at / updated_at: 时间
// 分类通过 articleandcategory_middle 多对多关联 article_category
//========================================

// 从请求头解析登录用户，失败返回 null
const getLoginUser = (req) => {
    const token = req.headers.authorization
    const decoded = tokenValidator(token)
    // tokenValidator 失败会返回字符串 '解析失败'，故需校验为对象且含 id
    if (decoded && typeof decoded === 'object' && decoded.id != null) {
        return decoded
    }
    return null
}

// ============================================================
// 契约路由（docs/blog-api.md）
// ============================================================

// 公开文章列表：分页 + 按分类 + 关键词
router.get('/article/list', async (req, res) => {
    const { page, pageSize, category_id, keyword, status, author } = req.query
    try {
        const data = await article_list({ page, pageSize, category_id, keyword, status, author })
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (error) {
        console.error('获取文章列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取文章列表失败' })
    }
})

// 归档：公开文章按时间倒序平铺（可选 username 过滤），前端按年月分组
router.get('/article/archive', async (req, res) => {
    const { username } = req.query
    try {
        const list = await article_archive(username || undefined)
        res.json({ code: 200, success: true, message: '获取成功', data: { list } })
    } catch (error) {
        console.error('获取归档文章错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取归档文章失败' })
    }
})

// 公开文章详情（含作者、分类、正文）
router.get('/article/detail/:id', async (req, res) => {
    const article_id = Number(req.params.id)
    if (!article_id) {
        return res.status(400).json({ code: 400, success: false, message: '文章id不能为空' })
    }
    try {
        const article = await article_detail(article_id)
        if (!article) {
            return res.status(404).json({ code: 404, success: false, message: '文章不存在' })
        }
        // 已发布公开可见；未发布仅作者或 admin/editor 可见
        if (article.status !== 1) {
            const user = getLoginUser(req)
            const allowed = user && (Number(article.user_id) === Number(user.id) || await isAdminOrEditor(user.id))
            if (!allowed) {
                return res.status(404).json({ code: 404, success: false, message: '文章不存在' })
            }
        }
        res.json({ code: 200, success: true, message: '获取成功', data: article })
    } catch (error) {
        console.error('查询文章详情错误:', error)
        res.status(500).json({ code: 500, success: false, message: '查询文章详情失败' })
    }
})

// 新增文章（登录）
router.post('/article/add', async (req, res) => {
    const user = getLoginUser(req)
    if (!user) {
        return res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
    }
    const { title, content, category_ids, status } = req.body
    if (!title || !content) {
        return res.status(400).json({ code: 400, success: false, message: '标题和内容不能为空' })
    }
    try {
        const article_id = await article_add({
            user_id: user.id,
            title,
            content,
            status: status === undefined ? 1 : Number(status),
            category_ids: category_ids || [],
        })
        // 正式发布(status=1)时异步生成 AI 总结（不阻塞响应）
        if (Number(status === undefined ? 1 : status) === 1) {
            const { summarizeAndSave } = require('../utils/ai_summary')
            summarizeAndSave(article_id, { title, content }).then(() => {})
        }
        res.json({ code: 200, success: true, message: '添加成功', data: { article_id } })
    } catch (error) {
        console.error('添加文章错误:', error)
        res.status(500).json({ code: 500, success: false, message: '添加文章失败' })
    }
})

// 更新文章（作者本人或 admin/editor）
router.put('/article/update/:id', async (req, res) => {
    const user = getLoginUser(req)
    if (!user) {
        return res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
    }
    const article_id = Number(req.params.id)
    if (!article_id) {
        return res.status(400).json({ code: 400, success: false, message: '文章id不能为空' })
    }
    const { title, content, category_ids, status } = req.body
    try {
        const article = await article_getById(article_id)
        if (!article) {
            return res.status(404).json({ code: 404, success: false, message: '文章不存在' })
        }
        const isOwner = Number(article.user) === Number(user.id)
        if (!isOwner && !(await isAdminOrEditor(user.id))) {
            return res.status(403).json({ code: 403, success: false, message: '无权限操作该文章' })
        }
        await article_update(article_id, {
            title,
            content,
            status: status === undefined ? undefined : Number(status),
            category_ids,
        })
        // 更新后若为正式发布，异步刷新 AI 总结
        if (Number(status === undefined ? article && article.status : status) === 1) {
            const { summarizeAndSave } = require('../utils/ai_summary')
            summarizeAndSave(article_id, { title: title ?? article.title, content: content ?? article.content }).then(() => {})
        }
        res.json({ code: 200, success: true, message: '更新成功', data: { article_id } })
    } catch (error) {
        console.error('更新文章错误:', error)
        res.status(500).json({ code: 500, success: false, message: '更新文章失败' })
    }
})

// 删除文章（作者本人或 admin/editor）
router.delete('/article/delete/:id', async (req, res) => {
    const user = getLoginUser(req)
    if (!user) {
        return res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
    }
    const article_id = Number(req.params.id)
    if (!article_id) {
        return res.status(400).json({ code: 400, success: false, message: '文章id不能为空' })
    }
    try {
        const article = await article_getById(article_id)
        if (!article) {
            return res.status(404).json({ code: 404, success: false, message: '文章不存在' })
        }
        const isOwner = Number(article.user) === Number(user.id)
        if (!isOwner && !(await isAdminOrEditor(user.id))) {
            return res.status(403).json({ code: 403, success: false, message: '无权限操作该文章' })
        }
        await article_delete(article_id)
        res.json({ code: 200, success: true, message: '删除成功', data: { article_id } })
    } catch (error) {
        console.error('删除文章错误:', error)
        res.status(500).json({ code: 500, success: false, message: '删除文章失败' })
    }
})

// 当前用户自己的文章列表（登录）
router.get('/article/mine', async (req, res) => {
    const user = getLoginUser(req)
    if (!user) {
        return res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
    }
    const { page, pageSize } = req.query
    try {
        const data = await article_mine(user.id, page, pageSize)
        res.json({ code: 200, success: true, message: '获取成功', data })
    } catch (error) {
        console.error('获取本人文章错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取本人文章失败' })
    }
})

// 全部分类（公开）
router.get('/article/category/list', async (req, res) => {
    try {
        const list = await article_category_getAll()
        res.json({ code: 200, success: true, message: '获取成功', data: { list } })
    } catch (error) {
        console.error('获取分类列表错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取分类列表失败' })
    }
})

// 新增分类（仅 admin/editor 可建，普通用户只能用现有分类）
router.post('/article/category/add', async (req, res) => {
    const user = getLoginUser(req)
    if (!user) {
        return res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
    }
    const { category_name } = req.body
    if (!category_name) {
        return res.status(400).json({ code: 400, success: false, message: '分类名称不能为空' })
    }
    try {
        if (!(await isAdminOrEditor(user.id))) {
            return res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员或编辑可创建分类' })
        }
        await article_category_add(category_name, user.id)
        res.json({ code: 200, success: true, message: '添加成功', data: { category_name } })
    } catch (error) {
        console.error('添加分类错误:', error)
        res.status(500).json({ code: 500, success: false, message: '添加分类失败' })
    }
})

// 更新分类（作者本人或 admin/editor）
router.put('/article/category/update', async (req, res) => {
    const user = getLoginUser(req)
    if (!user) {
        return res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
    }
    const { category_id, category_name } = req.body
    if (!category_id || !category_name) {
        return res.status(400).json({ code: 400, success: false, message: '分类id和分类名称不能为空' })
    }
    try {
        const category = await category_getById(category_id)
        if (!category) {
            return res.status(404).json({ code: 404, success: false, message: '分类不存在' })
        }
        const isOwner = Number(category.user) === Number(user.id)
        if (!isOwner && !(await isAdminOrEditor(user.id))) {
            return res.status(403).json({ code: 403, success: false, message: '无权限操作该分类' })
        }
        if (isOwner) {
            await article_category_update(category_id, category_name, user.id)
        } else {
            await category_updateAny(category_id, category_name)
        }
        res.json({ code: 200, success: true, message: '更新成功', data: { category_id } })
    } catch (error) {
        console.error('更新分类错误:', error)
        res.status(500).json({ code: 500, success: false, message: '更新分类失败' })
    }
})

// 删除分类（作者本人或 admin/editor）
router.delete('/article/category/delete', async (req, res) => {
    const user = getLoginUser(req)
    if (!user) {
        return res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
    }
    const { category_id } = req.body
    if (!category_id) {
        return res.status(400).json({ code: 400, success: false, message: '分类id不能为空' })
    }
    try {
        const category = await category_getById(category_id)
        if (!category) {
            return res.status(404).json({ code: 404, success: false, message: '分类不存在' })
        }
        const isOwner = Number(category.user) === Number(user.id)
        if (!isOwner && !(await isAdminOrEditor(user.id))) {
            return res.status(403).json({ code: 403, success: false, message: '无权限操作该分类' })
        }
        if (isOwner) {
            await article_category_delete(category_id, user.id)
        } else {
            await category_deleteAny(category_id)
        }
        res.json({ code: 200, success: true, message: '删除成功', data: { category_id } })
    } catch (error) {
        console.error('删除分类错误:', error)
        res.status(500).json({ code: 500, success: false, message: '删除分类失败' })
    }
})

// 手动重新生成 AI 总结（作者本人或 admin/editor）
router.post('/article/ai-summary/regenerate/:id', async (req, res) => {
    const user = getLoginUser(req)
    if (!user) {
        return res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
    }
    const article_id = Number(req.params.id)
    if (!article_id) {
        return res.status(400).json({ code: 400, success: false, message: '文章id不能为空' })
    }
    try {
        const article = await article_detail(article_id)
        if (!article) {
            return res.status(404).json({ code: 404, success: false, message: '文章不存在' })
        }
        const isOwner = Number(article.user_id) === Number(user.id)
        if (!isOwner && !(await isAdminOrEditor(user.id))) {
            return res.status(403).json({ code: 403, success: false, message: '无权限操作该文章' })
        }
        const { summarizeAndSave } = require('../utils/ai_summary')
        const result = await summarizeAndSave(article_id, { title: article.title, content: article.content })
        if (!result) {
            return res.status(500).json({ code: 500, success: false, message: 'AI 总结生成失败，请重试或检查 LLM 配置' })
        }
        res.json({ code: 200, success: true, message: 'AI 总结已生成', data: { ai_summary: result } })
    } catch (error) {
        console.error('重新生成 AI 总结错误:', error)
        res.status(500).json({ code: 500, success: false, message: '操作失败' })
    }
})

module.exports = router
