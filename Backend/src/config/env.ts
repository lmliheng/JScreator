/**
 * 环境常量（与根 server.js 保持一致；后续迁移把敏感配置收敛到 config 时再引入 zod 校验）
 */
export const ALLOWED_ORIGINS: readonly string[] = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:8085',
    'http://localhost:8085',
    'https://prod-3gqvgr0c0ffdcde1-1324237338.tcloudbaseapp.com',
];

export const DEFAULT_PORT = 7000;
