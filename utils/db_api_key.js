const crypto = require('crypto')
const { pool } = require('./connect_db')

/**
 * 外部 API Key 数据层
 * 表：api_key（user_id/name/key_hash/key_prefix/scopes/status/last_used_at）
 * 安全：数据库只存 SHA256 哈希 + 明文前缀；明文只在生成时返回一次。
 */

// 生成随机明文 key：sk_ + 32 位随机（hex），不可逆推
function generatePlainKey() {
    return 'sk_' + crypto.randomBytes(24).toString('hex')
}

// 哈希（存储/校验用）
function hashKey(plain) {
    return crypto.createHash('sha256').update(plain).digest('hex')
}

// 明文前缀（只取前 10 字符供后台展示识别，不泄露完整 key）
function prefixOf(plain) {
    return plain.slice(0, 10)
}

// 创建 key，返回一次明文（调用方展示后即弃）
const apiKeyCreate = async (userId, name, scopes = 'read') => {
    const plain = generatePlainKey()
    const keyHash = hashKey(plain)
    const keyPrefix = prefixOf(plain)
    await pool.query(
        'INSERT INTO api_key (user_id, name, key_hash, key_prefix, scopes) VALUES (?, ?, ?, ?, ?)',
        [userId, name || '未命名', keyHash, keyPrefix, scopes]
    )
    return { plain, keyPrefix, scopes }
}

// 按 id 查 key（本人/管理）
const apiKeyGetById = async (id) => {
    const [rows] = await pool.query(
        'SELECT id, user_id, name, key_prefix, scopes, status, last_used_at, created_at FROM api_key WHERE id = ?',
        [id]
    )
    return rows[0] || null
}

// 某用户的 key 列表
const apiKeyListByUser = async (userId) => {
    const [rows] = await pool.query(
        `SELECT id, name, key_prefix, scopes, status, last_used_at, created_at
         FROM api_key WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
    )
    return rows
}

// 启停
const apiKeySetStatus = async (id, userId, status) => {
    await pool.query('UPDATE api_key SET status = ? WHERE id = ? AND user_id = ?', [Number(status) ? 1 : 0, id, userId])
}

// 删除
const apiKeyDelete = async (id, userId) => {
    await pool.query('DELETE FROM api_key WHERE id = ? AND user_id = ?', [id, userId])
}

// 按明文校验：返回 { user_id, scopes } 或 null（校验通过时顺带更新时间戳）
const apiKeyVerify = async (plain) => {
    if (!plain || !plain.startsWith('sk_')) return null
    const keyHash = hashKey(plain)
    const [rows] = await pool.query(
        'SELECT id, user_id, scopes, status FROM api_key WHERE key_hash = ? LIMIT 1',
        [keyHash]
    )
    const row = rows[0]
    if (!row || Number(row.status) !== 1) return null
    // 异步更新时间戳，不阻塞
    pool.query('UPDATE api_key SET last_used_at = NOW() WHERE id = ?', [row.id]).catch(() => {})
    return { user_id: Number(row.user_id), scopes: String(row.scopes || 'read') }
}

module.exports = {
    generatePlainKey,
    apiKeyCreate,
    apiKeyGetById,
    apiKeyListByUser,
    apiKeySetStatus,
    apiKeyDelete,
    apiKeyVerify,
}
