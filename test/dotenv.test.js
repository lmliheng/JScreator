const dotenv = require('dotenv')
const path = require('path')
const { strictEqual } = require('assert')
const { describe, it } = require('node:test')
/**
 * @dotenv
 * 测试环境变量
 * 全局env直接使用dotenv.config()
 */
dotenv.config(
    {
        path: path.join(__dirname, './.env')
    }
)
describe('测试环境变量', () => {
    it('读取本文件目录下env', () => {
        strictEqual(process.env.TEST, '测试dotenv')
    })
})