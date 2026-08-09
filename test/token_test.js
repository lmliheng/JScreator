const dotenv = require('dotenv')
const path = require('path')
dotenv.config({
    path: path.join(__dirname, '../.env')
})

const { strictEqual } = require('assert')
const { describe, it } = require('node:test')
const { tokenCreator, tokenValidator } = require('../utils/token_creator')
/**
 * @测试token生成和校验逻辑
 */
let user = {
    id: '1'
}
let token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJpYXQiOjE3ODYyODQ4NDgsImV4cCI6MTc4Njg4OTY0OH0.patkjjya_GG2izFBG1T6Z6l90L6s0qBte33RV4L4DKw'
describe('测试token生成和校验模块', () => {
    // 有时间戳的区别，同一对象的token不同时刻生成不同token
    // it('生成token', () => {
    //     strictEqual(tokenCreator(user), token)
    // }),
    it('校验token', () => {
        strictEqual(tokenValidator(token).id, user.id)
    })
})