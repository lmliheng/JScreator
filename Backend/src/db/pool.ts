/**
 * db/pool：TS 侧 mysql2 连接池（参数与 legacy utils/connect_db.js 一致）。
 * 本模块先加载 dotenv（幂等），保证 createPool 时 DB 环境变量已就位。
 * 说明：迁移期 TS 域与 legacy 域各持一个连接池，指向同一数据库；P7 收敛为单池。
 */
import { createRequire } from 'node:module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mysql = require('mysql2/promise');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pool: any = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 20,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
});
