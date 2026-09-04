const express = require('express')
const router = express.Router()
const { permission_getAll, permission_update, role_getById } = require('../utils/db_curd')
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


// 获取所有权限
router.get('/permission/list', async (req, res) => {
    try {
        const permissions = await permission_getAll()
        res.json({
            code: 200,
            success: true,
            message: '获取所有权限成功',
            data: { list: permissions }
        })
    } catch (error) {
        console.error('获取所有权限错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

// 修改权限名称/描述
router.put('/permission/update', async (req, res) => {
    const admin_id = await requireAdmin(req, res)
    if (admin_id === null) return

    const { permission_id, permission_name, permission_description } = req.body
    if (!permission_id || !permission_name) {
        return res.status(400).json({
            code: 400,
            success: false,
            message: '权限id与权限名不能为空'
        })
    }
    try {
        await permission_update(permission_id, permission_name, permission_description)
        res.json({ code: 200, success: true, message: '修改权限成功' })
    } catch (error) {
        console.error('修改权限错误:', error)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})


module.exports = router
