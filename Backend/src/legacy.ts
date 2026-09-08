/**
 * 在 TS 入口中加载仓库根目录的 legacy CJS 模块（routes/*、utils/*）。
 *
 * - 模块顶层先执行 dotenv.config()：legacy 模块在 require 时才读 process.env（如连接池参数），
 *   必须保证环境变量在它们被加载前就位（ESM 静态 import 先于代码执行，故不能放在 server.ts 顶层）。
 *
 */
import { createRequire } from 'node:module';
import type { Express, Router } from 'express';
import type { Server } from 'node:http';


const require = createRequire(import.meta.url)
const dotenv = require('dotenv');
dotenv.config();

const LEGACY_ROUTES = [] as const; 

/** 挂载全部 legacy 路由：路由模块导出 Router 函数；api_key_request 等导出 { router } */
export function registerLegacyRoutes(app: Express): void {
    for (const name of LEGACY_ROUTES) {
        const mod = require(`../../routes/${name}.js`) as { router: Router } | Router;
        const r = typeof mod === 'function' ? (mod as Router) : (mod as { router: Router }).router;
        app.use(r);
    }
}

/**
 * @接口监控interface
 */
export interface ApiMonitorModule {
    recordApi: (req: unknown, res: unknown, timeMs: number) => void;
    registerRoutes: (app: Express) => void;
    getApiStats: () => Array<{ path: string; count: number; avgTime: number; errorCount: number; lastAt: number }>;
}

/**
 * 
 * @导入接口
 */
export function loadApiMonitor(): ApiMonitorModule {
    return require('../../utils/api_monitor.js') as ApiMonitorModule;
}

export interface WsServerModule {
    initWsServer: (server: Server) => void;
}

export function loadWsServer(): WsServerModule {
    return require('../../utils/ws_server.js') as WsServerModule;
}

export type TokenValidator = (token?: string) => unknown;

export function loadTokenValidator(): TokenValidator {
    const { tokenValidator } = require('../../utils/token_creator.js') as { tokenValidator: TokenValidator };
    return tokenValidator;
}

export interface CryptoPasswordModule {
    ToHash: (password: string) => string;
    ComparePassword: (password: string, hashedPassword: string) => boolean;
}

/** 密码 SHA256 哈希/比对（必须复用既有实现以兼容存量哈希） */
export function loadCryptoPassword(): CryptoPasswordModule {
    return require('../../utils/crypto_password.js') as CryptoPasswordModule;
}

export interface IdCreatorModule {
    generateId: () => number;
}

/** ID 生成器（+Date.now()，与 legacy 一致） */
export function loadIdCreator(): IdCreatorModule {
    return require('../../utils/id_creator.js') as IdCreatorModule;
}

export interface TokenCreatorModule {
    tokenCreator: (user: { id: number | string; role_id?: number | null; [key: string]: unknown }) => string;
}

/** JWT 签发（token_creator.tokenCreator） */
export function loadTokenCreator(): TokenCreatorModule {
    return require('../../utils/token_creator.js') as TokenCreatorModule;
}

export interface EmailSenderModule {
    sendVerificationCode: (to: string, code: string) => Promise<unknown>;
}

/** 邮件发送（utils/emailSender.js；SMTP 失败时内部吞错，行为与 legacy 一致） */
export function loadEmailSender(): EmailSenderModule {
    
    return require('../../utils/emailSender.js') as EmailSenderModule;
}


export interface AiSummaryUtilsModule {
    summarizeAndSave: (articleId: number, input: { title: string; content: string }) => Promise<unknown>;
}

export function loadAiSummaryUtils(): AiSummaryUtilsModule {
    
    return require('../../utils/ai_summary.js') as AiSummaryUtilsModule;
}

export interface OssUploadModule {
    uploadBuffer: (buffer: Buffer, key: string, mime: string) => Promise<string>;
}

/** OSS 上传（utils/oss/oss.js） */
export function loadOssUpload(): OssUploadModule {
    
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
    
    return require('../../utils/llm.js') as LlmChatModule;
}
