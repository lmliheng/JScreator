/**
 * modules/systemmon/systemmon.controller —— 系统监控 + 根健康检查。
 * 行为对齐 legacy routes/system_monitor_request.js 与 init_request.js。
 */
import os from 'node:os';
import type { Request, RequestHandler, Response } from 'express';
import { pool } from '../../db/pool.js';
import { loadApiMonitor } from '../../legacy.js';
import { verifyToken, type AuthedRequest } from '../../common/middleware/auth.js';
import { asyncHandler } from '../../common/errors.js';

/** CPU 使用率采样缓存（首次返回 null） */
let lastCpuSample: { totalAll: number; idleAll: number; ts: number } | null = null;

function cpuUsagePercent(): number | null {
    const cpus = os.cpus();
    if (!cpus.length) return null;
    let totalAll = 0;
    let idleAll = 0;
    for (const c of cpus) {
        const t = c.times;
        totalAll += t.user + t.nice + t.sys + t.idle + t.irq;
        idleAll += t.idle;
    }
    const now = Date.now();
    if (!lastCpuSample) {
        lastCpuSample = { totalAll, idleAll, ts: now };
        return null;
    }
    const dTotal = totalAll - lastCpuSample.totalAll;
    const dIdle = idleAll - lastCpuSample.idleAll;
    const dt = now - lastCpuSample.ts;
    lastCpuSample = { totalAll, idleAll, ts: now };
    if (dTotal <= 0 || dt <= 0) return null;
    const usage = (1 - dIdle / dTotal) * 100;
    return Math.max(0, Math.min(100, Number(usage.toFixed(1))));
}

function adminGuard(getRoleId: (id: number | string) => Promise<number | null>): RequestHandler {
    return async (req: Request, res: Response, next: () => void) => {
        const id = (req as AuthedRequest).user?.id;
        if (id == null) {
            res.status(401).json({ code: 401, success: false, message: '未登录或登录过期' });
            return;
        }
        const role = await getRoleId(id);
        if (Number(role) !== 1) {
            res.status(403).json({ code: 403, success: false, message: '权限不足，仅管理员可查看系统监控' });
            return;
        }
        next();
    };
}

export class SystemMonitorController {
    readonly admin: RequestHandler[];

    constructor(private readonly getRoleId: (id: number | string) => Promise<number | null>) {
        this.admin = [verifyToken, adminGuard(this.getRoleId)];
    }

    /** GET /system-monitor */
    monitor = async (_req: Request, res: Response): Promise<void> => {
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;

            // 数据库连通性与版本
            let db = { connected: false, version: null as string | null };
            try {
                await pool.query('SELECT 1');
                db.connected = true;
            } catch {
                db.connected = false;
            }
            if (db.connected) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const [v] = await pool.query('SELECT VERSION() AS v');
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const first = v[0] as { v?: unknown } | undefined;
                    db.version = first && first.v != null ? String(first.v) : null;
                } catch {
                    db.version = null;
                }
            }

            const cpuCpus = os.cpus();
            const cpu0 = cpuCpus[0];
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
                        cpuModel: cpu0 ? cpu0.model : '',
                        cpuCores: cpuCpus.length,
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
            });
        } catch (error) {
            console.error('获取系统监控错误:', error);
            res.status(500).json({ code: 500, success: false, message: '获取系统监控失败' });
        }
    };

    /** GET /system-monitor/api-stats */
    apiStats = async (_req: Request, res: Response): Promise<void> => {
        const { getApiStats } = loadApiMonitor();
        res.json({ code: 200, success: true, message: '获取接口统计成功', data: { list: getApiStats() } });
    };

    /** GET /（根健康检查，公开） */
    root = async (_req: Request, res: Response): Promise<void> => {
        res.json({ code: 200, message: '你好，成功启动JScreate' });
    };
}
