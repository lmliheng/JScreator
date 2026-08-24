const dotenv = require('dotenv')
const path = require('path')
dotenv.config({
    path: path.join(__dirname, '../../.env')
})

const { client, listBuckets, put, get } = require('../utils/对象存储/oss.js')

async function test_oss() {
    await listBuckets(client)
    let get_res = await get(path.join(__dirname, './exampleobject.txt'), 'exampleobject.txt')
    let put_res = await put(path.join(__dirname, './exampleobject.txt'), 'exampleobject1.txt')
    console.table(get_res)
    console.table(put_res)
}
test_oss()