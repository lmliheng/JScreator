/**
 * legacy 桥——从 root utils/*.js 迁移到 TS 后的统一导出层。
 *
 * 各模块通过本文件获取工具函数，不直接 import legacy-utils/*。
 * dotenv.config() 在模块顶层执行，确保所有下游模块的 process.env 就位。
 */
import dotenv from 'dotenv';
import type { Express } from 'express';
dotenv.config();

// ── crypto_password ──
import { ToHash, ComparePassword } from './legacy-utils/crypto-password.js';
export { ToHash, ComparePassword };
export interface CryptoPasswordModule {
    ToHash: (password: string) => string;
    ComparePassword: (password: string, hashedPassword: string) => boolean;
}
export function loadCryptoPassword(): CryptoPasswordModule {
    return { ToHash, ComparePassword };
}

// ── id_creator ──
import { generateId } from './legacy-utils/id-creator.js';
export { generateId };
export interface IdCreatorModule {
    generateId: () => number;
}
export function loadIdCreator(): IdCreatorModule {
    return { generateId };
}

// ── token_creator ──
import { tokenCreator, tokenValidator } from './legacy-utils/token-creator.js';
export { tokenCreator, tokenValidator };
export type { TokenPayload } from './legacy-utils/token-creator.js';
export type TokenValidator = (token?: string) => unknown;
export function loadTokenValidator(): TokenValidator {
    return tokenValidator;
}
export interface TokenCreatorModule {
    tokenCreator: (user: {
        id: number | string;
        role_id?: number | null;
        [key: string]: unknown;
    }) => string;
}
export function loadTokenCreator(): TokenCreatorModule {
    return { tokenCreator: tokenCreator as TokenCreatorModule['tokenCreator'] };
}

// ── api_monitor ──
import { recordApi, getApiStats, registerRoutes } from './legacy-utils/api-monitor.js';
export { recordApi, getApiStats, registerRoutes };
export type { ApiStatItem } from './legacy-utils/api-monitor.js';
export interface ApiMonitorModule {
    recordApi: (req: import('express').Request, res: import('express').Response, timeMs: number) => void;
    registerRoutes: (app: Express) => void;
    getApiStats: () => import('./legacy-utils/api-monitor.js').ApiStatItem[];
}
export function loadApiMonitor(): ApiMonitorModule {
    return { recordApi, getApiStats, registerRoutes };
}

// ── emailSender ──
import { sendVerificationCode, EmailTransporter } from './legacy-utils/email-sender.js';
export { sendVerificationCode, EmailTransporter };
export interface EmailSenderModule {
    sendVerificationCode: (to: string, code: string) => Promise<unknown>;
}
export function loadEmailSender(): EmailSenderModule {
    return { sendVerificationCode };
}

// ── ai_summary ──
import { summarizeAndSave } from './legacy-utils/ai-summary.js';
export { summarizeAndSave };
export interface AiSummaryUtilsModule {
    summarizeAndSave: (
        articleId: number,
        input: { title: string; content: string }
    ) => Promise<unknown>;
}
export function loadAiSummaryUtils(): AiSummaryUtilsModule {
    return { summarizeAndSave: summarizeAndSave as AiSummaryUtilsModule['summarizeAndSave'] };
}

// ── llm ──
import { chat } from './legacy-utils/llm.js';
export { chat };
export type { ChatMessage, ChatOptions } from './legacy-utils/llm.js';
export interface LlmChatModule {
    chat: (
        messages: Array<{ role: string; content: string }>,
        opts?: { model?: string; temperature?: number; max_tokens?: number }
    ) => Promise<string>;
}
export function loadLlmChat(): LlmChatModule {
    return { chat: chat as LlmChatModule['chat'] };
}

// ── oss ──
import { uploadBuffer } from './legacy-utils/oss.js';
export { uploadBuffer };
export interface OssUploadModule {
    uploadBuffer: (buffer: Buffer, key: string, mime: string) => Promise<string>;
}
export function loadOssUpload(): OssUploadModule {
    return { uploadBuffer: uploadBuffer as OssUploadModule['uploadBuffer'] };
}

// ── legacy routes（已全部迁移为 TS modules，无遗留路由） ──
export function registerLegacyRoutes(_app: Express): void {
    // 所有路由已在 buildApp() 中通过 createXxxRouter() 挂载
}