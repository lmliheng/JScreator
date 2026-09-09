/**
 * legacy-utils/oss —— 阿里云 OSS 文件上传
 * 迁移自 root utils/oss/oss.js。
 */
// @ts-expect-error — ali-oss 无类型声明，运行时由 root utils/ 提供
import OSS from 'ali-oss';

let _client: OSS | null = null;

function getClient(): OSS {
    if (_client) return _client;
    const ak = process.env.OSS_ACCESS_KEY_ID;
    const sk = process.env.OSS_ACCESS_KEY_SECRET;
    if (!ak || !sk) {
        throw new Error('OSS 未配置：请在 .env 设置 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET');
    }
    _client = new OSS({
        accessKeyId: ak,
        accessKeySecret: sk,
        region: 'oss-cn-hangzhou',
        authorizationV4: true,
        bucket: 'fast-node-server',
        endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
    });
    return _client;
}

export { getClient };

export async function listBuckets(): Promise<void> {
    try {
        const client = getClient();
        const result = await client.listBuckets();
        console.table(result.buckets);
    } catch (err) {
        console.log(err);
    }
}

export async function put(
    localPath: string,
    bucketPath: string
): Promise<{ upload_status: string; name: string; url: string }> {
    const client = getClient();
    const result = await client.put(bucketPath, localPath, {
        headers: {
            'x-oss-storage-class': 'Standard',
            'x-oss-object-acl': 'public-read',
        },
    });
    return {
        upload_status: result.res.statusMessage,
        name: result.name,
        url: result.url,
    };
}

export async function uploadBuffer(
    buffer: Buffer,
    bucketPath: string,
    contentType?: string
): Promise<string> {
    const client = getClient();
    await client.put(bucketPath, buffer, {
        headers: {
            ...(contentType ? { 'Content-Type': contentType } : {}),
        },
    });
    const base = `https://${(client as unknown as { options: { bucket: string; region: string } }).options.bucket}.${(client as unknown as { options: { region: string } }).options.region}.aliyuncs.com`;
    const normalized = String(bucketPath).replace(/^\/+/, '');
    return `${base}/${normalized}`;
}

export async function get(
    localPath: string,
    bucketPath: string
): Promise<{ upload_status: string; bucketPath: string; localPath: string } | undefined> {
    try {
        const client = getClient();
        const result = await client.get(bucketPath, localPath);
        return {
            upload_status: result.res.statusMessage,
            bucketPath,
            localPath,
        };
    } catch (e) {
        console.log(e);
        return undefined;
    }
}