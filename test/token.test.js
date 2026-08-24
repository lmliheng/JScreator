const dotenv = require('dotenv')
const path = require('path')
dotenv.config({
    path: path.join(__dirname, '../.env')
})

const { strictEqual } = require('assert')
const { describe, it } = require('node:test')
const { tokenCreator, tokenValidator, validResultCheck } = require('../utils/token_creator')

/**
 * @测试token生成和校验逻辑
 */
let user = {
    id: '1'
}
describe('测试token生成和校验模块', () => {
    // 有时间戳的区别，同一对象的token不同时刻生成不同token
    it('校验token', () => {
        const token = tokenCreator(user)
        const decoded = tokenValidator(token)
        strictEqual(tokenValidator(token).id, user.id)
    }),
        it('校验token解析后的结果', () => {
            strictEqual(validResultCheck(user), true)
        })
})