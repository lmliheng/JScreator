/**
 * P4 单测：withTransaction —— 提交/回滚/释放顺序（显式 fake pool/conn）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTransaction } from './transaction.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeFakes(over: { failCommit?: boolean; failFn?: boolean } = {}) {
    const log: string[] = [];
    const conn = {
        beginTransaction: async () => {
            log.push('begin');
        },
        commit: async () => {
            log.push('commit');
            if (over.failCommit) throw new Error('commit failed');
        },
        rollback: async () => {
            log.push('rollback');
        },
        release: async () => {
            log.push('release');
        },
        query: async () => undefined,
    };
    const pool = { getConnection: async () => conn };
    const fn = async (): Promise<string> => {
        if (over.failFn) throw new Error('boom');
        return 'ok';
    };
    return { pool, conn, log, fn };
}

test('成功：begin → fn → commit → release', async () => {
    const { pool, conn, log, fn } = makeFakes();
    const r = await withTransaction(pool, async (c) => {
        assert.equal(c, conn);
        return fn();
    });
    assert.equal(r, 'ok');
    assert.deepEqual(log, ['begin', 'commit', 'release']);
});

test('fn 抛错：begin → rollback → release，异常上抛', async () => {
    const { pool, log, fn } = makeFakes({ failFn: true });
    await assert.rejects(() => withTransaction(pool, () => fn()), /boom/);
    assert.deepEqual(log, ['begin', 'rollback', 'release']);
});

test('commit 抛错：rollback + release 后异常上抛', async () => {
    const { pool, log, fn } = makeFakes({ failCommit: true });
    await assert.rejects(() => withTransaction(pool, () => fn()), /commit failed/);
    assert.deepEqual(log, ['begin', 'commit', 'rollback', 'release']);
});
