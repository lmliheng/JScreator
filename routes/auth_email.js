const express = require('express')
const router = express.Router()
const { sendVerificationCode } = require('../utils/emailSender')
const { user_getByEmail, user_registerEmail } = require('../utils/db_curd')
const { tokenCreator } = require('../utils/token_creator')

// 内存验证码存储：email -> { code, expireAt }
const codeStore = new Map()

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000))
}

function randomPassword() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// 1. 发送验证码
router.post('/email/send-code', async (req, res) => {
    const { email } = req.body
    if (!email) {
        return res.status(400).json({ code: 400, success: false, message: '邮箱不能为空' })
    }
    const code = generateCode()
    codeStore.set(email, { code, expireAt: Date.now() + 5 * 60 * 1000 })
    try {
        await sendVerificationCode(email, code)
        res.json({ code: 200, success: true, message: '验证码已发送，请查收邮件' })
    } catch (e) {
        console.error('发送验证码错误:', e.message)
        res.status(500).json({ code: 500, success: false, message: '验证码发送失败' })
    }
})

// 2. 验证码登录
router.post('/email/login', async (req, res) => {
    const { email, code } = req.body
    if (!email || !code) {
        return res.status(400).json({ code: 400, success: false, message: '邮箱和验证码不能为空' })
    }
    const record = codeStore.get(email)
    if (!record || String(record.code) !== String(code) || Date.now() > record.expireAt) {
        return res.status(400).json({ code: 400, success: false, message: '验证码错误或已过期' })
    }
    codeStore.delete(email)

    try {
        let user = await user_getByEmail(email)
        if (!user) {
            let username = (email.split('@')[0] || 'user').slice(0, 50)
            try {
                await user_registerEmail({ username, email, password: randomPassword() })
            } catch (e) {
                // username 冲突时用时间戳兜底
                username = ('u' + Date.now()).slice(0, 50)
                await user_registerEmail({ username, email, password: randomPassword() })
            }
            user = await user_getByEmail(email)
            if (!user) {
                return res.status(500).json({ code: 500, success: false, message: '注册失败' })
            }
        }
        const token = tokenCreator(user)
        res.json({
            code: 200,
            success: true,
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role_id: user.role_id,
                avatar: user.avatar,
                name: user.name,
            },
        })
    } catch (e) {
        console.error('邮箱登录错误:', e.message)
        res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
})

module.exports = router
