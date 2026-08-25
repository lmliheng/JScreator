import http from './http'

// 登录：后端按是否存在 email 字段区分邮箱/用户名登录。
// 前端按账号是否含 "@" 判断，传对应字段即可。
export function login(account, password) {
  const payload = account.includes('@')
    ? { email: account, password }
    : { username: account, password }
  return http.post('/sys/login', payload).then((res) => ({
    token: res.token,
    user: res.user_info,
  }))
}

export function register({ username, email, password }) {
  return http.post('/sys/register', { username, email, password }).then((res) => ({
    token: res.token,
    user: res.user_info,
  }))
}

// 更新本人资料（name / bio / area 等）
export function updateProfile(data) {
  return http.put('/userInfo', data).then((res) => res)
}

// 发送邮箱验证码
export function sendEmailCode(email) {
  return http.post('/email/send-code', { email }).then((res) => res)
}

// 邮箱验证码登录
export function emailLogin(email, code) {
  return http.post('/email/login', { email, code }).then((res) => ({
    token: res.token,
    user: res.user,
  }))
}
