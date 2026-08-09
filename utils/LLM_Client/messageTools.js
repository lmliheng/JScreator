/**
 * @messages格式创建工具
 * 
 */

const { mode } = require("crypto-js")

/**
 * @单轮对话message格式初始化
 * 这个函数可以不用，作参考意义
 */
function messageCreate(message, role = 'user') {
    return [
        { "role": `${role}`, "content": `${message}` }
    ]
}
/**
 * @多轮对话message增加
 */
function messageAdd(messageArray, message, role) {
    messageArray.push({ "role": `${role}`, "content": `${message}` })
    return messageArray
}

module.exports = {
    messageCreate,
    messageAdd
}