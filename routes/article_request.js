const express = require('express')
const router = express.Router()
const { tokenValidator } = require('../utils/token_creator')

// 复用 db_curd.js 已有函数（不修改 db_curd.js）
const {
    article_getDetail,            // 遗留：GET /article/detail（query 版）
    article_getByUserId,          // 遗留：鉴权（作者本人）检查
    category_getByUserId,         // 遗留：分类归属检查
    article_category_set,         // 遗留：给文章设置分类
    article_category_getAllByArticleId, // 遗留：查询文章分类
    article_getByCategoryIdByPage, // 遗留：按分类分页
    article_getAllByUserId,       // 遗留：本用户所有文章
    article_getAllByPage,         // 遗留：本用户文章分页
    article_deleteById,           // 遗留：删除本人文章
    article_postEdit,             // 遗留：更新本人文章
    article_category_getAll,      // 复用：全部分类
    article_category_add,         // 复用：新增分类
    article_category_update,      // 复用：更新本人分类
    article_category_delete,      // 复用：删除本人分类
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

// 新增分类（登录，作者自己的分类）
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

// ============================================================
// 以下为遗留路由（保持原有行为，未做改动）
// ============================================================

// 查询本用户文章列表
router.get('/article/getAll', async (req, res) => {
    const token = req.headers.Authorization
    const decoded = tokenValidator(token)
    if (!decoded) {
        return res.status(401).json({
            code: 401,
            success: false,
            message: '未授权'
        })
    }
    const user_id = decoded.id

    try {
        const articleList = await article_getAllByUserId(user_id)
        res.json({
            code: 200,
            success: true,
            message: '获取成功',
            articleList: articleList
        })
    } catch (error) {
        console.error('获取文章列表错误:', error)
        return res.status(500).send('获取文章列表失败', error.message)
    }
})

// 页码分页查询本用户所有文章
router.get('/article/getAllByPage', async (req, res) => {
    const { page, page_size } = req.query
    if (!page || !page_size) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '页码和每页数量不能为空'
        })
    }
    const token = req.headers.authorization
    const decoded = tokenValidator(token)
    if (!decoded) {
        return res.status(401).json({
            code: 401,
            success: false,
            message: '未授权'
        })
    }
    const user_id = decoded.id
    try {
        const { total, articleList } = await article_getAllByPage(user_id, page, page_size)
        res.json({
            code: 200,
            success: true,
            message: '获取成功',
            data: {
                total: total,
                articleList: articleList
            },
        })
    } catch (error) {
        console.error('获取文章列表错误:', error)
        return res.status(500).send('获取文章列表失败', error.message)
    }
})

// 页码分页查询本用户下某分类下的文章
router.get('/article/getSomeByPageAndCategory', async (req, res) => {
    const { page, page_size, category_id } = req.query
    if (!page || !page_size || !category_id) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '页码、每页数量、分类id不能为空'
        })
    }
    const token = req.headers.authorization
    const decoded = tokenValidator(token)
    if (!decoded) {
        return res.status(401).json({
            code: 401,
            success: false,
            message: '未授权'
        })
    }
    const user_id = decoded.id
    try {
        const { total, articleList } = await article_getByCategoryIdByPage(user_id, category_id, page, page_size)
        res.json({
            code: 200,
            success: true,
            message: '获取成功',
            data: {
                total: total,
                articleList: articleList
            },
        })
    } catch (error) {
        console.error('获取文章列表错误:', error)
        return res.status(500).send('获取文章列表失败', error.message)
    }
})

// 查询公开文章详情（query 版，遗留）
router.get('/article/detail', async (req, res) => {
    const { article_id } = req.query
    if (!article_id) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '文章id不能为空'
        })
    }
    try {
        const searchResult = await article_getDetail(article_id)
        if (searchResult === null) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: '文章不存在'
            })
        } else if (searchResult.status !== 1) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: '文章不是公开的'
            })
        } else {
            res.json({
                code: 200,
                success: true,
                message: '获取成功',
                article: searchResult
            })
        }
    } catch (error) {
        console.error('查询文章详情错误:', error)
        return res.status(500).send('查询文章详情失败', error.message)
    }
})

// 查询公开文章分类（遗留）
router.get('/article_category/getAll', async (req, res) => {
    const { article_id } = req.body
    try {
        const categoryList = await article_category_getAllByArticleId(article_id)
        res.json({
            code: 200,
            success: true,
            message: '获取成功',
            categoryList: categoryList
        })
    } catch (error) {
        console.error('查询文章分类错误:', error)
        return res.status(500).send('查询文章分类失败', error.message)
    }
})

// 更新文章（遗留：body 传 id）
router.put('/article/update', async (req, res) => {
    const { id, title, content, cart_id, cart_name } = req.body
    if (!id || !title || !content || !cart_id || !cart_name) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '文章id、标题、内容、分类id、分类名称不能为空'
        })
    }
    const token = req.headers.authorization
    const decoded = tokenValidator(token)
    if (!decoded) {
        return res.status(401).json({
            code: 401,
            success: false,
            message: '未授权'
        })
    }
    const user_id = decoded.id
    try {
        const checkArticle = await article_getByUserId(id, user_id)
        if (!checkArticle) {
            return res.status(404).json({
                code: 404,
                success: false,
                message: '本用户的某文章不存在或者不属于用户自己'
            })
        }
        const article = await article_postEdit(id, title, content, cart_id, cart_name, user_id)
        res.json({
            code: 200,
            success: true,
            message: '更新成功',
            article: article
        })
    } catch (error) {
        console.error('更新文章错误:', error)
        return res.status(500).send('更新文章失败', error.message)
    }
})

// 删除文章（遗留：body 传 article_id）
router.delete('/article/delete', async (req, res) => {
    const token = req.headers.authorization
    const { article_id } = req.body
    if (!article_id) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '文章id不能为空'
        })
    }
    const decoded = tokenValidator(token)
    if (!decoded) {
        return res.status(401).json({
            code: 401,
            success: false,
            message: '未授权'
        })
    }
    const user_id = decoded.id
    try {
        const checkArticle = await article_getByUserId(article_id, user_id)
        if (!checkArticle) {
            return res.status(404).json({
                code: 404,
                success: false,
                message: '本用户的某文章不存在或者不属于用户自己'
            })
        }
        const article = await article_deleteById(article_id, user_id)
        res.json({
            code: 200,
            success: true,
            message: '删除成功',
            article: article
        })
    } catch (error) {
        console.error('删除文章错误:', error)
        return res.status(500).send('删除文章失败', error.message)
    }
})

// 给文章设置分类（遗留）
router.post('/article_category/set', async (req, res) => {
    const { article_id, category_id } = req.body
    if (!article_id || !category_id) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '文章id、分类id不能为空'
        })
    }
    const token = req.headers.authorization
    const decoded = tokenValidator(token)
    if (!decoded) {
        return res.status(401).json({
            code: 401,
            success: false,
            message: '未授权'
        })
    }
    const user_id = decoded.id

    const checkArticle = await article_getByUserId(article_id, user_id)
    if (!checkArticle) {
        return res.status(404).json({
            code: 404,
            success: false,
            message: '本用户的某文章不存在或者不属于用户自己'
        })
    }
    const checkCategory = await category_getByUserId(category_id, user_id)
    if (!checkCategory) {
        return res.status(404).json({
            code: 404,
            success: false,
            message: '分类不存在'
        })
    }

    try {
        const article_category = await article_category_set(article_id, category_id, user_id)
        res.json({
            code: 200,
            success: true,
            message: '设置成功',
            article_category: article_category
        })
    } catch (error) {
        console.error('设置文章分类错误:', error)
        return res.status(500).send('设置文章分类失败', error.message)
    }
})

module.exports = router
