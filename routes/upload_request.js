const express = require('express')
const router = express.Router()
const multer = require('multer')
const { tokenValidator } = require('../utils/token_creator')
const { uploadBuffer } = require('../utils/oss/oss')

// 图片上传：内存存储，单文件 ≤ 5MB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
})

// 允许的图片类型 → 扩展名
const ALLOWED = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
}

/**
 * 上传图片（登录用户）
 * multipart/form-data，字段名 image
 * 成功返回 { url }，图片存阿里 OSS 公共读
 */
router.post('/upload/image', upload.single('image'), async (req, res) => {
    const token = req.headers.authorization
    const decoded = tokenValidator(token)
    if (!decoded || typeof decoded !== 'object' || decoded.id === undefined) {
        return res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
    }
    if (!req.file) {
        return res.status(400).json({ code: 400, success: false, message: '请选择图片文件' })
    }
    const ext = ALLOWED[req.file.mimetype]
    if (!ext) {
        return res.status(400).json({ code: 400, success: false, message: '仅支持 jpg/png/webp/gif 图片' })
    }
    try {
        const now = new Date()
        const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
        const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
        const url = await uploadBuffer(req.file.buffer, `uploads/${ymd}/${name}`, req.file.mimetype)
        res.json({ code: 200, success: true, message: '上传成功', data: { url } })
    } catch (error) {
        console.error('上传图片错误:', error)
        res.status(500).json({ code: 500, success: false, message: '上传失败，请检查 OSS 配置' })
    }
})

// multer 错误（文件过大等）统一处理
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ code: 400, success: false, message: '图片不能超过 5MB' })
        }
        return res.status(400).json({ code: 400, success: false, message: '上传出错：' + err.message })
    }
    next(err)
})

module.exports = router
