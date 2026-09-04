/**
 * P4 单测：AuthService（注册查重/成功、登录分支）—— mock deps，不碰 DB。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService, type AuthDeps } from './auth.service.js';

function makeDeps(over: Partial<AuthDeps> = {}): AuthDeps {
    const base: AuthDeps = {
        findByEmail: async () => null,
        findByUsername: async () => null,
        existsByEmail: async () => false,
        existsByUsername: async () => false,
        insertUser: async () => {},
        ToHash: (p: string) => 'hash:' + p,
        ComparePassword: (p: string, h: string) => 'hash:' + p === h,
        tokenCreator: () => 'jwt-token',
        generateId: () => 42,
        ...over,
    };
    return base;
}

test('register 邮箱重复 → 400 结果', async () => {
    const svc = new AuthService(makeDeps({ existsByEmail: async () => true }));
    const out = await svc.register('alice', 'a@x.com', 'pw');
    assert.equal('code' in out && out.code === 400 && out.message === '邮箱已存在', true);
});

test('register 用户名重复 → 400 结果', async () => {
    const svc = new AuthService(makeDeps({ existsByUsername: async () => true }));
    const out = await svc.register('alice', 'a@x.com', 'pw');
    assert.equal('code' in out && out.message === '用户名已存在', true);
});

test('register 成功：哈希入库并签发 token', async () => {
    let inserted: unknown = null;
    const svc = new AuthService(
        makeDeps({
            insertUser: async (id, username, email, hash) => {
                inserted = { id, username, email, hash };
            },
        })
    );
    const out = await svc.register('alice', 'a@x.com', 'pw123');
    assert.ok('token' in out);
    assert.equal(out.token, 'jwt-token');
    assert.deepEqual(inserted, { id: 42, username: 'alice', email: 'a@x.com', hash: 'hash:pw123' });
});

test('loginByEmail：密码错误 → null', async () => {
    const svc = new AuthService(
        makeDeps({ findByEmail: async () => ({ id: 1, username: 'a', email: 'a@x.com', password: 'hash:right' }) })
    );
    const out = await svc.loginByEmail('a@x.com', 'wrong');
    assert.equal(out, null);
});

test('loginByUsername：账号不存在 → null；正确密码 → token', async () => {
    const svc = new AuthService(makeDeps());
    assert.equal(await svc.loginByUsername('nobody', 'pw'), null);
    const svc2 = new AuthService(
        makeDeps({
            findByUsername: async () => ({ id: 5, username: 'alice', email: 'a@x.com', password: 'hash:pw' }),
        })
    );
    const out = await svc2.loginByUsername('alice', 'pw');
    assert.ok(out && out.token === 'jwt-token' && out.user.id === 5);
});
