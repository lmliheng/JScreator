/**
 * @常量
 * 看看后续放到环境变量里
 */

// #服务
// PORT=7000
// DUMP_BASELINE=

// #数据库MySQL8.0
// DB_HOST=127.0.0.1
// DB_PORT=3306
// DB_USER=root
// DB_PASSWORD=
// DB_NAME=js

// #JWT
// JWT_SECRET=

// #邮件 (SMTP)
// SMTP_HOST=smtp.126.com
// SMTP_PORT=465
// SMTP_SECURE=true
// SMTP_USER=liheng2137@126.com
// SMTP_PASS=
// FROM_EMAIL=liheng2137@126.com

// #GitHub OAuth
// GITHUB_CLIENT_ID=
// GITHUB_CLIENT_SECRET=
// GITHUB_CALLBACK_URL=

// #前端白名单:逗号隔开,可以有两侧空格
// FRONTEND_URL=http://127.0.0.1:5173,http://127.0.0.1:8085

// #OSS 对象存储
// OSS_ACCESS_KEY_ID=LTAI5t6JcEKUcTtyf25jFam4
// OSS_ACCESS_KEY_SECRET=

// #DeepSeek LLM
// DEEPSEEK_API_KEY=
// DEEPSEEK_BASE_URL=https://api.deepseek.com
// DEEPSEEK_MODEL=deepseek-chat

// #自定义
// APP_SECRET=liheng_app

export const ALLOWED_ORIGINS: readonly string[] = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:8085',
    'http://localhost:8085',
    'https://prod-3gqvgr0c0ffdcde1-1324237338.tcloudbaseapp.com',
];

export const DEFAULT_PORT = 7000;
