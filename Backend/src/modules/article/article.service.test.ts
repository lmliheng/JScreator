/**
 * P4 单测：ArticleService（可见性/归属权限/分类 admin-editor）—— mock dao，不碰 DB。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArticleService, type ArticleDeps } from './article.service.js';
import type { ArticleDao } from './article.dao.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function makeSvc(over: Partial<ArticleDao> = {}, summarize?: (id: number) => Promise<unknown>): ArticleService {
    const fakeDao = {
        detail: async (id: number): Promise<AnyRow | null> => null,
        articleGetById: async (id: number): Promise<AnyRow | null> => null,
        isAdminOrEditor: async () => false,
        add: async () => 1,
        update: async () => {},
        remove: async () => {},
        categoryGetById: async () => null,
        categoryAdd: async () => {},
        categoryUpdateOwn: async () => {},
        categoryDeleteOwn: async () => {},
        categoryUpdateAny: async () => {},
        categoryDeleteAny: async () => {},
        ...over,
    } as unknown as ArticleDao;
    const deps: ArticleDeps = {
        dao: fakeDao,
        summarizeAndSave: (id) => (summarize ? summarize(id) : Promise.resolve(undefined)),
    };
    return new ArticleService(deps);
}

test('detailForViewer：文章不存在 → 404 结果', async () => {
    const svc = makeSvc({ detail: async () => null });
    const out = await svc.detailForViewer(1, null);
    assert.equal(out.ok, false);
    assert.equal((out as { status: number }).status, 404);
});

test('detailForViewer：未发布且匿名 → 404；作者本人 → 200', async () => {
    const svc = makeSvc({ detail: async () => ({ article_id: 2, status: 0, user_id: 7 }) });
    assert.equal((await svc.detailForViewer(2, null)).ok, false);
    assert.equal((await svc.detailForViewer(2, 7)).ok, true);
    assert.equal((await svc.detailForViewer(2, 99)).ok, false);
});

test('updateAs：非作者且非 admin/editor → 403 且不调用 dao.update', async () => {
    let updated = false;
    const svc = makeSvc({
        articleGetById: async () => ({ article_id: 1, title: 't', content: 'c', user: 7, status: 1 }),
        isAdminOrEditor: async () => false,
        update: async () => {
            updated = true;
        },
    });
    const out = await svc.updateAs(99, 1, { title: 'x' });
    assert.equal(out.ok, false);
    assert.equal((out as { status: number }).status, 403);
    assert.equal(updated, false);
});

test('updateAs：作者本人 → 200 且更新（status 非发布时不触发 AI 总结）', async () => {
    let updated = false;
    let summarized = 0;
    const svc = makeSvc(
        {
            articleGetById: async () => ({ article_id: 1, title: 't', content: 'c', user: 7, status: 0 }),
            update: async () => {
                updated = true;
            },
        },
        async () => {
            summarized += 1;
            return {};
        }
    );
    const out = await svc.updateAs(7, 1, { title: 'x', statusRaw: 0 });
    assert.equal(out.ok, true);
    assert.equal(updated, true);
    assert.equal(summarized, 0);
});

test('updateAs：改为发布状态 → 触发异步 AI 总结（fire-and-forget）', async () => {
    const svc = makeSvc(
        {
            articleGetById: async () => ({ article_id: 1, title: 't', content: 'c', user: 7, status: 0 }),
        },
        async () => ({ ok: true })
    );
    const out = await svc.updateAs(7, 1, { statusRaw: 1 });
    assert.equal(out.ok, true);
    await new Promise((r) => setTimeout(r, 10)); // 等异步摘要回调
});

test('categoryAdd：普通用户 → 403；admin-editor 角色名匹配放行', async () => {
    let svc = makeSvc({ isAdminOrEditor: async () => false });
    assert.equal((await svc.categoryAdd(3, 'x')).ok, false);
    svc = makeSvc({ isAdminOrEditor: async () => true });
    const out = await svc.categoryAdd(1, '技术');
    assert.equal(out.ok, true);
});
