/**
 * P1 桥接层：在 TS 入口中加载仓库根目录的 legacy CJS 模块（routes/*、utils/*）。
 *
 * - 模块顶层先执行 dotenv.config()：legacy 模块在 require 时才读 process.env（如连接池参数），
 *   必须保证环境变量在它们被加载前就位（ESM 静态 import 先于代码执行，故不能放在 server.ts 顶层）。
 * - 挂载清单与根 server.js 保持一致（P0 后为 23 个模块）。
 * - 生命周期：P3 按域迁移后逐个移除对应 require；P5 收编 WS/api_monitor；P7 删除本文件。
 */
import { createRequire } from 'node:module';
import type { Express, Router } from 'express';
import type { Server } from 'node:http';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config();

const LEGACY_ROUTES = [] as const; // P3 完成：全部路由域已 TS 化，无 legacy 挂载（保留结构以便 P7 前应急回挂）

/** 挂载全部 legacy 路由：路由模块导出 Router 函数；api_key_request 等导出 { router } */
export function registerLegacyRoutes(app: Express): void {
    for (const name of LEGACY_ROUTES) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require(`../../routes/${name}.js`) as { router: Router } | Router;
        const r = typeof mod === 'function' ? (mod as Router) : (mod as { router: Router }).router;
        app.use(r);
    }
}

export interface ApiMonitorModule {
    recordApi: (req: unknown, res: unknown, timeMs: number) => void;
    registerRoutes: (app: Express) => void;
    getApiStats: () => Array<{ path: string; count: number; avgTime: number; errorCount: number; lastAt: number }>;
}

export function loadApiMonitor(): ApiMonitorModule {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../utils/api_monitor.js') as ApiMonitorModule;
}

export interface WsServerModule {
    initWsServer: (server: Server) => void;
}

export function loadWsServer(): WsServerModule {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../utils/ws_server.js') as WsServerModule;
}

export type TokenValidator = (token?: string) => unknown;

export function loadTokenValidator(): TokenValidator {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tokenValidator } = require('../../utils/token_creator.js') as { tokenValidator: TokenValidator };
    return tokenValidator;
}

export interface CryptoPasswordModule {
    ToHash: (password: string) => string;
    ComparePassword: (password: string, hashedPassword: string) => boolean;
}

/** 密码 SHA256 哈希/比对（必须复用既有实现以兼容存量哈希） */
export function loadCryptoPassword(): CryptoPasswordModule {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../utils/crypto_password.js') as CryptoPasswordModule;
}

export interface IdCreatorModule {
    generateId: () => number;
}

/** ID 生成器（+Date.now()，与 legacy 一致） */
export function loadIdCreator(): IdCreatorModule {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../utils/id_creator.js') as IdCreatorModule;
}

export interface TokenCreatorModule {
    tokenCreator: (user: { id: number | string; role_id?: number | null; [key: string]: unknown }) => string;
}

/** JWT 签发（token_creator.tokenCreator） */
export function loadTokenCreator(): TokenCreatorModule {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../utils/token_creator.js') as TokenCreatorModule;
}

export interface EmailSenderModule {
    sendVerificationCode: (to: string, code: string) => Promise<unknown>;
}

/** 邮件发送（utils/emailSender.js；SMTP 失败时内部吞错，行为与 legacy 一致） */
export function loadEmailSender(): EmailSenderModule {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../utils/emailSender.js') as EmailSenderModule;
}

// ============ 其余过渡桥（相应域迁移后删除） ============

export interface AiSummaryUtilsModule {
    summarizeAndSave: (articleId: number, input: { title: string; content: string }) => Promise<unknown>;
}

export function loadAiSummaryUtils(): AiSummaryUtilsModule {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../utils/ai_summary.js') as AiSummaryUtilsModule;
}

export interface OssUploadModule {
    uploadBuffer: (buffer: Buffer, key: string, mime: string) => Promise<string>;
}

/** OSS 上传（utils/oss/oss.js） */
export function loadOssUpload(): OssUploadModule {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../utils/oss/oss.js') as OssUploadModule;
}

export interface LlmChatModule {
    chat: (
        messages: Array<{ role: string; content: string }>,
        opts?: { model?: string; temperature?: number; max_tokens?: number }
    ) => Promise<string>;
}

/** LLM 对话（utils/llm.js，OpenAI 兼容协议封装） */
export function loadLlmChat(): LlmChatModule {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../utils/llm.js') as LlmChatModule;
}
