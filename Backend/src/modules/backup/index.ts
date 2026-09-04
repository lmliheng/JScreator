/**
 * modules/backup —— 数据库备份下载（GET /backup/download，admin）。
 * 逻辑对齐 legacy routes/backup_request.js：mysqldump → zip 流式返回。
 */
import { createRequire } from 'node:module';
import { Router } from 'express';
import { adminOnly, verifyToken } from '../../common/middleware/auth.js';
import type { Request, Response } from 'express';
import type { RequestHandler } from 'express';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mysqldump = require('mysqldump') as (opts: unknown) => Promise<{ dump?: { schema?: unknown; data?: unknown } } | string>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const archiver = require('archiver') as (format: string, opts: unknown) => {
    on: (event: string, cb: (err?: Error) => void) => void;
    pipe: (dest: unknown) => void;
    append: (buffer: Buffer, opts: { name: string }) => void;
    finalize: () => Promise<void>;
    destroy: (err?: Error) => void;
};

function downloadHandler(): RequestHandler {
    return async (req: Request, res: Response): Promise<void> => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actor = (req as any).user as { id?: number | string } | undefined;

        const d = new Date();
        const p = (n: number): string => String(n).padStart(2, '0');
        const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
        const dbName = process.env.DB_NAME || 'fastweb_test';
        const zipName = `${dbName}-${stamp}-dump.zip`;
        const sqlName = `${dbName}-${stamp}-dump.sql`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.on('error', (err) => {
            console.error('ZIP 打包错误:', err);
            res.destroy(err);
        });
        archive.pipe(res);

        try {
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
                disableForeignKeysCheck: true,
                lockTables: false,
                noData: false,
                tables: null,
            });
            let sql = '';
            if (result && typeof result === 'object' && result.dump) {
                const schema = typeof result.dump.schema === 'string' ? result.dump.schema : '';
                const data = typeof result.dump.data === 'string' ? result.dump.data : '';
                sql = [schema, data].filter(Boolean).join('\n');
            }
            if (!sql) {
                sql = typeof result === 'string' ? result : JSON.stringify(result);
            }
            // 字符集兼容：0900 → general_ci
            sql = sql.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_general_ci');
            // 外键兼容：每个 CREATE TABLE 前插 DROP TABLE IF EXISTS
            sql = sql.replace(/CREATE TABLE IF NOT EXISTS `([^`]+)`/g, (m: string, name: string) => {
                return 'DROP TABLE IF EXISTS `' + name + '`;\n' + m;
            });
            const head = [
                '-- JScreator 数据库备份（结构 + 数据，兼容 MySQL 5.7）',
                'SET NAMES utf8mb4;',
                'SET FOREIGN_KEY_CHECKS = 0;',
                '',
            ].join('\n');
            const tail = '\nSET FOREIGN_KEY_CHECKS = 1;\n';
            const replaced = head + sql.replace(/^--[\s\S]*?--\s*$/m, '') + tail;

            const readme = [
                'JScreator 数据库备份',
                '====================',
                `数据库：${dbName}`,
                `导出时间：${new Date().toLocaleString()}`,
                '内容：全部表结构 + 数据（兼容 MySQL 5.7，utf8mb4_general_ci）',
                '特性：先 DROP 后 CREATE（可重复导入）+ 禁用外键检查',
                '注意：含敏感数据请妥善保管。',
                '',
            ].join('\n');

            archive.append(Buffer.from(replaced, 'utf8'), { name: sqlName });
            archive.append(Buffer.from(readme, 'utf8'), { name: 'README.txt' });
            await archive.finalize();
            console.log(`[备份] admin(${actor?.id}) 下载了 ${zipName} (${(replaced.length / 1024 / 1024).toFixed(2)} MB SQL)`);
        } catch (error) {
            console.error('数据库备份导出错误:', error);
            archive.destroy(error as Error);
            res.end();
        }
    };
}

export function createBackupRouter(getRoleId: (id: number | string) => Promise<number | null>): Router {
    const r = Router();
    r.get('/backup/download', verifyToken, adminOnly(getRoleId), downloadHandler());
    return r;
}
