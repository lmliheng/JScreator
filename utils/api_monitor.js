/**
 * 接口调用统计（内存版，进程重启清零）
 * 记录每个 API 的调用次数、累计耗时、错误数、最后调用时间
 */

const stats = new Map() // key: "METHOD path" -> { count, totalTime, errorCount, lastAt }

/**
 * 记录一次请求（在 res 'finish' 事件里调用）
 */
function recordApi(req, res, timeMs) {
    // 排除监控自身的轮询噪音，仍记录但可独立区分
    const key = `${req.method} ${req.path}`
    const entry = stats.get(key) || { count: 0, totalTime: 0, errorCount: 0, lastAt: null }
    entry.count += 1
    entry.totalTime += timeMs
    if (res.statusCode >= 400) entry.errorCount += 1
    entry.lastAt = Date.now()
    stats.set(key, entry)
}

/**
 * 返回统计列表（按调用次数降序）
 */
function getApiStats() {
    const list = []
    stats.forEach((v, key) => {
        list.push({
            path: key,
            count: v.count,
            avgTime: Math.round(v.totalTime / v.count),
            errorCount: v.errorCount,
            lastAt: v.lastAt,
        })
    })
    return list.sort((a, b) => b.count - a.count)
}

/**
 * 重置统计
 */
function resetApiStats() {
    stats.clear()
}

/**
 * 扫描 Express 已注册路由，把全部接口登记进统计（未调用的显示 count=0）
 * @param {import('express').Express} app
 */
function registerRoutes(app) {
    const stack = app._router.stack
    const addRoute = (path, methods) => {
        methods.forEach((m) => {
            const key = `${m.toUpperCase()} ${path}`
            if (!stats.has(key)) {
                stats.set(key, { count: 0, totalTime: 0, errorCount: 0, lastAt: null })
            }
        })
    }
    const walk = (layers, base) => {
        layers.forEach((layer) => {
            if (layer.route) {
                const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m])
                addRoute(base + layer.route.path, methods)
            } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
                const subBase = base + (layer.path && layer.path !== '/' ? layer.path : '')
                walk(layer.handle.stack, subBase)
            }
        })
    }
    walk(stack, '')
}

module.exports = { recordApi, getApiStats, resetApiStats, registerRoutes }
