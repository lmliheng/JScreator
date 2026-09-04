/**
 * modules/openapi/openApi.service —— 开放 API v1 业务（/api/v1/*）。
 * article/blog_profile 数据层暂桥接 legacy utils（对应域迁移后切换 TS DAO，见 legacy.ts 注释）。
 */
export interface OpenDataDeps {
    articleList: (filter: unknown) => Promise<unknown>;
    articleDetail: (id: number) => Promise<unknown>;
    articleAdd: (input: {
        user_id: number | string;
        title: string;
        content: string;
        status: number;
        category_ids: unknown[];
    }) => Promise<number | string>;
    getUserPublicByUsername: (username: string) => Promise<unknown>;
    summarizeAndSave: (articleId: number, input: { title: string; content: string }) => Promise<unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asStatus1(obj: unknown): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return !!obj && (obj as any).status === 1;
}

export class OpenApiService {
    constructor(private readonly d: OpenDataDeps) {}

    async list(filter: unknown): Promise<unknown> {
        return this.d.articleList(filter);
    }

    /** 详情：不存在或未发布 → 'notfound'（对应 legacy 404 分支） */
    async detail(id: number): Promise<{ data: unknown } | 'notfound'> {
        const article = await this.d.articleDetail(id);
        if (!article || !asStatus1(article)) return 'notfound';
        return { data: article };
    }

    async user(username: string): Promise<{ data: unknown } | 'notfound'> {
        const user = await this.d.getUserPublicByUsername(username);
        if (!user) return 'notfound';
        return { data: user };
    }

    /** 发布文章（write）；发布状态时异步生成 AI 总结（不阻塞响应，与 legacy 一致） */
    async publish(input: {
        userId: number | string;
        title: string;
        content: string;
        categoryIds?: unknown;
        statusRaw?: unknown;
    }): Promise<{ article_id: number | string }> {
        const status = input.statusRaw === undefined ? 1 : Number(input.statusRaw);
        const article_id = await this.d.articleAdd({
            user_id: input.userId,
            title: input.title,
            content: input.content,
            status,
            category_ids: Array.isArray(input.categoryIds) ? input.categoryIds : [],
        });
        if (Number(status) === 1) {
            this.d
                .summarizeAndSave(Number(article_id), { title: input.title, content: input.content })
                .then(() => {})
                .catch(() => {});
        }
        return { article_id };
    }
}
