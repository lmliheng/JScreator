/**
 * legacy-utils/crypto-password —— 密码 SHA256 哈希/比对
 * 迁移自 root utils/crypto_password.js，复用 crypto-js 保持哈希兼容。
 */
import CryptoJS from 'crypto-js';

export function ToHash(password: string): string {
    return CryptoJS.SHA256(password).toString();
}

export function ComparePassword(password: string, hashedPassword: string): boolean {
    return ToHash(password) === hashedPassword;
}