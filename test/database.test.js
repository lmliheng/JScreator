const dotenv = require('dotenv')
const path = require('path')
dotenv.config({
    path: path.join(__dirname, '../.env')
})
const { testConnection } = require('../utils/connect_db.js')
/**
 * @数据库测试
 * 还需要补充其他数据库
 */
console.log('你选择的数据库是', process.env.DB)
async function database_test() {
    let res = await testConnection(process.env.DB)
}