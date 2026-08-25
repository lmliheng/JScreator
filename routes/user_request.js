const express = require('express')
const {
    getUserInfoByToken,
    user_updatePassword,
    user_getAll,
    user_getAllByPage,
    user_update,
    user_updateProfile,
    user_add,
    user_delete,
    user_deleteBatch,
    user_getById,
    user_getPasswordById,
    register_checkExistByEmail,
    register_checkExistByUsername,
    role_getById
} = require('../utils/db_curd')
const { tokenValidator } = require('../utils/token_creator')
const { ToHash } = require('../utils/crypto_password')

const router = express.Router()

/**
 * 手动鉴权辅助（暂未使用统一 authMiddleware.js）
 * 1. requireLogin：解析 token，返回用户 id；失败返回 401 并响应。
 * 2. requireAdmin：在 requireLogin 基础上校验 role_id === 1（管理员），否则 403。
 */
const parseToken = async (token) => {
    if (!token) return null
    const decoded = await tokenValidator(token)
    // tokenValidator 成功返回对象，失败返回字符串 '解析失败'
    if (!decoded || decoded === '解析失败' || typeof decoded !== 'object' || decoded.id == undefined) {
        return null
    }
    return decoded
}

const requireLogin = async (req, res) => {
    const decoded = await parseToken(req.headers.authorization)
    if (decoded === null) {
        res.status(401).json({
            code: 401,
            success: false,
            message: '未登录或登录过期'
        })
        return null
    }
    return decoded.id
}

const requireAdmin = async (req, res) => {
    const decoded = await parseToken(req.headers.authorization)
    if (decoded === null) {
        res.status(401).json({
            code: 401,
            success: false,
            message: '未登录或登录过期'
        })
        return null
    }
    const check_role = await role_getById(decoded.id)
    if (!check_role || check_role.role_id !== 1) {
        res.status(403).json({
            code: 403,
            success: false,
            message: '权限不足，仅管理员可操作'
        })
        return null
    }
    return decoded.id
}


/**
 * @获取用户信息
 */
router.get('/sys/profile', async (req, res) => {
    try {
        const token = req.headers.authorization
        const user_info = await getUserInfoByToken(token)
        if (user_info === null) {
            return res.json({
                code: 401,
                success: false,
                message: '找不到用户信息，是否未登录或登录过期'
            })
        }
        if (user_info === 'db_error') {
            return res.json({
                code: 500,
                success: false,
                message: '数据库服务错误'
            })
        }

        const user_permission = user_info.map(
            item => {
                return { permission_name: item.permission_name, permission_id: item.permission_id }
            })

        const user_detail = user_info[0]
        delete user_detail.permission_name
        delete user_detail.permission_id

        res.json({
            code: 200,
            success: true,
            message: '获取用户信息成功',
            user_info: {
                user_detail,
                user_permission,
                login_time: new Date().toLocaleString()
            }
        })
    } catch (error) {
        console.error('获取用户信息错误:', error)
        res.json({
            code: 500,
            success: false,
            message: '获取用户信息失败'
        })
    }
})

// 更新用户基本信息（本人，id/username/email）
router.put('/userInfo', async (req, res) => {
    const { id, username, email, bio, vip, checkinDay, name, area, avatar } = req.body
    if (!id) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '用户id不能为空'
        })
    }
    try {
        await user_updateProfile(id, { username, email, bio, vip, checkinDay, name, area, avatar })
        res.json({
            code: 200,
            success: true,
            message: '更新用户信息成功'
        })
    } catch (error) {
        console.error('更新用户信息错误:', error)
        res.status(500).json({
            code: 500,
            success: false,
            message: '服务器内部错误'
        })
    }
})

// 重置本人密码
router.post('/resetPassword', async (req, res) => {
    const user_id = await requireLogin(req, res)
    if (user_id === null) return

    const { password } = req.body
    if (!password) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '密码不能为空'
        })
    }
    try {
        await user_updatePassword(user_id, password)
        res.json({
            code: 200,
            success: true,
            message: '重置用户密码成功'
        })
    } catch (error) {
        console.error('重置用户密码错误:', error)
        res.status(500).json({
            code: 500,
            success: false,
            message: '服务器内部错误'
        })
    }
})


// ============ 用户管理（管理员） ============

// 获取用户列表（真分页：支持 page / pageSize，向后兼容不传参时走默认分页）
router.get('/user-manage/list', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    try {
        const page = parseInt(req.query.page, 10) || 1
        const pageSize = parseInt(req.query.pageSize || req.query.page_size, 10) || 10
        const keyword = (req.query.keyword || '').trim()
        const result = await user_getAllByPage(page, pageSize, keyword)
        res.json({
            code: 200,
            success: true,
            message: '获取用户列表成功',
            data: {
                list: result.list,
                total: result.total,
                page: result.page,
                pageSize: result.pageSize,
                size: result.list.length
            }
        })
    } catch (error) {
        console.error('获取用户列表错误:', error)
        res.status(500).json({
            code: 500,
            success: false,
            message: '服务器内部错误'
        })
    }
})

// 获取单个用户详情
router.get('/user-manage/detail/:id', async (req, res) => {
    const login_id = await requireLogin(req, res)
    if (login_id === null) return

    const id = req.params.id
    try {
        const user = await user_getById(id)
        if (!user) {
            return res.status(404).json({
                code: 404,
                success: false,
                message: '用户不存在'
            })
        }
        res.json({
            code: 200,
            success: true,
            message: '获取用户详情成功',
            data: user
        })
    } catch (error) {
        console.error('获取用户详情错误:', error)
        res.status(500).json({
            code: 500,
            success: false,
            message: '服务器内部错误'
        })
    }
})

// 新增用户
router.post('/user-manage/add', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { username, email, password, role_id } = req.body
    if (!username || !email || !password) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '用户名、邮箱、密码不能为空'
        })
    }
    try {
        if (await register_checkExistByEmail(email)) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: '邮箱已存在'
            })
        }
        if (await register_checkExistByUsername(username)) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: '用户名已存在'
            })
        }
        const hashedPassword = await ToHash(password)
        const newId = await user_add(username, email, hashedPassword, role_id)
        res.json({
            code: 200,
            success: true,
            message: '新增用户成功',
            data: { id: newId }
        })
    } catch (error) {
        console.error('新增用户错误:', error)
        res.status(500).json({
            code: 500,
            success: false,
            message: '服务器内部错误'
        })
    }
})

// 更新用户（用户名/邮箱/角色/简介/vip/签到天数/姓名/地区）
router.put('/user-manage/update', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { id, username, email, role_id, bio, vip, checkinDay, name, area, avatar } = req.body
    if (!id) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '用户id不能为空'
        })
    }
    try {
        const updated = await user_updateProfile(id, { username, email, role_id, bio, vip, checkinDay, name, area, avatar })
        if (updated === false) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: '没有需要更新的字段'
            })
        }
        res.json({
            code: 200,
            success: true,
            message: '更新用户成功'
        })
    } catch (error) {
        console.error('更新用户错误:', error)
        res.status(500).json({
            code: 500,
            success: false,
            message: '服务器内部错误'
        })
    }
})

// 重置用户密码（仅管理员，输入新密码）
router.put('/user-manage/reset-password', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { id, password } = req.body
    if (!id || !password) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '用户id和新密码不能为空'
        })
    }
    try {
        await user_updatePassword(id, password)
        res.json({
            code: 200,
            success: true,
            message: '重置密码成功'
        })
    } catch (error) {
        console.error('重置密码错误:', error)
        res.status(500).json({
            code: 500,
            success: false,
            message: '服务器内部错误'
        })
    }
})

// 删除用户
router.delete('/user-manage/delete', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { id } = req.body
    if (!id) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '用户id不能为空'
        })
    }
    try {
        await user_delete(id)
        res.json({
            code: 200,
            success: true,
            message: '删除用户成功'
        })
    } catch (error) {
        console.error('删除用户错误:', error)
        res.status(500).json({
            code: 500,
            success: false,
            message: '服务器内部错误'
        })
    }
})

// 批量删除用户（仅管理员）
router.post('/user-manage/delete-batch', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '请选择要删除的用户'
        })
    }
    try {
        // 防止删除自己
        const filtered = ids.filter(id => Number(id) !== Number(admin_id))
        if (filtered.length === 0) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: '不能删除自己'
            })
        }
        const affected = await user_deleteBatch(filtered)
        res.json({
            code: 200,
            success: true,
            message: `已删除 ${affected} 个用户`
        })
    } catch (error) {
        console.error('批量删除用户错误:', error)
        res.status(500).json({
            code: 500,
            success: false,
            message: '服务器内部错误'
        })
    }
})


module.exports = router
