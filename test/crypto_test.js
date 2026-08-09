const { ToHash, ComparePassword } = require('../utils/crypto_password.js')
const { strictEqual } = require('assert')
const { describe, it } = require('node:test')
/**
 * @测试crypto的
 */
let password = '123456'
let hashedPassword = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
describe('测试密码加密模块', () => {
    it('加密', () => {
        strictEqual(ToHash(password), hashedPassword)
    }),
        it('对比', () => {
            strictEqual(ComparePassword(password, hashedPassword), true)
        })
})