/**
 * legacy-utils/id-creator —— 时间戳 ID 生成器
 * 迁移自 root utils/id_creator.js。
 */
export function generateId(): number {
    return +Date.now();
}