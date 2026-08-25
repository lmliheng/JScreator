const dotenv = require('dotenv')
const path = require('path')
dotenv.config({
    path: path.join(__dirname, '../../.env')
})
const OSS = require('ali-oss');

/**
 * @阿里云oss
 * 阿里云OSS文档 https://help.aliyun.com/zh/oss/developer-reference/nodejs-sdk/
 * client 懒加载：未配置 AccessKey 时后端也能正常启动，调用上传时才报明确错误
 */
let _client = null

function getClient() {
    if (_client) return _client
    const ak = process.env.OSS_ACCESS_KEY_ID
    const sk = process.env.OSS_ACCESS_KEY_SECRET
    if (!ak || !sk) {
        throw new Error('OSS 未配置：请在 .env 设置 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET')
    }
    _client = new OSS({
        accessKeyId: ak,
        accessKeySecret: sk,
        region: 'oss-cn-hangzhou',
        authorizationV4: true,
        bucket: 'fast-node-server',
        endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
    })
    return _client
}

/**
 * @列举当前账号所有地域下的存储空间
 */
async function listBuckets() {
    try {
        const client = getClient()
        const result = await client.listBuckets();
        console.table(result.buckets);
    } catch (err) {
        console.log(err);
    }
}

/**
 * @简单上传本地文件
 */
async function put(localPath, bucketPath) {
    try {
        const client = getClient()
        const result = await client.put(bucketPath, path.normalize(localPath), {
            headers: {
                'x-oss-storage-class': 'Standard',
                'x-oss-object-acl': 'public-read',
            },
        });
        return {
            upload_status: result.res.statusMessage,
            name: result.name,
            url: result.url,
        }
    } catch (e) {
        console.error('OSS 上传错误:', e);
        throw e;
    }
}

/**
 * @上传 Buffer（图片等），返回对象 URL
 * 注意：不设对象级 public-read ACL（阿里云 OSS 默认阻止公共访问），
 * 图片能否公开访问取决于 bucket 的权限策略（bucket 公共读 或 签名 URL）
 * @param {Buffer} buffer 文件内容
 * @param {string} bucketPath OSS 对象路径（不含 bucket 名）
 * @param {string} [contentType] 文件 MIME 类型
 * @returns {string} OSS 对象 URL
 */
async function uploadBuffer(buffer, bucketPath, contentType) {
    try {
        const client = getClient()
        await client.put(bucketPath, buffer, {
            headers: {
                ...(contentType ? { 'Content-Type': contentType } : {}),
            },
        });
        // 对象 URL（bucket 公共读时可直接访问，私有则需签名）
        const base = `https://${client.options.bucket}.${client.options.region}.aliyuncs.com`;
        const normalized = String(bucketPath).replace(/^\/+/, '');
        return `${base}/${normalized}`;
    } catch (e) {
        console.error('OSS Buffer 上传错误:', e);
        throw e;
    }
}

/**
 * @下载
 */
async function get(localPath, bucketPath) {
    try {
        const client = getClient()
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
    getClient,
    listBuckets,
    put,
    get,
    uploadBuffer
}
