const express = require('express')
const router = express.Router()
const mysqldump = require('mysqldump')
const archiver = require('archiver')
const { tokenValidator } = require('../utils/token_creator')

/**
 * 数据库备份下载（仅 admin）
 *
 * GET /backup/download
 * 用 mysqldump npm 包导出云数据库（结构与数据全量，纯 JS，alpine 可用），
 * 打成 zip（内含 .sql + 说明文件）直接流式返回浏览器下载。
 * 文件名带时间戳，如 fastweb_test-2026-08-26_230000-dump.zip
 */

const parseToken = async (token) => {
    if (!token) return null
    const decoded = await tokenValidator(token)
    if (!decoded || decoded === '解析失败' || typeof decoded !== 'object' || decoded.id == undefined) {
        return null
    }
    return decoded
}

router.get('/backup/download', async (req, res) => {
    const decoded = await parseToken(req.headers.authorization)
    if (decoded === null) {
        return res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
    }
    if (Number(decoded.role_id) !== 1) {
        return res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员可操作' })
    }

    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
    const dbName = process.env.DB_NAME || 'fastweb_test'
    const zipName = `${dbName}-${stamp}-dump.zip`
    const sqlName = `${dbName}-${stamp}-dump.sql`

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`)

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('error', (err) => {
        console.error('ZIP 打包错误:', err)
        res.destroy(err)
    })
    archive.pipe(res)

    try {
        // 导出为字符串（内存），再写入 zip
        const result = await mysqldump({
            connection: {
                host: process.env.DB_HOST || '127.0.0.1',
                port: Number(process.env.DB_PORT) || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: dbName,
                charset: 'utf8mb4',
            },
            dumpToFile: false,
            // 兼容云 MySQL 5.7：禁用 8.0 专属选项
            disableForeignKeysCheck: true,
            lockTables: false,
            noData: false,
            // 保留表结构 + 数据
            tables: null,
        })
        let sql = ''
        if (result && result.dump) {
            // 结构（schema）在前、数据（data）在后，拼接为完整 SQL
            const schema = typeof result.dump.schema === 'string' ? result.dump.schema : ''
            const data = typeof result.dump.data === 'string' ? result.dump.data : ''
            sql = [schema, data].filter(Boolean).join('\n')
        }
        if (!sql) {
            sql = typeof result === 'string' ? result : JSON.stringify(result)
        }
        // 字符集兼容：0900 → general_ci（云 MySQL 5.7 不认 0900）
        const replaced = sql.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_general_ci')

        const readme = [
            `JScreator 数据库备份`,
            `====================`,
            `数据库：${dbName}`,
            `导出时间：${new Date().toLocaleString()}`,
            `内容：全部表结构 + 数据（兼容 MySQL 5.7，utf8mb4_general_ci）`,
            `说明：导入前请确认目标库为空或可覆盖；含敏感数据请妥善保管。`,
            ``,
        ].join('\n')

        archive.append(Buffer.from(replaced, 'utf8'), { name: sqlName })
        archive.append(Buffer.from(readme, 'utf8'), { name: 'README.txt' })
        await archive.finalize()
        console.log(`[备份] admin(${decoded.id}) 下载了 ${zipName} (${(replaced.length / 1024 / 1024).toFixed(2)} MB SQL)`)
    } catch (error) {
        console.error('数据库备份导出错误:', error)
        // 流已开始，无法再改状态码；直接结束
        archive.destroy(error)
        res.end()
    }
})

module.exports = router
