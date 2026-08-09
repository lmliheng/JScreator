const dotenv = require('dotenv')
const path = require('path')
dotenv.config({
    path: path.join(__dirname, '../.env')
})
const { callDeepSeek } = require('../utils/LLM_Client/ds')
const { messageAdd, messageCreate } = require('../utils/LLM_Client/messageTools')

/**
 * @LLM 
 * 用于测试你的API key是否生效
 */
let question = '你好,用15个字描述 transformer 重点'
let messages = messageCreate(question)

async function llm_test() {
    let res1 = await callDeepSeek(messages)
    console.log('Deepseek:', res1.message.content)
}
llm_test()


