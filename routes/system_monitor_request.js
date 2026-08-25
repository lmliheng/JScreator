const express = require('express')
const os = require('os')
const router = express.Router()
const { tokenValidator } = require('../utils/token_creator')
const { pool } = require('../utils/connect_db')

/**
 * 解析 Authorization: Bearer <token>
 * 成功返回 decoded（含 id），失败写入 401 响应并返回 null
 */
function resolveUser(req, res) {
    const token = req.headers.authorization
    if (!token) {
        res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
        return null
    }
    const decoded = tokenValidator(token)
    if (!decoded || typeof decoded !== 'object' || decoded.id === undefined) {
        res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' })
        return null
    }
    return decoded
}

// CPU 使用率采样缓存（两次请求之间计算瞬时使用率，首次返回 null）
let lastCpuSample = null

function cpuUsagePercent() {
    const cpus = os.cpus()
    if (!cpus.length) return null
    let totalAll = 0
    let idleAll = 0
    for (const c of cpus) {
        const t = c.times
        totalAll += t.user + t.nice + t.sys + t.idle + t.irq
        idleAll += t.idle
    }
    const now = Date.now()
    if (!lastCpuSample) {
        lastCpuSample = { totalAll, idleAll, ts: now }
        return null
    }
    const dTotal = totalAll - lastCpuSample.totalAll
    const dIdle = idleAll - lastCpuSample.idleAll
    const dt = now - lastCpuSample.ts
    lastCpuSample = { totalAll, idleAll, ts: now }
    if (dTotal <= 0 || dt <= 0) return null
    const usage = (1 - dIdle / dTotal) * 100
    return Math.max(0, Math.min(100, Number(usage.toFixed(1))))
}

// 系统监控（仅管理员 role_id = 1 可访问）
router.get('/system-monitor', async (req, res) => {
    const decoded = resolveUser(req, res)
    if (!decoded) return

    // 查库确认角色（即时生效，不信任 JWT 里的旧 role_id）
    try {
        const [rows] = await pool.query('SELECT role_id FROM user WHERE id = ?', [decoded.id])
        if (!rows.length || rows[0].role_id !== 1) {
            return res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员可查看系统监控' })
        }
    } catch (error) {
        console.error('系统监控-查询角色错误:', error)
        return res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }

    try {
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const usedMem = totalMem - freeMem

        // 数据库连通性与版本
        let db = { connected: false, version: null }
        try {
            await pool.query('SELECT 1')
            db.connected = true
        } catch (e) {
            db.connected = false
        }
        if (db.connected) {
            try {
                const [v] = await pool.query('SELECT VERSION() AS v')
                db.version = v[0]?.v || null
            } catch (e) {
                db.version = null
            }
        }

        res.json({
            code: 200,
            success: true,
            message: '获取系统监控成功',
            data: {
                system: {
                    hostname: os.hostname(),
                    platform: os.platform(),
                    arch: os.arch(),
                    osType: os.type(),
                    osRelease: os.release(),
                    uptime: os.uptime(),
                    cpuModel: os.cpus()[0]?.model || '',
                    cpuCores: os.cpus().length,
                },
                cpu: {
                    usage: cpuUsagePercent(),
                    loadavg: os.loadavg(),
                },
                memory: {
                    total: totalMem,
                    free: freeMem,
                    used: usedMem,
                    usagePercent: Number(((usedMem / totalMem) * 100).toFixed(1)),
                },
                process: {
                    pid: process.pid,
                    nodeVersion: process.version,
                    uptime: process.uptime(),
                    memoryRss: process.memoryUsage().rss,
                    heapUsed: process.memoryUsage().heapUsed,
                    heapTotal: process.memoryUsage().heapTotal,
                },
                db,
                timestamp: new Date().toISOString(),
            },
        })
    } catch (error) {
        console.error('获取系统监控错误:', error)
        res.status(500).json({ code: 500, success: false, message: '获取系统监控失败' })
    }
})

// 接口调用统计（仅管理员）
router.get('/system-monitor/api-stats', async (req, res) => {
    const decoded = resolveUser(req, res)
    if (!decoded) return
    try {
        const [rows] = await pool.query('SELECT role_id FROM user WHERE id = ?', [decoded.id])
        if (!rows.length || rows[0].role_id !== 1) {
            return res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员可查看系统监控' })
        }
    } catch (error) {
        console.error('接口统计-查询角色错误:', error)
        return res.status(500).json({ code: 500, success: false, message: '服务器内部错误' })
    }
    const { getApiStats } = require('../utils/api_monitor')
    res.json({ code: 200, success: true, message: '获取接口统计成功', data: { list: getApiStats() } })
})

module.exports = router
