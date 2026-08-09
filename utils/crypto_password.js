const crypto = require('crypto-js')
/**
 * @crypto实现的密码加密函数
 * 1. 加密
 * 2. 对比
 */

// 使用crypto-js sha256加密
const ToHash = (password) => {
    return crypto.SHA256(password).toString()
}
const ComparePassword = (password, hashedPassword) => {
    return ToHash(password) === hashedPassword
}
module.exports = { ToHash, ComparePassword }
