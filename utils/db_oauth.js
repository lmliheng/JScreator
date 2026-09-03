const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { pool } = require('./connect_db')

/**
 * OAuth 2.0 授权服务器工具
 * 支持：授权码 + PKCE、Client Credentials
 * Token 用 JWT 签发（HS256），可与站点 JWT 体系区分受众。
 */

// ===== 客户端管理 =====

function randomClientId() {
    return 'oa_' + crypto.randomBytes(16).toString('hex')
}
function randomClientSecret() {
    return crypto.randomBytes(24).toString('hex')
}
function randomAuthCode() {
    return crypto.randomBytes(24).toString('hex')
}

const oauthClientCreate = async (data) => {
    const clientId = randomClientId()
    const clientSecret = data.grant_types && data.grant_types.includes('client_credentials')
        ? randomClientSecret()
        : null
    const [result] = await pool.query(
        `INSERT INTO oauth_client (client_id, client_secret, name, description, redirect_uris, scopes, grant_types, logo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            clientId,
            clientSecret,
            data.name,
            data.description || '',
            Array.isArray(data.redirect_uris) ? data.redirect_uris.join(',') : (data.redirect_uris || ''),
            data.scopes || 'read',
            data.grant_types || 'authorization_code,client_credentials',
            data.logo || '',
        ]
    )
    return { id: result.insertId, client_id: clientId, client_secret: clientSecret }
}

const oauthClientUpdate = async (id, data) => {
    await pool.query(
        `UPDATE oauth_client
         SET name = ?, description = ?, redirect_uris = ?, scopes = ?, grant_types = ?, logo = ?
         WHERE id = ?`,
        [
            data.name,
            data.description || '',
            Array.isArray(data.redirect_uris) ? data.redirect_uris.join(',') : (data.redirect_uris || ''),
            data.scopes || 'read',
            data.grant_types || 'authorization_code,client_credentials',
            data.logo || '',
            id,
        ]
    )
}

const oauthClientList = async () => {
    const [rows] = await pool.query(
        `SELECT id, client_id, name, description, redirect_uris, scopes, grant_types, logo, status, created_at
         FROM oauth_client ORDER BY created_at DESC`
    )
    return rows.map((r) => ({ ...r, client_secret_hidden: true }))
}

const oauthClientGetByClientId = async (clientId) => {
    const [rows] = await pool.query('SELECT * FROM oauth_client WHERE client_id = ? LIMIT 1', [clientId])
    return rows[0] || null
}

const oauthClientSetStatus = async (id, status) => {
    await pool.query('UPDATE oauth_client SET status = ? WHERE id = ?', [Number(status) ? 1 : 0, id])
}

const oauthClientDelete = async (id) => {
    await pool.query('DELETE FROM oauth_client WHERE id = ?', [id])
}

// ===== 授权码 =====

const oauthCodeCreate = async (clientId, userId, scope, challenge, redirectUri, ttlMs = 10 * 60 * 1000) => {
    const code = randomAuthCode()
    const expiresAt = new Date(Date.now() + ttlMs)
    await pool.query(
        `INSERT INTO oauth_code (code, client_id, user_id, scope, code_challenge, redirect_uri, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [code, clientId, userId, scope || 'read', challenge || null, redirectUri || null, expiresAt]
    )
    return code
}

const oauthCodeConsume = async (code) => {
    const [rows] = await pool.query('SELECT * FROM oauth_code WHERE code = ? LIMIT 1', [code])
    const rec = rows[0]
    if (!rec) return null
    if (Number(rec.used) === 1) return { error: 'invalid_grant', message: '授权码已使用' }
    if (new Date(rec.expires_at).getTime() < Date.now()) return { error: 'invalid_grant', message: '授权码已过期' }
    await pool.query('UPDATE oauth_code SET used = 1 WHERE id = ?', [rec.id])
    return { code: rec }
}

// ===== PKCE 校验 =====

// challenge 校验：code_verifier → S256 challenge 对比
function pkceVerify(codeVerifier, codeChallenge, method = 'S256') {
    if (!codeVerifier || !codeChallenge) return false
    if (String(method || 'S256').toUpperCase() === 'S256') {
        const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
        return hash === codeChallenge
    }
    // plain
    return codeVerifier === codeChallenge
}

// ===== Token 签发 =====

/**
 * 签发 access token
 * @param {object} payload { user_id?, client_id, scope }
 * @param {number} expiresSec 默认 1 小时
 */
function issueAccessToken(payload, expiresSec = 3600) {
    return jwt.sign(
        { ...payload, typ: 'oauth-access', jti: crypto.randomBytes(8).toString('hex') },
        process.env.JWT_SECRET || 'test',
        { expiresIn: expiresSec }
    )
}

// 校验 access token（供资源服务器用）→ 返回 payload 或 null
function verifyAccessToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test')
        if (decoded.typ !== 'oauth-access') return null
        return decoded
    } catch (e) {
        return null
    }
}

module.exports = {
    oauthClientCreate,
    oauthClientUpdate,
    oauthClientList,
    oauthClientGetByClientId,
    oauthClientSetStatus,
    oauthClientDelete,
    oauthCodeCreate,
    oauthCodeConsume,
    pkceVerify,
    issueAccessToken,
    verifyAccessToken,
}
