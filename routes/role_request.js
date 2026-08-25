const express = require('express')
const router = express.Router()
const {
    role_getAll,
    role_updateName,
    role_add,
    role_delete,
    role_getById,
    role_setPermission,
    role_getPermissionByRoleId
} = require('../utils/db_curd')
const { tokenValidator } = require('../utils/token_creator')

// 手动鉴权（暂未使用统一 authMiddleware.js）
const parseToken = async (token) => {
    if (!token) return null
    const decoded = await tokenValidator(token)
    if (!decoded || decoded === '解析失败' || typeof decoded !== 'object' || decoded.id == undefined) {
        return null
    }
    return decoded
}

const requireAdmin = async (req, res) => {
    const decoded = await parseToken(req.headers.authorization)
    if (decoded === null) {
        res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
        return null
    }
    const check_role = await role_getById(decoded.id)
    if (!check_role || check_role.role_id !== 1) {
        res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员可操作' })
        return null
    }
    return decoded.id
}


// 获取所有角色
router.get('/role/list', async (req, res) => {
    try {
        const roles = await role_getAll()
        res.json({
            code: 200,
            success: true,
            message: '获取所有角色成功',
            data: { list: roles }
        })
    } catch (error) {
        console.error('获取所有角色错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 向后兼容旧路由
router.get('/role/getAll', async (req, res) => {
    try {
        const roles = await role_getAll()
        res.json({
            code: 200,
            success: true,
            message: '获取所有角色成功',
            roles,
            data: { list: roles }
        })
    } catch (error) {
        console.error('获取所有角色错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 查询某角色已有权限 id 列表
router.get('/role/permission/:id', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return
    try {
        const permission_ids = await role_getPermissionByRoleId(req.params.id)
        res.json({
            code: 200,
            success: true,
            message: '获取角色权限成功',
            data: { permission_ids }
        })
    } catch (error) {
        console.error('获取角色权限错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 给角色分配权限（整体替换）
router.post('/role/setPermission', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { role_id, permission_id_list } = req.body
    if (!role_id || !Array.isArray(permission_id_list)) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: 'role_id 与 permission_id_list(数组) 不能为空'
        })
    }
    try {
        await role_setPermission(role_id, permission_id_list)
        res.json({ code: 200, success: true, message: '分配角色权限成功' })
    } catch (error) {
        console.error('分配角色权限错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 向后兼容旧路由：/role/addPermission（permission_id_list 为逗号分隔字符串）
router.post('/role/addPermission', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { role_id, permission_id_list } = req.body
    if (!role_id || permission_id_list == null) {
        return res.status(400).json({ code: 400, success: false, message: '参数不完整' })
    }
    let list
    if (Array.isArray(permission_id_list)) {
        list = permission_id_list
    } else {
        list = String(permission_id_list).split(',').filter(Boolean)
    }
    try {
        await role_setPermission(role_id, list)
        res.json({ code: 200, success: true, message: '修改角色权限成功' })
    } catch (error) {
        console.error('修改角色权限错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 新增角色
router.post('/role/add', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { role_name } = req.body
    if (!role_name) {
        return res.status(400).json({ code: 400, success: false, message: '角色名不能为空' })
    }
    try {
        await role_add(role_name)
        res.json({ code: 200, success: true, message: '增加角色成功' })
    } catch (error) {
        console.error('增加角色错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 更新角色名
router.put('/role/update', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { role_id, role_name } = req.body
    if (!role_id || !role_name) {
        return res.status(400).json({ code: 400, success: false, message: '角色id与角色名不能为空' })
    }
    try {
        await role_updateName(role_id, role_name)
        res.json({ code: 200, success: true, message: '修改角色名成功' })
    } catch (error) {
        console.error('修改角色名错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 向后兼容旧路由
router.put('/role/updateName', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { role_id, role_name } = req.body
    if (!role_id || !role_name) {
        return res.status(400).json({ code: 400, success: false, message: '角色id与角色名不能为空' })
    }
    try {
        await role_updateName(role_id, role_name)
        res.json({ code: 200, success: true, message: '修改角色名成功' })
    } catch (error) {
        console.error('修改角色名错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 删除角色
router.delete('/role/delete', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { role_id } = req.body
    if (!role_id) {
        return res.status(400).json({ code: 400, success: false, message: '角色id不能为空' })
    }
    try {
        await role_delete(role_id)
        res.json({ code: 200, success: true, message: '删除角色成功' })
    } catch (error) {
        console.error('删除角色错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})


module.exports = router
