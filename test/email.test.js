const dotenv = require('dotenv')
const path = require('path')
dotenv.config({
    path: path.join(__dirname, '../.env')
})
const { strictEqual } = require('assert')
const { describe, it } = require('node:test')
const { EmailTransporter, sendMail } = require('../utils/emailSender.js')
/**
 * @邮箱模块测试
 * 1. 用他自带的verify异步方法
 * 2. 发送邮箱测试
 */
async function email_test() {
    await EmailTransporter.verify()
    let res = await sendMail(EmailTransporter, '0110230306@csu.edu.cn', '测试', '<h1>fastNodeSrever</h1>')
    console.table({
        accepted: res.accepted,
    })
}
// promise void
email_test()



