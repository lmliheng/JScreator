/**
 * legacy-utils/token-creator —— JWT 签发/校验
 * 迁移自 root utils/token_creator.js。
 */
import jwt from 'jsonwebtoken';

export interface TokenPayload {
    id: number | string;
    role_id?: number | null;
    [key: string]: unknown;
}

export function tokenCreator(user: TokenPayload): string {
    const token = jwt.sign(
        {
            id: user.id,
            role_id: user.role_id,
        },
        process.env.JWT_SECRET || 'test',
        { expiresIn: '7d' }
    );
    return token;
}

/**
 * Token 解析：去除 Bearer 前缀后校验。
 * 返回 decoded payload；无效返回 null。
 */
export function tokenValidator(token?: string): TokenPayload | null {
    try {
        if (typeof token === 'string' && token.startsWith('Bearer ')) {
            token = token.slice(7);
        }
        if (!process.env.JWT_SECRET) {
            console.warn('JWT_SECRET 未配置，使用默认配置：test');
        }
        const decoded = jwt.verify(token || '', process.env.JWT_SECRET || 'test');
        return decoded as TokenPayload;
    } catch {
        return null;
    }
}

export function validResultCheck(res: unknown): boolean {
    try {
        if (typeof res !== 'object' || res === null) return false;
        if ((res as { id?: unknown }).id === undefined) return false;
        return true;
    } catch {
        return false;
    }
}