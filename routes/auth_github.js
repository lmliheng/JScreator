const express = require('express')
const router = express.Router()
const axios = require('axios')
const { user_getByGithubId, user_registerGithub } = require('../utils/db_curd')
const { tokenCreator } = require('../utils/token_creator')

const CLIENT_ID = process.env.GITHUB_CLIENT_ID
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://127.0.0.1:7000/auth/github/callback'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5173'

// GitHub 用户无密码，填一个不可逆的随机串占位（表 password 为 NOT NULL）
function randomPassword() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// 1. 跳转 GitHub 授权页（redirect 参数指定授权后回跳的前端登录页完整地址）
router.get('/auth/github', (req, res) => {
    const state = req.query.redirect || (FRONTEND_URL + '/login')
    const url =
        'https://github.com/login/oauth/authorize' +
        '?client_id=' + encodeURIComponent(CLIENT_ID) +
        '&redirect_uri=' + encodeURIComponent(CALLBACK_URL) +
        '&scope=' + encodeURIComponent('read:user user:email') +
        '&state=' + encodeURIComponent(state)
    res.redirect(url)
})

// 2. 授权回调
router.get('/auth/github/callback', async (req, res) => {
    const { code, state } = req.query
    const frontend = state || (FRONTEND_URL + '/login')
    const sep = frontend.includes('?') ? '&' : '?'

    if (!code) {
        return res.redirect(frontend + sep + 'error=github_no_code')
    }
    try {
        // 用 code 换 access_token
        const tokenRes = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code,
                redirect_uri: CALLBACK_URL,
            },
            { headers: { Accept: 'application/json' } }
        )
        const accessToken = tokenRes.data && tokenRes.data.access_token
        if (!accessToken) {
            return res.redirect(frontend + sep + 'error=github_token_failed')
        }

        // 拿 GitHub 用户信息
        const userRes = await axios.get('https://api.github.com/user', {
            headers: { Authorization: 'Bearer ' + accessToken, 'User-Agent': 'jscreator' },
        })
        const gh = userRes.data // { id, login, name, email, avatar_url }

        // 查已绑定用户，否则自动注册
        let user = await user_getByGithubId(gh.id)
        if (!user) {
            let username = String(gh.login || 'gh' + gh.id).slice(0, 50)
            try {
                await user_registerGithub({
                    github_id: gh.id,
                    username,
                    name: gh.login || null,
                    email: gh.email || null,
                    password: randomPassword(),
                    avatar: gh.avatar_url || null,
                })
            } catch (e) {
                // username 冲突时改用 gh{id}
                username = String('gh' + gh.id).slice(0, 50)
                await user_registerGithub({
                    github_id: gh.id,
                    username,
                    name: gh.login || null,
                    email: gh.email || null,
                    password: randomPassword(),
                    avatar: gh.avatar_url || null,
                })
            }
            user = await user_getByGithubId(gh.id)
            if (!user) {
                return res.redirect(frontend + sep + 'error=github_register_failed')
            }
        }

        // 签发本站 JWT，重定向回前端
        const token = tokenCreator(user)
        res.redirect(frontend + sep + 'token=' + encodeURIComponent(token) + '&username=' + encodeURIComponent(user.username))
    } catch (error) {
        console.error('GitHub 登录错误:', error.message)
        res.redirect(frontend + sep + 'error=github_login_failed')
    }
})

module.exports = router
