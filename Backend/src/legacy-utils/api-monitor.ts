/**
 * legacy-utils/api-monitor —— 接口调用统计（内存版，进程重启清零）
 * 迁移自 root utils/api_monitor.js。
 */
import type { Express, Request, Response } from 'express';

interface StatsEntry {
    count: number;
    totalTime: number;
    errorCount: number;
    lastAt: number | null;
}

const stats = new Map<string, StatsEntry>();

export function recordApi(req: Request, res: Response, timeMs: number): void {
    const key = `${req.method} ${req.path}`;
    const entry = stats.get(key) || { count: 0, totalTime: 0, errorCount: 0, lastAt: null };
    entry.count += 1;
    entry.totalTime += timeMs;
    if (res.statusCode >= 400) entry.errorCount += 1;
    entry.lastAt = Date.now();
    stats.set(key, entry);
}

export interface ApiStatItem {
    path: string;
    count: number;
    avgTime: number;
    errorCount: number;
    lastAt: number | null;
}

export function getApiStats(): ApiStatItem[] {
    const list: ApiStatItem[] = [];
    stats.forEach((v, key) => {
        list.push({
            path: key,
            count: v.count,
            avgTime: Math.round(v.totalTime / v.count),
            errorCount: v.errorCount,
            lastAt: v.lastAt,
        });
    });
    return list.sort((a, b) => b.count - a.count);
}

export function resetApiStats(): void {
    stats.clear();
}

/** 扫描 Express 已注册路由，把所有接口登记进统计（未调用的显示 count=0） */
export function registerRoutes(app: Express): void {
    const stack = (app as unknown as { _router: { stack: unknown[] } })._router.stack;
    const addRoute = (path: string, methods: string[]) => {
        methods.forEach((m) => {
            const key = `${m.toUpperCase()} ${path}`;
            if (!stats.has(key)) {
                stats.set(key, { count: 0, totalTime: 0, errorCount: 0, lastAt: null });
            }
        });
    };
    const walk = (layers: unknown[], base: string) => {
        (layers as Array<{
            route?: { path: string; methods: Record<string, boolean> };
            name?: string;
            handle?: { stack?: unknown[] };
            path?: string;
        }>).forEach((layer) => {
            if (layer.route) {
                const route = layer.route;
                const methods = Object.keys(route.methods).filter((m) => route.methods[m] === true);
                addRoute(base + route.path, methods);
            } else if (layer.name === 'router' && layer.handle?.stack) {
                const subBase = base + (layer.path && layer.path !== '/' ? layer.path : '');
                walk(layer.handle.stack, subBase);
            }
        });
    };
    walk(stack, '');
}