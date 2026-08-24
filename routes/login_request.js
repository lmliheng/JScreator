const express = require('express')
const router = express.Router()
const { login_loginByEmail, login_loginByUsername } = require('../utils/db_curd')
const { tokenCreator } = require('../utils/token_creator')

router.post('/sys/login', async (req, res) => {

    let login_mode = req.body.email ? 'email' : 'username'
    
    if (login_mode === 'email') {

        try {
            const { email, password } = req.body
            const user = await login_loginByEmail(email, password)
            if (user == null) {
                console.log('login.js 用户不存在或密码错误');
                return res.status(401).json({
                    code: 401,
                    success: false,
                    message: '邮箱或密码错误'
                })
            }
            const token = tokenCreator(user)
            console.log(`登录通知：用户邮箱登录', id:${user.id}, ${user.username}`);
            res.json({
                code: 200,
                success: true,
                message: '登录成功',
                token,
                user_info: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role_id: user.role_id,
                    avatar: user.avatar,
                    login_time: new Date().toLocaleString()
                }
            })

        } catch (error) {
            console.error('登录错误:', error)
            res.status(500).json({
                success: false,
                message: '服务器内部错误'
            })
        }
    }


    else if (login_mode === 'username') {

        try {
            const { username, password } = req.body
            const user = await login_loginByUsername(username, password)
            if (user == null) {
                console.log('login.js 用户不存在或密码错误');
                return res.status(401).json({
                    code: 401,
                    success: false,
                    message: '用户名或密码错误'
                })
            }
            const token = tokenCreator(user)
            console.log(`登录通知：用户用户名登录', id:${user.id}, ${user.username}`);
            res.json({
                code: 200,
                success: true,
                message: '登录成功',
                token,
                user_info: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role_id: user.role_id,
                    avatar: user.avatar,
                    bio: user.bio,
                    area: user.area,
                    name: user.name,
                    vipLevel: user.name,
                    checkinDay: user.checkinDay,
                    login_time: new Date().toLocaleString()
                }
            })
        } catch (error) {
            console.error('登录错误:', error)
            res.json({
                code: 500,
                success: false,
                message: '登录失败'
            })
        }
    }

})





module.exports = router
