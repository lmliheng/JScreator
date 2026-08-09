const dotenv = require('dotenv')
const path = require('path')
dotenv.config({
    path: path.join(__dirname, '../../.env')
})
const OSS = require('ali-oss');

/**
 * @阿里云oss
 * 阿里云OSS文档 https://help.aliyun.com/zh/oss/developer-reference/nodejs-sdk/
 */
const client = new OSS({
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    region: 'oss-cn-hangzhou',
    authorizationV4: true,
    bucket: 'fast-node-server',
    endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
});


/**
 * @列举当前账号所有地域下的存储空间
 */
async function listBuckets(client) {
    try {
        const result = await client.listBuckets();
        console.table(result.buckets);
    } catch (err) {
        console.log(err);
    }
}

// 自定义请求头
const headers = {
    'x-oss-storage-class': 'Standard',
    // 指定Object的访问权限。
    'x-oss-object-acl': 'private',
    // 通过文件URL访问文件时，指定以附件形式下载文件，下载后的文件名称定义为example.txt。
    'Content-Disposition': 'attachment; filename="example.txt"',
    // 设置Object的标签，可同时设置多个标签。
    'x-oss-tagging': 'Tag1=1&Tag2=2',
    // 指定PutObject操作时是否覆盖同名目标Object。设置为true表示禁止覆盖同名Object。
    'x-oss-forbid-overwrite': 'false',
};


/**
 * @简单上传文件
 * 补充：分片上传，流式上传，...
 * 
 */
async function put(localPath, bucketPath) {
    try {
        // 填写OSS文件完整路径和本地文件的完整路径。OSS文件完整路径中不能包含Bucket名称。
        // 如果本地文件的完整路径中未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
        const result = await client.put(bucketPath, path.normalize(localPath)
            , { headers }
        );
        return {
            upload_status: result.res.statusMessage,
            name: result.name,
            url: result.url,
        }
    } catch (e) {
        console.log(e);
    }
}

/**
 * @下载
 */
async function get(localPath, bucketPath) {
    try {
        const result = await client.get(bucketPath, localPath);
        return {
            upload_status: result.res.statusMessage,
            bucketPath: bucketPath,
            localPath: localPath
        }
    } catch (e) {
        console.log(e);
    }
}


module.exports = {
    client,
    listBuckets,
    put,
    get
}
